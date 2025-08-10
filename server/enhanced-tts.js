/**
 * Enhanced TTS Manager with ElevenLabs Integration and Adaptive Speed Control
 * Optimized for ultra-low latency in conference scenarios
 */

import { EventEmitter } from 'events';
import { Readable } from 'stream';
import axios from 'axios';
import { getVoiceConfig, getAvailableVoices } from './voice-profiles.js';

/**
 * Enhanced TTS with Queue Management and Adaptive Speed
 */
export class EnhancedTTS extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      primaryProvider: 'elevenlabs', // ElevenLabs as primary for lowest latency
      fallbackProvider: 'azure',
      elevenLabsKey: config.elevenLabsKey || process.env.ELEVENLABS_API_KEY,
      azureKey: process.env.SPEECH_KEY,
      azureRegion: process.env.SPEECH_REGION,
      
      // Adaptive speed control
      baseSpeed: 1.0,
      maxSpeed: 1.5, // Max 50% speed increase
      minSpeed: 0.9, // Min 10% speed decrease
      queueThreshold: 3, // Start speeding up when queue > 3
      criticalQueueSize: 10, // Critical queue size
      
      // Latency optimization
      chunkSize: 1024, // Smaller chunks for lower latency
      streamingLatency: 1, // ElevenLabs streaming latency (1-4, lower = faster)
      
      ...config
    };
    
    // Queue management per session/language
    this.queues = new Map(); // sessionId:lang -> queue
    this.queueMetrics = new Map(); // sessionId:lang -> metrics
    this.activeGenerations = new Map(); // Track active TTS generations
    
    // Performance tracking
    this.metrics = {
      totalRequests: 0,
      avgLatency: 0,
      avgQueueDepth: 0,
      speedAdjustments: 0,
      elevenLabsUsage: 0,
      fallbackUsage: 0
    };
    
    this.initialize();
  }
  
  async initialize() {
    // Initialize ElevenLabs voices
    // Using multilingual voices for non-English languages
    this.elevenLabsVoices = {
      'en': 'pNInz6obpgDQGcFmaJgB', // Adam - English (turbo)
      'en-US': 'pNInz6obpgDQGcFmaJgB',
      'en-GB': '21m00Tcm4TlvDq8ikWAM', // Rachel - British English
      'es': 'z9fAnlkpzviPz146aGWa', // Glinda - Spanish (multilingual)
      'es-ES': 'z9fAnlkpzviPz146aGWa',
      'fr': 'CYw3kZ02Hs0563khs1Fj', // Dave - French (multilingual)  
      'fr-CA': 'CYw3kZ02Hs0563khs1Fj',
      'fr-FR': 'CYw3kZ02Hs0563khs1Fj',
      'de': 'ErXwobaYiN019PkySvjV', // Antoni - German (multilingual)
      'de-DE': 'ErXwobaYiN019PkySvjV',
      'it': 'onwK4e9ZLuTAKqWW03F9', // Daniel - Italian (multilingual)
      'it-IT': 'onwK4e9ZLuTAKqWW03F9',
      'pt': 'Yko7PKHZNXotIFUBG7I9', // Thomas - Portuguese (multilingual)
      'pt-BR': 'Yko7PKHZNXotIFUBG7I9',
      'pl': 'VR6AewLTigWG4xSOukaG', // Arnold - Polish (multilingual)
      'pl-PL': 'VR6AewLTigWG4xSOukaG',
      'zh': 'pqHfZKP75CvOlQylNhV4', // Bill - Chinese (multilingual)
      'zh-CN': 'pqHfZKP75CvOlQylNhV4',
      'ja': 'pqHfZKP75CvOlQylNhV4', // Bill - Japanese (multilingual)
      'ja-JP': 'pqHfZKP75CvOlQylNhV4',
      'ko': 'pqHfZKP75CvOlQylNhV4', // Bill - Korean (multilingual)
      'ko-KR': 'pqHfZKP75CvOlQylNhV4',
      'default': 'pNInz6obpgDQGcFmaJgB' // Adam as default
    };
    
    // Azure voices as fallback
    this.azureVoices = {
      'en': 'en-US-JennyNeural',
      'en-US': 'en-US-JennyNeural',
      'es': 'es-ES-ElviraNeural',
      'es-ES': 'es-ES-ElviraNeural',
      'fr': 'fr-CA-SylvieNeural',
      'fr-CA': 'fr-CA-SylvieNeural',
      'de': 'de-DE-KatjaNeural',
      'de-DE': 'de-DE-KatjaNeural',
      'zh': 'zh-CN-XiaoxiaoNeural',
      'zh-CN': 'zh-CN-XiaoxiaoNeural',
      'ja': 'ja-JP-NanamiNeural',
      'ja-JP': 'ja-JP-NanamiNeural'
    };
    
    // Start queue monitor
    this.startQueueMonitor();
    
    console.log('✅ Enhanced TTS initialized with ElevenLabs primary');
  }
  
  /**
   * Get or create queue for session/language
   */
  getQueue(sessionId, language) {
    const key = `${sessionId}:${language}`;
    if (!this.queues.has(key)) {
      this.queues.set(key, []);
      this.queueMetrics.set(key, {
        totalProcessed: 0,
        currentDepth: 0,
        maxDepth: 0,
        avgProcessingTime: 0,
        lastSpeedAdjustment: 1.0
      });
    }
    return this.queues.get(key);
  }
  
  /**
   * Calculate adaptive speed based on queue depth
   */
  calculateAdaptiveSpeed(queueDepth) {
    if (queueDepth <= this.config.queueThreshold) {
      // Normal speed when queue is manageable
      return this.config.baseSpeed;
    }
    
    // Progressive speed increase based on queue depth
    const excessQueue = queueDepth - this.config.queueThreshold;
    const speedIncrement = 0.05; // 5% per excess item
    const targetSpeed = this.config.baseSpeed + (excessQueue * speedIncrement);
    
    // Clamp to max speed
    const adaptedSpeed = Math.min(targetSpeed, this.config.maxSpeed);
    
    // Log significant speed changes
    if (Math.abs(adaptedSpeed - this.config.baseSpeed) > 0.1) {
      console.log(`⚡ Adaptive speed: ${adaptedSpeed.toFixed(2)}x for queue depth ${queueDepth}`);
      this.metrics.speedAdjustments++;
    }
    
    return adaptedSpeed;
  }
  
  /**
   * Generate TTS with queue management and adaptive speed
   * @param {string} text - Text to synthesize
   * @param {string} language - Target language
   * @param {string} sessionId - Session ID
   * @param {string} voicePreference - Optional voice preference (e.g., 'adam', 'rachel')
   */
  async generateWithQueueManagement(text, language, sessionId, voicePreference = null) {
    const queue = this.getQueue(sessionId, language);
    const key = `${sessionId}:${language}`;
    const metrics = this.queueMetrics.get(key);
    
    // Add to queue
    const request = {
      text,
      language,
      voicePreference,
      timestamp: Date.now(),
      resolve: null,
      reject: null
    };
    
    const promise = new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });
    
    queue.push(request);
    metrics.currentDepth = queue.length;
    metrics.maxDepth = Math.max(metrics.maxDepth, queue.length);
    
    // Process queue if not already processing
    if (!this.activeGenerations.has(key)) {
      this.processQueue(sessionId, language);
    }
    
    return promise;
  }
  
  /**
   * Process TTS queue with adaptive speed
   */
  async processQueue(sessionId, language) {
    const key = `${sessionId}:${language}`;
    const queue = this.getQueue(sessionId, language);
    const metrics = this.queueMetrics.get(key);
    
    if (queue.length === 0) {
      this.activeGenerations.delete(key);
      return;
    }
    
    this.activeGenerations.set(key, true);
    
    while (queue.length > 0) {
      const request = queue.shift();
      metrics.currentDepth = queue.length;
      
      try {
        const startTime = Date.now();
        
        // Calculate adaptive speed based on remaining queue depth
        const speed = this.calculateAdaptiveSpeed(queue.length);
        metrics.lastSpeedAdjustment = speed;
        
        // Generate TTS with adaptive speed and voice preference
        const audioStream = await this.generateTTS(
          request.text,
          request.language,
          speed,
          request.voicePreference
        );
        
        // Track processing time
        const processingTime = Date.now() - startTime;
        metrics.avgProcessingTime = 
          (metrics.avgProcessingTime * metrics.totalProcessed + processingTime) /
          (metrics.totalProcessed + 1);
        metrics.totalProcessed++;
        
        // Update global metrics
        this.updateGlobalMetrics(processingTime, queue.length);
        
        request.resolve(audioStream);
      } catch (error) {
        console.error(`TTS generation error: ${error.message}`);
        request.reject(error);
      }
    }
    
    this.activeGenerations.delete(key);
  }
  
  /**
   * Generate TTS with ElevenLabs (primary) or Azure (fallback)
   */
  async generateTTS(text, language, speed = 1.0, voicePreference = null) {
    try {
      // Try ElevenLabs first for lowest latency
      const audioStream = await this.generateElevenLabsTTS(text, language, speed, voicePreference);
      this.metrics.elevenLabsUsage++;
      return audioStream;
    } catch (error) {
      console.warn(`ElevenLabs TTS failed, falling back to Azure: ${error.message}`);
      this.metrics.fallbackUsage++;
      
      // Fallback to Azure
      return await this.generateAzureTTS(text, language, speed);
    }
  }
  
  /**
   * Generate TTS using ElevenLabs with ultra-low latency settings
   */
  async generateElevenLabsTTS(text, language, speed = 1.0, voicePreference = null) {
    // Get voice configuration from profiles
    const voiceConfig = getVoiceConfig(language, voicePreference);
    const voiceId = voiceConfig.id;
    const model = voiceConfig.model;
    
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
    
    console.log(`🎯 ElevenLabs TTS: ${language} → ${voiceConfig.name} (${model}) @ ${speed}x`);
    
    const response = await axios({
      method: 'POST',
      url,
      headers: {
        'xi-api-key': this.config.elevenLabsKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      data: {
        text,
        model_id: model,
        voice_settings: {
          stability: 0.3, // Lower for more variation and natural sound
          similarity_boost: 0.7,
          style: 0.0,
          use_speaker_boost: true,
          // Adaptive speed control
          speed: speed
        },
        // Ultra-low latency settings
        optimize_streaming_latency: this.config.streamingLatency,
        output_format: 'mp3_22050_32', // Lower quality for faster streaming
        chunk_length_schedule: [50, 120, 200, 300, 500] // Aggressive chunking
      },
      responseType: 'stream',
      // Streaming configuration
      maxRedirects: 0,
      timeout: 5000,
      validateStatus: (status) => status === 200
    });
    
    // Create a readable stream wrapper
    const audioStream = new Readable({
      read() {}
    });
    
    // Pipe response data with minimal buffering
    response.data.on('data', (chunk) => {
      audioStream.push(chunk);
    });
    
    response.data.on('end', () => {
      audioStream.push(null);
    });
    
    response.data.on('error', (error) => {
      audioStream.destroy(error);
    });
    
    return audioStream;
  }
  
  /**
   * Generate TTS using Azure (fallback)
   */
  async generateAzureTTS(text, language, speed = 1.0) {
    // Dynamic import for Azure SDK
    let SpeechSDK;
    try {
      const sdk = await import('microsoft-cognitiveservices-speech-sdk');
      SpeechSDK = sdk.default || sdk;
    } catch (error) {
      throw new Error('Azure Speech SDK not available');
    }
    
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
      this.config.azureKey,
      this.config.azureRegion
    );
    
    const voice = this.azureVoices[language] || this.azureVoices['en'];
    const locale = voice.split('-').slice(0, 2).join('-');
    
    // Create SSML with speed control
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}">
        <voice name="${voice}">
          <prosody rate="${speed}" pitch="0%">
            ${this.escapeSSML(text)}
          </prosody>
        </voice>
      </speak>
    `;
    
    return new Promise((resolve, reject) => {
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);
      
      synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          synthesizer.close();
          
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            const audioStream = new Readable({
              read() {}
            });
            
            audioStream.push(Buffer.from(result.audioData));
            audioStream.push(null);
            
            resolve(audioStream);
          } else {
            reject(new Error(`Azure TTS failed: ${result.errorDetails}`));
          }
        },
        (error) => {
          synthesizer.close();
          reject(error);
        }
      );
    });
  }
  
  /**
   * Escape text for SSML
   */
  escapeSSML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  
  /**
   * Monitor queues and adjust strategies
   */
  startQueueMonitor() {
    setInterval(() => {
      for (const [key, metrics] of this.queueMetrics) {
        if (metrics.currentDepth > this.config.criticalQueueSize) {
          console.warn(`⚠️ Critical queue depth for ${key}: ${metrics.currentDepth}`);
          
          // Consider dropping old requests if queue is too deep
          const queue = this.queues.get(key);
          if (queue && queue.length > this.config.criticalQueueSize * 2) {
            const dropped = queue.splice(0, queue.length - this.config.criticalQueueSize);
            console.warn(`🗑️ Dropped ${dropped.length} old TTS requests to prevent overflow`);
            
            // Reject dropped requests
            dropped.forEach(req => {
              req.reject(new Error('Request dropped due to queue overflow'));
            });
          }
        }
      }
      
      // Log overall metrics periodically
      if (this.metrics.totalRequests % 100 === 0 && this.metrics.totalRequests > 0) {
        console.log(`📊 TTS Metrics:
          Total Requests: ${this.metrics.totalRequests}
          Avg Latency: ${this.metrics.avgLatency.toFixed(0)}ms
          Avg Queue Depth: ${this.metrics.avgQueueDepth.toFixed(1)}
          Speed Adjustments: ${this.metrics.speedAdjustments}
          ElevenLabs Usage: ${this.metrics.elevenLabsUsage}
          Fallback Usage: ${this.metrics.fallbackUsage}`);
      }
    }, 1000); // Check every second
  }
  
  /**
   * Update global metrics
   */
  updateGlobalMetrics(latency, queueDepth) {
    this.metrics.totalRequests++;
    this.metrics.avgLatency = 
      (this.metrics.avgLatency * (this.metrics.totalRequests - 1) + latency) /
      this.metrics.totalRequests;
    this.metrics.avgQueueDepth = 
      (this.metrics.avgQueueDepth * (this.metrics.totalRequests - 1) + queueDepth) /
      this.metrics.totalRequests;
  }
  
  /**
   * Get queue status for a session/language
   */
  getQueueStatus(sessionId, language) {
    const key = `${sessionId}:${language}`;
    const metrics = this.queueMetrics.get(key);
    const queue = this.queues.get(key);
    
    if (!metrics || !queue) {
      return {
        depth: 0,
        processing: false,
        metrics: null
      };
    }
    
    return {
      depth: queue.length,
      processing: this.activeGenerations.has(key),
      metrics: {
        ...metrics,
        currentSpeed: metrics.lastSpeedAdjustment
      }
    };
  }
  
  /**
   * Clear queue for a session
   */
  clearQueue(sessionId, language) {
    const key = `${sessionId}:${language}`;
    const queue = this.queues.get(key);
    
    if (queue) {
      // Reject all pending requests
      queue.forEach(req => {
        req.reject(new Error('Queue cleared'));
      });
      
      queue.length = 0;
      this.queueMetrics.delete(key);
      this.activeGenerations.delete(key);
      
      console.log(`🧹 Cleared TTS queue for ${key}`);
    }
  }
  
  /**
   * Direct synthesis without queue (for testing)
   */
  async synthesizeDirect(text, language) {
    const speed = this.config.baseSpeed;
    return await this.generateTTS(text, language, speed);
  }
}

// Export singleton instance
export const enhancedTTS = new EnhancedTTS({
  elevenLabsKey: process.env.ELEVENLABS_API_KEY || 'sk_83b559a4751d0df3a401738997524d4932d1eed423bf1dde'
});