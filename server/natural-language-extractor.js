/**
 * Natural Language Extractor for Low-Latency Conference Translation
 * Balances immediate response with natural-sounding speech by using linguistic boundaries
 */

import crypto from 'crypto';

export class NaturalLanguageExtractor {
    constructor() {
        // Configuration for natural speech with low latency
        this.MIN_CHUNK_WORDS = 5;     // Minimum for natural phrases
        this.IDEAL_CHUNK_WORDS = 8;   // Sweet spot for naturalness
        this.MAX_CHUNK_WORDS = 15;    // Maximum before forcing break
        this.INITIAL_DELAY_MS = 150;  // Small delay for first chunk to gather context
        this.SUBSEQUENT_DELAY_MS = 50; // Faster for following chunks
        
        // Linguistic markers for natural boundaries
        this.conjunctions = new Set(['and', 'or', 'but', 'yet', 'so', 'for', 'nor', 'as', 'when', 'while', 'where', 'if', 'that', 'which', 'who']);
        this.prepositions = new Set(['in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'out', 'off', 'over', 'under']);
        this.articles = new Set(['the', 'a', 'an']);
        
        // Punctuation patterns
        this.softBreaks = /[,;:\-–—]/g;  // Natural pause points
        this.hardBreaks = /[.!?]+\s*/g;  // Sentence endings
        
        // Session tracking
        this.sessions = new Map();
    }
    
    /**
     * Get or create session
     */
    getSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        if (!this.sessions.has(key)) {
            this.sessions.set(key, {
                processedChunks: new Set(),   // Hashes of processed chunks
                currentPhrase: [],             // Words building current phrase
                lastChunkTime: 0,              // Time of last chunk
                sequenceNumber: 0,             // Chunk sequence
                contextBuffer: [],             // Previous 2-3 words for context
                isFirstChunk: true,            // First chunk flag
                fullTranscript: '',           // Complete transcript so far
                lastProcessedIndex: 0         // Track processing position
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
     * Find the best linguistic boundary in a word array
     */
    findBestBoundary(words, startIdx = 0) {
        // Look for natural break points within ideal range
        let bestBoundary = -1;
        let bestScore = 0;
        
        // Search window
        const minBoundary = startIdx + this.MIN_CHUNK_WORDS;
        const maxBoundary = Math.min(startIdx + this.MAX_CHUNK_WORDS, words.length);
        const idealBoundary = startIdx + this.IDEAL_CHUNK_WORDS;
        
        for (let i = minBoundary; i <= maxBoundary && i <= words.length; i++) {
            let score = 0;
            const prevWord = words[i - 1]?.toLowerCase();
            const currentWord = words[i]?.toLowerCase();
            
            // Check if we're at the end
            if (i === words.length) {
                score = 100; // Highest score for complete phrase
            }
            // Check for punctuation
            else if (prevWord && /[,;:.!?]$/.test(prevWord)) {
                score = 90;
            }
            // Check for conjunction at next word (good break point)
            else if (currentWord && this.conjunctions.has(currentWord)) {
                score = 80;
            }
            // Check for preposition at next word
            else if (currentWord && this.prepositions.has(currentWord)) {
                score = 70;
            }
            // Avoid breaking before articles
            else if (currentWord && this.articles.has(currentWord)) {
                score = -50; // Negative score - bad break point
            }
            // Prefer breaks closer to ideal length
            else {
                const distanceFromIdeal = Math.abs(i - idealBoundary);
                score = 50 - (distanceFromIdeal * 5);
            }
            
            // Update best boundary
            if (score > bestScore) {
                bestScore = score;
                bestBoundary = i;
            }
        }
        
        // If no good boundary found, use ideal length
        if (bestBoundary === -1) {
            bestBoundary = Math.min(idealBoundary, words.length);
        }
        
        return bestBoundary;
    }
    
    /**
     * Add contextual smoothing to chunk
     */
    addContextualSmoothing(chunk, session) {
        // For first chunk, no prefix needed
        if (session.isFirstChunk) {
            session.isFirstChunk = false;
            return chunk;
        }
        
        // For subsequent chunks, check if we need transition words
        const firstWord = chunk.split(' ')[0]?.toLowerCase();
        
        // If chunk starts with conjunction/preposition, it's already smooth
        if (this.conjunctions.has(firstWord) || this.prepositions.has(firstWord)) {
            return chunk;
        }
        
        // Otherwise, add slight pause marker for TTS to handle transition
        // (This will be interpreted by TTS as a natural micro-pause)
        return chunk;
    }
    
    /**
     * Process text with natural language awareness
     */
    processText(sessionId, language, text, isFinal = false) {
        const session = this.getSession(sessionId, language);
        const result = {
            chunks: [],
            displayText: text
        };
        
        // Update full transcript
        session.fullTranscript = text;
        
        // Find new content since last processing
        if (text.length <= session.lastProcessedIndex) {
            return result; // No new content
        }
        
        const newContent = text.substring(session.lastProcessedIndex);
        const newWords = newContent.trim().split(/\s+/).filter(w => w.length > 0);
        
        if (newWords.length === 0) {
            return result;
        }
        
        // Add new words to current phrase
        session.currentPhrase.push(...newWords);
        session.lastProcessedIndex = text.length;
        
        const now = Date.now();
        const timeSinceLastChunk = now - session.lastChunkTime;
        
        // Determine if we should generate a chunk
        let shouldGenerate = false;
        let delay = session.isFirstChunk ? this.INITIAL_DELAY_MS : this.SUBSEQUENT_DELAY_MS;
        
        // Check conditions for chunk generation
        if (session.currentPhrase.length >= this.MIN_CHUNK_WORDS) {
            // Check if we've waited long enough
            if (timeSinceLastChunk >= delay) {
                shouldGenerate = true;
            }
            // Or if we have enough words for a natural phrase
            else if (session.currentPhrase.length >= this.IDEAL_CHUNK_WORDS) {
                shouldGenerate = true;
            }
            // Or if this is final and we have any words
            else if (isFinal && session.currentPhrase.length > 0) {
                shouldGenerate = true;
            }
        }
        // For final, always process remaining words
        else if (isFinal && session.currentPhrase.length > 0) {
            shouldGenerate = true;
        }
        
        // Generate chunks with natural boundaries
        while (shouldGenerate && session.currentPhrase.length > 0) {
            // Find best linguistic boundary
            const boundaryIdx = this.findBestBoundary(session.currentPhrase, 0);
            
            // Extract chunk at boundary
            const chunkWords = session.currentPhrase.splice(0, boundaryIdx);
            let chunkText = chunkWords.join(' ');
            
            // Add contextual smoothing
            chunkText = this.addContextualSmoothing(chunkText, session);
            
            // Check for duplicates
            const hash = this.hashText(chunkText);
            if (!session.processedChunks.has(hash)) {
                session.processedChunks.add(hash);
                session.lastChunkTime = now;
                
                // Update context buffer (last 2-3 words)
                session.contextBuffer = chunkWords.slice(-3);
                
                result.chunks.push({
                    text: chunkText,
                    sequence: ++session.sequenceNumber,
                    hash: hash,
                    wordCount: chunkWords.length,
                    isNaturalBoundary: true
                });
                
                console.log(`🌊 [NATURAL] Chunk #${session.sequenceNumber} (${chunkWords.length} words): "${chunkText.substring(0, 50)}..."`);
            }
            
            // Check if we should continue generating
            if (session.currentPhrase.length < this.MIN_CHUNK_WORDS && !isFinal) {
                shouldGenerate = false;
            }
        }
        
        return result;
    }
    
    /**
     * Clear session data
     */
    clearSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        this.sessions.delete(key);
        console.log(`🧹 [NATURAL] Cleared session ${key}`);
    }
    
    /**
     * Get session statistics
     */
    getStats(sessionId, language) {
        const session = this.getSession(sessionId, language);
        return {
            chunksGenerated: session.sequenceNumber,
            pendingWords: session.currentPhrase.length,
            isFirstChunk: session.isFirstChunk
        };
    }
}

// Export singleton
export const naturalLanguageExtractor = new NaturalLanguageExtractor();