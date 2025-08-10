/**
 * Conference-Optimized Sentence Extractor
 * Prevents duplicate TTS generation and ensures natural segment lengths
 */

import crypto from 'crypto';

export class ConferenceSentenceExtractor {
    constructor() {
        // Configuration for conference scenarios
        this.MIN_SENTENCE_LENGTH = 10; // Minimum words for natural speech
        this.STABILITY_THRESHOLD = 1; // Generate TTS after 1 appearance
        this.STABILITY_TIME_MS = 150; // Fast response for conferences
        this.SIMILARITY_THRESHOLD = 0.85; // 85% similarity = duplicate
        
        // Session tracking
        this.sessions = new Map();
        
        // Sentence patterns
        this.sentenceEndings = /[.!?]+\s*/g;
        this.abbreviations = new Set([
            'Mr.', 'Mrs.', 'Dr.', 'Prof.', 'Inc.', 'Corp.', 
            'U.S.', 'U.K.', 'etc.', 'vs.', 'i.e.', 'e.g.'
        ]);
    }
    
    /**
     * Get or create session
     */
    getSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        if (!this.sessions.has(key)) {
            this.sessions.set(key, {
                spokenText: new Set(),        // Exact text already spoken
                spokenHashes: new Set(),      // Hashes of spoken content
                spokenPrefixes: new Map(),    // Track sentence beginnings to prevent duplicates
                currentBuffer: '',            // Buffer for accumulating text
                lastProcessedIndex: 0,        // Track position in stream
                sequenceNumber: 0             // Track order of segments
            });
        }
        return this.sessions.get(key);
    }
    
    /**
     * Calculate hash for deduplication
     */
    hashText(text) {
        const normalized = this.normalizeText(text);
        return crypto.createHash('sha256')
            .update(normalized)
            .digest('hex')
            .substring(0, 16);
    }
    
    /**
     * Normalize text for comparison
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')  // Remove punctuation
            .replace(/\s+/g, ' ')       // Normalize whitespace
            .trim();
    }
    
    /**
     * Calculate similarity between two texts
     */
    calculateSimilarity(text1, text2) {
        const norm1 = this.normalizeText(text1);
        const norm2 = this.normalizeText(text2);
        
        // Quick check for substring relationship
        if (norm1.includes(norm2) || norm2.includes(norm1)) {
            return 1.0; // Consider as duplicate if one contains the other
        }
        
        // Token-based similarity
        const tokens1 = new Set(norm1.split(' '));
        const tokens2 = new Set(norm2.split(' '));
        
        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);
        
        return intersection.size / union.size;
    }
    
    /**
     * Check if text has already been spoken or is too similar
     */
    isDuplicate(session, text) {
        const normalized = this.normalizeText(text);
        const hash = this.hashText(text);
        
        // Check exact hash match
        if (session.spokenHashes.has(hash)) {
            return true;
        }
        
        // Check if this is a prefix of something already spoken
        for (const spoken of session.spokenText) {
            if (spoken.startsWith(text) || text.startsWith(spoken)) {
                return true;
            }
            
            // Check similarity
            const similarity = this.calculateSimilarity(text, spoken);
            if (similarity >= this.SIMILARITY_THRESHOLD) {
                return true;
            }
        }
        
        // Check against prefix map (prevents "Oh, comment..." being said multiple times)
        const firstWords = normalized.split(' ').slice(0, 5).join(' ');
        if (session.spokenPrefixes.has(firstWords)) {
            const previousLength = session.spokenPrefixes.get(firstWords);
            if (text.length <= previousLength * 1.2) {
                // If the new text is not significantly longer, it's a duplicate
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Extract complete, natural sentences from text
     */
    extractSentences(text) {
        const sentences = [];
        const matches = text.match(/[^.!?]+[.!?]+/g) || [];
        
        for (const match of matches) {
            const sentence = match.trim();
            
            // Skip abbreviations and short fragments
            let isAbbreviation = false;
            for (const abbr of this.abbreviations) {
                if (sentence.endsWith(abbr)) {
                    isAbbreviation = true;
                    break;
                }
            }
            
            if (!isAbbreviation) {
                const wordCount = sentence.split(/\s+/).length;
                if (wordCount >= 5) {  // Minimum 5 words for natural speech
                    sentences.push(sentence);
                }
            }
        }
        
        return sentences;
    }
    
    /**
     * Process incoming text and extract unique sentences for TTS
     */
    processText(sessionId, language, text, isFinal = false) {
        const session = this.getSession(sessionId, language);
        const result = {
            sentences: [],
            displayText: text
        };
        
        // For finals, extract complete sentences
        if (isFinal) {
            const sentences = this.extractSentences(text);
            
            for (const sentence of sentences) {
                // Check if this sentence has already been spoken
                if (!this.isDuplicate(session, sentence)) {
                    // Mark as spoken immediately to prevent duplicates
                    const hash = this.hashText(sentence);
                    session.spokenHashes.add(hash);
                    session.spokenText.add(sentence);
                    
                    // Track prefix to prevent similar sentences
                    const normalized = this.normalizeText(sentence);
                    const firstWords = normalized.split(' ').slice(0, 5).join(' ');
                    session.spokenPrefixes.set(firstWords, sentence.length);
                    
                    result.sentences.push({
                        text: sentence,
                        sequence: ++session.sequenceNumber,
                        hash: hash
                    });
                    
                    console.log(`✅ [CONF] New sentence #${session.sequenceNumber}: "${sentence.substring(0, 40)}..."`);
                }
            }
        } else {
            // For partials, accumulate but don't generate TTS yet
            session.currentBuffer = text;
        }
        
        return result;
    }
    
    /**
     * Clear session data
     */
    clearSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        this.sessions.delete(key);
        console.log(`🧹 [CONF] Cleared session ${key}`);
    }
    
    /**
     * Get session statistics
     */
    getStats(sessionId, language) {
        const session = this.getSession(sessionId, language);
        return {
            spokenCount: session.spokenText.size,
            sequenceNumber: session.sequenceNumber,
            bufferLength: session.currentBuffer.length
        };
    }
}

// Export singleton
export const conferenceSentenceExtractor = new ConferenceSentenceExtractor();