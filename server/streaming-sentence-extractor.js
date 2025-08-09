/**
 * Streaming Sentence Extractor for Simultaneous Translation
 *
 * APPROACH: Only extract sentences from FINAL results to avoid repetition
 * Partials are used only for display, not for TTS generation
 */

export class StreamingSentenceExtractor {
    constructor() {
        // Track completed sentences per session to avoid any duplicates
        this.completedSentences = new Map(); // key -> Set of original sentences
        this.completedNormalized = new Map(); // key -> Set of normalized sentences (for fuzzy dedupe)

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

    /** Normalize for comparison: strip diacritics, punctuation; lowercase; collapse spaces */
    normalizeForCompare(text) {
        if (!text) return '';
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // remove diacritics
            .toLowerCase()
            .replace(/[^a-z0-9\s]/gi, ' ') // remove punctuation/symbols
            .replace(/\s+/g, ' ') // collapse whitespace
            .trim();
    }

    tokenize(text) {
        const norm = this.normalizeForCompare(text);
        if (!norm) return new Set();
        return new Set(norm.split(' ').filter(w => w && w.length > 1));
    }

    jaccard(a, b) {
        const inter = new Set();
        for (const t of a) if (b.has(t)) inter.add(t);
        const unionSize = a.size + b.size - inter.size;
        return unionSize === 0 ? 0 : inter.size / unionSize;
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
        const completedNormSet = this.completedNormalized.get(key) || new Set();
        this.completedNormalized.set(key, completedNormSet);
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
            const normalized = this.normalizeForCompare(sentence);

            // Check for exact duplicates or high-overlap duplicates
            let isDuplicate = false;
            for (const completed of completedSet) {
                const completedNorm = this.normalizeForCompare(completed);
                if (normalized === completedNorm) { isDuplicate = true; break; }
                // Substring containment in either direction (high overlap)
                if (normalized && completedNorm && (normalized.includes(completedNorm) || completedNorm.includes(normalized))) { isDuplicate = true; break; }
                // Token Jaccard similarity to avoid near-duplicates (>= 0.85)
                const a = this.tokenize(normalized);
                const b = this.tokenize(completedNorm);
                if (this.jaccard(a, b) >= 0.85) { isDuplicate = true; break; }
            }
            // Also check normalized set quickly
            if (!isDuplicate && completedNormSet.has(normalized)) {
                isDuplicate = true;
            }

            if (!isDuplicate) {
                newSentences.push(sentence);
                completedSet.add(sentence.trim());
                completedNormSet.add(normalized);
                console.log(`🎯 New sentence for TTS [${language}]: "${sentence}"`);
            } else {
                console.log(`⏭️ Skipping duplicate: "${sentence}"`);
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
        // Match sequences that end with sentence punctuation, including Arabic/Chinese variants
        const re = /[^.!?؟。！]+[.!?؟。！]+/g;
        const matches = text.match(re) || [];
        const sentences = [];
        for (const m of matches) {
            const s = m.trim();
            if (this.isCompleteSentence(s)) sentences.push(s);
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
     * Register a sentence as already spoken (to dedupe across pipelines)
     */
    registerSpoken(sessionId, language, sentence) {
        if (!sentence) return;
        const key = `${sessionId}:${language}`;
        if (!this.completedSentences.has(key)) {
            this.completedSentences.set(key, new Set());
            this.completedNormalized.set(key, new Set());
            this.lastFinalText.set(key, '');
        }
        this.completedSentences.get(key).add(sentence.trim());
        this.completedNormalized.get(key).add(this.normalizeForCompare(sentence));
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