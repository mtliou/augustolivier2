/**
 * Streaming Sentence Extractor for Simultaneous Translation
 * 
 * APPROACH: Only extract sentences from FINAL results to avoid repetition
 * Partials are used only for display, not for TTS generation
 */

export class StreamingSentenceExtractor {
    constructor() {
        // Track completed sentences per session to avoid any duplicates
        this.completedSentences = new Map(); // key -> Set of sentences
        
        // Track the last final text we processed
        this.lastFinalText = new Map(); // key -> last final text
        
        // Sentence-ending patterns
        this.sentenceEndings = /[.!?]+\s*/g;
        
        // Common abbreviations that aren't sentence endings
        this.abbreviations = new Set([
            'Mr.', 'Mrs.', 'Dr.', 'Prof.', 'Sr.', 'Jr.',
            'Inc.', 'Corp.', 'Co.', 'Ltd.', 'LLC.',
            'U.S.', 'U.K.', 'E.U.', 'U.N.',
            'etc.', 'vs.', 'i.e.', 'e.g.'
        ]);
    }

    /**
     * Process transcript for TTS generation
     * CRITICAL: Only processes FINAL transcripts to avoid repetition
     * 
     * @param {string} sessionId - Session identifier
     * @param {string} language - Language code
     * @param {string} text - Transcript text
     * @param {boolean} isFinal - Whether this is a final transcript
     * @returns {Object} { sentences: [], shouldGenerateTTS: boolean }
     */
    processTranscript(sessionId, language, text, isFinal) {
        const key = `${sessionId}:${language}`;
        
        // Initialize tracking if needed
        if (!this.completedSentences.has(key)) {
            this.completedSentences.set(key, new Set());
            this.lastFinalText.set(key, '');
        }
        
        // CRITICAL: Only process FINAL results for TTS
        if (!isFinal) {
            console.log(`⏸️ Partial [${language}]: "${text}" - waiting for final`);
            return { 
                sentences: [], 
                shouldGenerateTTS: false,
                displayText: text // Still return text for display
            };
        }
        
        console.log(`✅ Final [${language}]: "${text}"`);
        
        const completedSet = this.completedSentences.get(key);
        const lastFinal = this.lastFinalText.get(key);
        
        // Check if this final is actually different from the last final
        if (text === lastFinal) {
            console.log(`⏭️ Duplicate final, skipping`);
            return { sentences: [], shouldGenerateTTS: false };
        }
        
        // Update last final
        this.lastFinalText.set(key, text);
        
        // Extract ALL complete sentences from the final text
        const sentences = this.extractCompleteSentences(text);
        const newSentences = [];
        
        // Filter out any sentences we've already spoken
        for (const sentence of sentences) {
            const normalized = sentence.trim().toLowerCase();
            
            // Check for exact duplicates
            let isDuplicate = false;
            for (const completed of completedSet) {
                const completedNorm = completed.toLowerCase();
                
                // Check for exact match or substring (one contains the other)
                if (normalized === completedNorm || 
                    normalized.includes(completedNorm) || 
                    completedNorm.includes(normalized)) {
                    isDuplicate = true;
                    console.log(`⏭️ Skipping duplicate: "${sentence}"`);
                    break;
                }
            }
            
            if (!isDuplicate) {
                newSentences.push(sentence);
                completedSet.add(sentence.trim());
                console.log(`🎯 New sentence for TTS [${language}]: "${sentence}"`);
            }
        }
        
        return {
            sentences: newSentences,
            shouldGenerateTTS: newSentences.length > 0,
            displayText: text
        };
    }
    
    /**
     * Extract complete sentences from text
     */
    extractCompleteSentences(text) {
        if (!text) return [];
        
        const sentences = [];
        const parts = text.split(this.sentenceEndings);
        
        let currentSentence = '';
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;
            
            currentSentence += part;
            
            // Check if this ends with punctuation
            const nextChar = text[text.indexOf(part) + part.length];
            if (nextChar && '.!?'.includes(nextChar)) {
                currentSentence += nextChar;
                
                // Check if it's a real sentence ending (not abbreviation)
                if (this.isCompleteSentence(currentSentence)) {
                    sentences.push(currentSentence.trim());
                    currentSentence = '';
                }
            }
        }
        
        return sentences;
    }
    
    /**
     * Check if text is a complete sentence
     */
    isCompleteSentence(text) {
        // Check for abbreviations
        for (const abbr of this.abbreviations) {
            if (text.endsWith(abbr)) {
                return false;
            }
        }
        
        // Must have at least 3 words
        const words = text.trim().split(/\s+/);
        if (words.length < 3) {
            return false;
        }
        
        // Must end with sentence punctuation
        return /[.!?]$/.test(text.trim());
    }
    
    /**
     * Clear session data
     */
    clearSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        this.completedSentences.delete(key);
        this.lastFinalText.delete(key);
        console.log(`🧹 Cleared session ${key}`);
    }
    
    /**
     * Get statistics for debugging
     */
    getStats(sessionId, language) {
        const key = `${sessionId}:${language}`;
        const completed = this.completedSentences.get(key);
        return {
            completedCount: completed ? completed.size : 0,
            lastFinal: this.lastFinalText.get(key) || ''
        };
    }
}

// Export singleton instance
export const streamingSentenceExtractor = new StreamingSentenceExtractor();