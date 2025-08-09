/**
 * Mock Server for Testing Hybrid Translation System
 * Simulates Azure services to demonstrate the hybrid approach
 */

import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Mock speech token endpoint
app.get('/api/speech/token', (req, res) => {
    res.json({
        token: 'mock-token-' + Date.now(),
        region: 'eastus'
    });
});

// Health check
app.get('/healthz', (req, res) => {
    res.json({ 
        ok: true,
        method: 'mock-hybrid-translation',
        version: '2.0.0-mock'
    });
});

// Sessions storage
const sessions = new Map();

// Mock translations
const mockTranslations = {
    "Hello": "Hola",
    "Hello everyone": "Hola a todos",
    "Hello everyone.": "Hola a todos.",
    "Welcome": "Bienvenidos",
    "Welcome to": "Bienvenidos a",
    "Welcome to the": "Bienvenidos a la",
    "Welcome to the meeting": "Bienvenidos a la reunión",
    "Welcome to the meeting.": "Bienvenidos a la reunión.",
    "How are you?": "¿Cómo estás?",
    "I'm fine, thank you.": "Estoy bien, gracias.",
    "Let's discuss our goals.": "Hablemos de nuestros objetivos."
};

function mockTranslate(text, targetLang) {
    // Simple mock translation
    if (targetLang === 'es') {
        return mockTranslations[text] || `[ES] ${text}`;
    } else if (targetLang === 'fr') {
        return `[FR] ${text}`;
    }
    return `[${targetLang}] ${text}`;
}

// Simulated sentence stability tracking
const sentenceTrackers = new Map();

function trackSentenceStability(sessionCode, text, isFinal) {
    const key = `${sessionCode}`;
    if (!sentenceTrackers.has(key)) {
        sentenceTrackers.set(key, {
            history: new Map(),
            played: new Set(),
            partialCount: 0
        });
    }
    
    const tracker = sentenceTrackers.get(key);
    tracker.partialCount++;
    
    // Extract sentences (simple version)
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const stableSentences = [];
    
    sentences.forEach(sentence => {
        sentence = sentence.trim();
        if (!tracker.history.has(sentence)) {
            tracker.history.set(sentence, { count: 1, firstSeen: Date.now() });
        } else {
            const entry = tracker.history.get(sentence);
            entry.count++;
            
            // Consider stable after 2 appearances or if final
            if ((entry.count >= 2 || isFinal) && !tracker.played.has(sentence)) {
                stableSentences.push({
                    text: sentence,
                    confidence: Math.min(entry.count * 0.3, 1.0)
                });
                tracker.played.add(sentence);
            }
        }
    });
    
    return {
        partialNumber: tracker.partialCount,
        stableSentences,
        displayText: text
    };
}

// WebSocket handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    // Speaker join
    socket.on('streaming-speaker-join', ({ sessionCode, sourceLang, targetLangs }) => {
        const code = sessionCode.toUpperCase();
        sessions.set(code, {
            speakerId: socket.id,
            sourceLang,
            targetLangs,
            listeners: new Map(),
            startTime: Date.now()
        });
        
        socket.join(code);
        socket.emit('joined', { ok: true, sessionCode: code });
        console.log(`🎙️ Speaker joined session ${code} (${sourceLang} → ${targetLangs.join(', ')})`);
    });
    
    // Listener join
    socket.on('streaming-listener-join', ({ sessionCode, preferredLanguage }) => {
        const code = sessionCode.toUpperCase();
        const session = sessions.get(code);
        
        if (!session) {
            return socket.emit('session-not-found');
        }
        
        session.listeners.set(socket.id, {
            lang: preferredLanguage,
            joinedAt: Date.now()
        });
        
        socket.join(code);
        socket.emit('joined', { 
            ok: true, 
            sessionCode: code,
            availableLanguages: session.targetLangs
        });
        console.log(`👂 Listener joined session ${code} for ${preferredLanguage}`);
    });
    
    // Translation stream (the key part!)
    socket.on('translation-stream', async (data) => {
        const code = data.sessionCode.toUpperCase();
        const session = sessions.get(code);
        
        if (!session) return;
        
        console.log(`\n📝 [${data.isFinal ? 'FINAL' : 'PARTIAL'}] Original: "${data.original}"`);
        
        // Mock translations
        const translations = {};
        session.targetLangs.forEach(lang => {
            translations[lang] = mockTranslate(data.original, lang);
        });
        
        // Process with stability tracking
        for (const [lang, translatedText] of Object.entries(translations)) {
            const result = trackSentenceStability(code, translatedText, data.isFinal);
            
            console.log(`   └─ ${lang}: "${translatedText}" (partial #${result.partialNumber})`);
            
            // Send display update immediately
            session.listeners.forEach((listener, listenerId) => {
                if (listener.lang === lang) {
                    const listenerSocket = io.sockets.sockets.get(listenerId);
                    if (listenerSocket) {
                        listenerSocket.emit('translation-update', {
                            text: result.displayText,
                            language: lang,
                            isFinal: data.isFinal,
                            partialNumber: result.partialNumber
                        });
                    }
                }
            });
            
            // Generate mock audio for stable sentences
            if (result.stableSentences.length > 0) {
                console.log(`   🎯 [STABLE] ${result.stableSentences.length} sentences ready for TTS:`);
                
                result.stableSentences.forEach(sentenceData => {
                    console.log(`      ✅ "${sentenceData.text}" (confidence: ${(sentenceData.confidence * 100).toFixed(0)}%)`);
                    
                    // Send mock audio (base64 encoded silent audio)
                    const mockAudio = Buffer.from([0xFF, 0xF3, 0x18, 0x00]).toString('base64');
                    
                    session.listeners.forEach((listener, listenerId) => {
                        if (listener.lang === lang) {
                            const listenerSocket = io.sockets.sockets.get(listenerId);
                            if (listenerSocket) {
                                listenerSocket.emit('audio-stream', {
                                    audio: mockAudio,
                                    format: 'mp3',
                                    language: lang,
                                    text: sentenceData.text,
                                    confidence: sentenceData.confidence,
                                    isStable: true
                                });
                                console.log(`      🔊 Mock audio sent to listener`);
                            }
                        }
                    });
                });
            }
        }
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
        
        // Clean up sessions
        for (const [code, session] of sessions.entries()) {
            if (session.speakerId === socket.id) {
                console.log(`📊 Session ${code} ended`);
                io.to(code).emit('speaker-disconnected');
                sessions.delete(code);
                sentenceTrackers.delete(code);
            } else if (session.listeners.has(socket.id)) {
                session.listeners.delete(socket.id);
            }
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`
🚀 Mock Hybrid Translation Server Started
==========================================
Server: http://localhost:${PORT}
Speaker: http://localhost:${PORT}/speaker-streaming.html  
Listener: http://localhost:${PORT}/listener-hybrid.html
Health: http://localhost:${PORT}/healthz

This mock server simulates:
- Sentence stability tracking
- Progressive audio generation
- Dual-path processing (display + audio)

Watch the console for detailed logs showing:
- Partial vs Final processing
- Stability detection
- Audio generation timing
==========================================
    `);
});