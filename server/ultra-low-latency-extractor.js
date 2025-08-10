/**
 * Ultra-Low Latency Sentence Extractor for Real-Time Conferences
 * Generates TTS immediately as words arrive, without waiting for sentence completion
 */

import crypto from 'crypto';

export class UltraLowLatencyExtractor {
    constructor() {
        // Configuration for ultra-low latency
        this.MIN_CHUNK_WORDS = 3; // Start TTS after just 3 words
        this.MAX_CHUNK_WORDS = 10; // Max words per chunk for natural flow
        this.CHUNK_DELAY_MS = 100; // Max delay before forcing TTS generation
        
        // Session tracking
        this.sessions = new Map();
        
        // Natural break points for chunking
        this.breakPoints = /[,;:\-–—]/g;
        this.sentenceEndings = /[.!?]+\s*/g;
    }
    
    /**
     * Get or create session
     */
    getSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        if (!this.sessions.has(key)) {
            this.sessions.set(key, {
                spokenChunks: new Set(),      // Hashes of chunks already spoken
                pendingWords: [],              // Words accumulating for next chunk
                lastChunkTime: Date.now(),     // Time of last chunk generation
                sequenceNumber: 0,             // Track order of chunks
                currentText: '',               // Current full text
                lastProcessedLength: 0        // Track what we've already processed
            });
        }
        return this.sessions.get(key);
    }
    
    /**
     * Calculate hash for deduplication
     */
    hashText(text) {
        return crypto.createHash('sha256')
            .update(text.trim().toLowerCase())
            .digest('hex')
            .substring(0, 16);
    }
    
    /**
     * Extract words that haven't been processed yet
     */
    extractNewWords(session, text) {
        // Find new content since last processing
        if (text.length <= session.lastProcessedLength) {
            return []; // No new content
        }
        
        const newContent = text.substring(session.lastProcessedLength);
        const words = newContent.trim().split(/\s+/).filter(w => w.length > 0);
        
        return words;
    }
    
    /**
     * Check if we should generate TTS for current chunk
     */
    shouldGenerateChunk(session, words) {
        const now = Date.now();
        const timeSinceLastChunk = now - session.lastChunkTime;
        
        // Generate if:
        // 1. We have minimum words
        // 2. We hit a natural break point (comma, semicolon, etc.)
        // 3. We hit a sentence ending
        // 4. Too much time has passed since last chunk
        // 5. We have maximum words
        
        if (words.length >= this.MIN_CHUNK_WORDS) {
            const text = words.join(' ');
            
            // Check for natural breaks
            if (this.breakPoints.test(text) || this.sentenceEndings.test(text)) {
                return true;
            }
            
            // Check time threshold
            if (timeSinceLastChunk >= this.CHUNK_DELAY_MS) {
                return true;
            }
            
            // Check max words
            if (words.length >= this.MAX_CHUNK_WORDS) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Create natural-sounding chunks from words
     */
    createChunk(words) {
        let chunk = words.join(' ');
        
        // Add slight pause markers for natural flow if chunk doesn't end with punctuation
        if (!/[.!?,;:]$/.test(chunk)) {
            // Don't add punctuation, just return as-is for more natural flow
            // The TTS will handle the prosody
        }
        
        return chunk;
    }
    
    /**
     * Process incoming text with ultra-low latency chunking
     */
    processText(sessionId, language, text, isFinal = false) {
        const session = this.getSession(sessionId, language);
        const result = {
            chunks: [],
            displayText: text
        };
        
        // Always update current text
        session.currentText = text;
        
        // Extract only new words since last processing
        const newWords = this.extractNewWords(session, text);
        
        if (newWords.length > 0) {
            // Add new words to pending buffer
            session.pendingWords.push(...newWords);
            
            // Update processed length
            session.lastProcessedLength = text.length;
            
            console.log(`📝 [ULTRA] New words: [${newWords.slice(0, 5).join(' ')}...] (${newWords.length} words)`);
        }
        
        // Check if we should generate a chunk
        while (this.shouldGenerateChunk(session, session.pendingWords) || 
               (isFinal && session.pendingWords.length > 0)) {
            
            // Determine chunk size
            let chunkSize = this.MIN_CHUNK_WORDS;
            
            // Look for natural break point
            for (let i = this.MIN_CHUNK_WORDS; i <= Math.min(this.MAX_CHUNK_WORDS, session.pendingWords.length); i++) {
                const testChunk = session.pendingWords.slice(0, i).join(' ');
                if (this.breakPoints.test(testChunk) || this.sentenceEndings.test(testChunk)) {
                    chunkSize = i;
                    break;
                }
                chunkSize = i; // Update size as we go
            }
            
            // Extract chunk words
            const chunkWords = session.pendingWords.splice(0, chunkSize);
            const chunkText = this.createChunk(chunkWords);
            
            // Check for duplicates (in case of repeated partial updates)
            const hash = this.hashText(chunkText);
            if (!session.spokenChunks.has(hash)) {
                session.spokenChunks.add(hash);
                session.lastChunkTime = Date.now();
                
                result.chunks.push({
                    text: chunkText,
                    sequence: ++session.sequenceNumber,
                    hash: hash,
                    wordCount: chunkWords.length
                });
                
                console.log(`⚡ [ULTRA] Chunk #${session.sequenceNumber} (${chunkWords.length} words): "${chunkText.substring(0, 40)}..."`);
            }
            
            // For final, process all remaining words
            if (!isFinal) break;
        }
        
        // If this is final and we still have pending words, flush them
        if (isFinal && session.pendingWords.length > 0) {
            const remainingText = this.createChunk(session.pendingWords);
            const hash = this.hashText(remainingText);
            
            if (!session.spokenChunks.has(hash)) {
                session.spokenChunks.add(hash);
                
                result.chunks.push({
                    text: remainingText,
                    sequence: ++session.sequenceNumber,
                    hash: hash,
                    wordCount: session.pendingWords.length
                });
                
                console.log(`⚡ [ULTRA-FINAL] Last chunk #${session.sequenceNumber}: "${remainingText.substring(0, 40)}..."`);
            }
            
            session.pendingWords = [];
        }
        
        return result;
    }
    
    /**
     * Clear session data
     */
    clearSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        this.sessions.delete(key);
        console.log(`🧹 [ULTRA] Cleared session ${key}`);
    }
    
    /**
     * Get session statistics
     */
    getStats(sessionId, language) {
        const session = this.getSession(sessionId, language);
        return {
            chunksGenerated: session.sequenceNumber,
            pendingWords: session.pendingWords.length,
            totalProcessed: session.lastProcessedLength
        };
    }
}

// Export singleton
export const ultraLowLatencyExtractor = new UltraLowLatencyExtractor();