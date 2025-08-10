/**
 * WebSocket Streaming TTS for Continuous Speech Synthesis
 * Uses ElevenLabs WebSocket API for seamless, uninterrupted audio generation
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { getVoiceConfig } from './voice-profiles.js';

export class WebSocketStreamingTTS extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            apiKey: config.apiKey || process.env.ELEVENLABS_API_KEY,
            wsUrl: 'wss://api.elevenlabs.io/v1/text-to-speech',
            // Streaming configuration
            flushAfterSilenceMs: 500,  // Flush audio after 500ms of no new text
            chunkSize: 150,  // Characters to buffer before sending
            enableSentinel: true,  // Use sentinel values for smooth streaming
            ...config
        };
        
        // Active connections per session/language
        this.connections = new Map(); // sessionId:lang -> WebSocket
        this.textBuffers = new Map(); // sessionId:lang -> pending text
        this.flushTimers = new Map(); // sessionId:lang -> flush timer
        
        // Metrics
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            totalCharactersSent: 0,
            totalAudioReceived: 0
        };
    }
    
    /**
     * Get or create WebSocket connection for a session/language
     */
    async getConnection(sessionId, language, voicePreference = null) {
        const key = `${sessionId}:${language}`;
        
        if (this.connections.has(key)) {
            const conn = this.connections.get(key);
            if (conn.readyState === WebSocket.OPEN) {
                return conn;
            }
            // Connection exists but not open, remove it
            this.connections.delete(key);
        }
        
        // Create new connection
        const connection = await this.createConnection(language, voicePreference);
        this.connections.set(key, connection);
        this.textBuffers.set(key, '');
        
        // Set up connection cleanup
        connection.on('close', () => {
            this.connections.delete(key);
            this.textBuffers.delete(key);
            this.clearFlushTimer(key);
            this.metrics.activeConnections--;
            console.log(`🔌 [WS-TTS] Connection closed for ${key}`);
        });
        
        connection.on('error', (error) => {
            console.error(`❌ [WS-TTS] Connection error for ${key}:`, error);
            this.connections.delete(key);
            this.textBuffers.delete(key);
            this.clearFlushTimer(key);
        });
        
        return connection;
    }
    
    /**
     * Create new WebSocket connection to ElevenLabs
     */
    createConnection(language, voicePreference = null) {
        return new Promise((resolve, reject) => {
            // Get voice configuration
            const voiceConfig = getVoiceConfig(language, voicePreference);
            const voiceId = voiceConfig.id;
            const model = voiceConfig.model;
            
            // Construct WebSocket URL with parameters
            const wsUrl = `${this.config.wsUrl}/${voiceId}/stream-input?model_id=${model}&output_format=mp3_22050_32`;
            
            console.log(`🔌 [WS-TTS] Connecting to ElevenLabs WebSocket for ${language} (${voiceConfig.name})...`);
            
            const ws = new WebSocket(wsUrl, {
                headers: {
                    'xi-api-key': this.config.apiKey
                }
            });
            
            // Handle connection events
            ws.on('open', () => {
                console.log(`✅ [WS-TTS] Connected for ${language}`);
                this.metrics.totalConnections++;
                this.metrics.activeConnections++;
                
                // Send initial configuration
                const initMessage = {
                    text: ' ',  // Send a space to initialize
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true
                    },
                    generation_config: {
                        chunk_length_schedule: [50, 90, 120, 150, 200]  // Aggressive chunking
                    }
                };
                
                ws.send(JSON.stringify(initMessage));
                resolve(ws);
            });
            
            ws.on('error', (error) => {
                console.error(`❌ [WS-TTS] Connection failed:`, error);
                reject(error);
            });
            
            // Handle incoming audio data
            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    
                    if (response.audio) {
                        // Emit audio chunk for streaming to client
                        const audioBuffer = Buffer.from(response.audio, 'base64');
                        this.metrics.totalAudioReceived += audioBuffer.length;
                        
                        this.emit('audio-chunk', {
                            audio: audioBuffer,
                            language: language,
                            isFinal: response.isFinal || false
                        });
                    }
                    
                    if (response.error) {
                        console.error(`❌ [WS-TTS] Stream error:`, response.error);
                    }
                } catch (error) {
                    // Binary audio data (if not JSON)
                    if (Buffer.isBuffer(data)) {
                        this.emit('audio-chunk', {
                            audio: data,
                            language: language,
                            isFinal: false
                        });
                    }
                }
            });
        });
    }
    
    /**
     * Stream text continuously to TTS engine
     * This is the key method - text flows in continuously without breaks
     */
    async streamText(sessionId, language, text, isFinal = false, voicePreference = null) {
        const key = `${sessionId}:${language}`;
        
        try {
            // Get or create connection
            const ws = await this.getConnection(sessionId, language, voicePreference);
            
            // Add text to buffer
            let buffer = this.textBuffers.get(key) || '';
            buffer += text;
            this.textBuffers.set(key, buffer);
            
            // Clear existing flush timer
            this.clearFlushTimer(key);
            
            // Determine if we should send now
            let shouldSend = false;
            let textToSend = '';
            
            if (isFinal) {
                // Send everything on final
                shouldSend = true;
                textToSend = buffer;
                this.textBuffers.set(key, '');
            } else if (buffer.length >= this.config.chunkSize) {
                // Send if we have enough characters
                shouldSend = true;
                // Find a good break point (space, punctuation)
                let breakPoint = this.findBreakPoint(buffer, this.config.chunkSize);
                textToSend = buffer.substring(0, breakPoint);
                this.textBuffers.set(key, buffer.substring(breakPoint));
            }
            
            // Send text if ready
            if (shouldSend && textToSend.trim().length > 0) {
                const message = {
                    text: textToSend,
                    flush: isFinal  // Flush on final to get remaining audio
                };
                
                ws.send(JSON.stringify(message));
                this.metrics.totalCharactersSent += textToSend.length;
                
                console.log(`📤 [WS-TTS] Streamed ${textToSend.length} chars: "${textToSend.substring(0, 50)}..."`);
            }
            
            // Set flush timer for remaining text
            if (!isFinal && this.textBuffers.get(key)?.length > 0) {
                const timer = setTimeout(() => {
                    this.flushBuffer(sessionId, language);
                }, this.config.flushAfterSilenceMs);
                this.flushTimers.set(key, timer);
            }
            
        } catch (error) {
            console.error(`❌ [WS-TTS] Streaming error for ${key}:`, error);
            // Fallback or error handling
            this.emit('error', { sessionId, language, error });
        }
    }
    
    /**
     * Find natural break point in text
     */
    findBreakPoint(text, targetLength) {
        // Look for punctuation or space near target length
        for (let i = targetLength; i < Math.min(text.length, targetLength + 50); i++) {
            if (text[i] === ' ' || text[i] === ',' || text[i] === '.' || text[i] === ';') {
                return i + 1;
            }
        }
        
        // Look backwards if nothing found forward
        for (let i = targetLength; i > Math.max(0, targetLength - 50); i--) {
            if (text[i] === ' ') {
                return i + 1;
            }
        }
        
        // Default to target length
        return targetLength;
    }
    
    /**
     * Flush buffered text
     */
    async flushBuffer(sessionId, language) {
        const key = `${sessionId}:${language}`;
        const buffer = this.textBuffers.get(key);
        
        if (buffer && buffer.trim().length > 0) {
            try {
                const ws = this.connections.get(key);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    const message = {
                        text: buffer,
                        flush: true
                    };
                    
                    ws.send(JSON.stringify(message));
                    this.textBuffers.set(key, '');
                    
                    console.log(`💨 [WS-TTS] Flushed buffer: "${buffer.substring(0, 50)}..."`);
                }
            } catch (error) {
                console.error(`❌ [WS-TTS] Flush error for ${key}:`, error);
            }
        }
        
        this.clearFlushTimer(key);
    }
    
    /**
     * Clear flush timer
     */
    clearFlushTimer(key) {
        if (this.flushTimers.has(key)) {
            clearTimeout(this.flushTimers.get(key));
            this.flushTimers.delete(key);
        }
    }
    
    /**
     * Close connection for a session
     */
    closeConnection(sessionId, language) {
        const key = `${sessionId}:${language}`;
        
        // Flush any remaining text
        this.flushBuffer(sessionId, language);
        
        // Close WebSocket
        const ws = this.connections.get(key);
        if (ws) {
            ws.close();
            this.connections.delete(key);
        }
        
        // Clean up
        this.textBuffers.delete(key);
        this.clearFlushTimer(key);
        
        console.log(`🔌 [WS-TTS] Closed connection for ${key}`);
    }
    
    /**
     * Get metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            bufferSizes: Array.from(this.textBuffers.entries()).map(([key, buffer]) => ({
                session: key,
                size: buffer.length
            }))
        };
    }
}

// Export singleton instance
export const webSocketTTS = new WebSocketStreamingTTS();