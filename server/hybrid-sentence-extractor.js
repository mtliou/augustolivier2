/**
 * Hybrid Sentence Extractor for Low-Latency Translation
 *
 * APPROACH: Track sentence stability across partials
 * - Display all partials immediately (visual feedback)
 * - Generate TTS only for stable sentences (2+ appearances)
 * - Prevent repetition through hash-based deduplication
 */

import crypto from 'crypto';

export class HybridSentenceExtractor {
    constructor() {
        // Default configuration - optimized for low-latency conferences
        this.DEFAULT_THRESHOLD = 1;     // Reduced from 2 - faster TTS generation
        this.DEFAULT_TIME_MS = 200;     // Reduced from 600ms - much faster response
        this.CLEANUP_THRESHOLD_MS = 2000; // Remove old sentences after this time

        // Tracking structures per session
        this.sessions = new Map(); // sessionKey -> session data
        this.sessionParams = new Map(); // key -> { threshold, timeMs, phraseMode }

        // Sentence ending patterns
        this.sentencePatterns = /[.!?]+[\s\u200B]*/g;

        // Common abbreviations to ignore
        this.abbreviations = new Set([
            'Mr.', 'Mrs.', 'Dr.', 'Prof.', 'Sr.', 'Jr.',
            'Inc.', 'Corp.', 'Co.', 'Ltd.', 'LLC.',
            'U.S.', 'U.K.', 'E.U.', 'U.N.',
            'etc.', 'vs.', 'i.e.', 'e.g.'
        ]);
    }

    /**
     * Initialize or get session data
     */
    getSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        if (!this.sessions.has(key)) {
            this.sessions.set(key, {
                sentenceHistory: new Map(),     // sentence -> stability data
                playedSentences: new Set(),      // hashes of played sentences
                lastPartialText: '',             // last partial for comparison
                partialCount: 0,                 // counter for partials
                lastCleanup: Date.now()         // last cleanup time
            });
        }
        return this.sessions.get(key);
    }

    /**
     * Configure session parameters (adaptive)
     */
    setSessionParams(sessionId, language, params = {}) {
        const key = `${sessionId}:${language}`;
        const current = this.sessionParams.get(key) || {
            threshold: this.DEFAULT_THRESHOLD,
            timeMs: this.DEFAULT_TIME_MS,
            phraseMode: false
        };
        this.sessionParams.set(key, {
            ...current,
            ...params
        });
    }

    getSessionParams(sessionId, language) {
        const key = `${sessionId}:${language}`;
        if (!this.sessionParams.has(key)) {
            this.sessionParams.set(key, {
                threshold: this.DEFAULT_THRESHOLD,
                timeMs: this.DEFAULT_TIME_MS,
                phraseMode: false
            });
        }
        return this.sessionParams.get(key);
    }

    /**
     * Calculate hash for sentence deduplication
     */
    hashSentence(sentence) {
        return crypto.createHash('sha256')
            .update(sentence.trim().toLowerCase())
            .digest('hex')
            .substring(0, 16);
    }

    /**
     * Extract complete sentences from text
     */
    extractSentences(text) {
        if (!text) return [];

        const sentences = [];
        let lastIndex = 0;
        let match;

        // Reset regex state
        this.sentencePatterns.lastIndex = 0;

        while ((match = this.sentencePatterns.exec(text)) !== null) {
            const sentence = text.substring(lastIndex, match.index + match[0].length).trim();

            // Skip if it's just an abbreviation
            let isAbbreviation = false;
            for (const abbr of this.abbreviations) {
                if (sentence.endsWith(abbr)) {
                    isAbbreviation = true;
                    break;
                }
            }

            if (!isAbbreviation && sentence.length > 3) {
                sentences.push(sentence);
            }
            lastIndex = match.index + match[0].length;
        }

        return sentences;
    }

    /**
     * Calculate stability confidence score
     */
    calculateConfidence(count, timeAlive, hasEndPunctuation, params) {
        const threshold = params?.threshold ?? this.DEFAULT_THRESHOLD;
        const timeMs = params?.timeMs ?? this.DEFAULT_TIME_MS;
        // Weighted confidence calculation
        const countScore = Math.min(count / threshold, 1.0) * 0.5;
        const timeScore = Math.min(timeAlive / timeMs, 1.0) * 0.3;
        const completenessScore = hasEndPunctuation ? 0.2 : 0.1;
        return countScore + timeScore + completenessScore;
    }

    /**
     * Process partial transcript and determine stable sentences
     */
    processPartial(sessionId, language, text, isFinal = false) {
        const session = this.getSession(sessionId, language);
        const now = Date.now();
        const params = this.getSessionParams(sessionId, language);

        // Periodic cleanup of old sentences
        if (now - session.lastCleanup > this.CLEANUP_THRESHOLD_MS) {
            this.cleanupOldSentences(session, now);
            session.lastCleanup = now;
        }

        // Update partial count
        session.partialCount++;

        // Extract sentences from current partial (or phrases if phraseMode)
        const currentSentences = params.phraseMode ? this.extractPhrases(text) : this.extractSentences(text);
        const stableSentences = [];
        const result = {
            displayText: text,           // Always display immediately
            stableSentences: [],         // Sentences ready for TTS
            shouldGenerateTTS: false,    // Whether to generate TTS
            partialNumber: session.partialCount,
            isFinal: isFinal
        };

        // Track each sentence's stability
        for (const sentence of currentSentences) {
            const hash = this.hashSentence(sentence);

            // Skip if already played
            if (session.playedSentences.has(hash)) {
                continue;
            }

            // Update or create history entry
            if (!session.sentenceHistory.has(sentence)) {
                session.sentenceHistory.set(sentence, {
                    count: 1,
                    firstSeen: now,
                    lastSeen: now,
                    hash: hash,
                    hasEndPunctuation: /[.!?؟。！]$/.test(sentence.trim())
                });
            } else {
                const history = session.sentenceHistory.get(sentence);
                history.count++;
                history.lastSeen = now;

                // Check if sentence is stable
                const timeAlive = now - history.firstSeen;
                const confidence = this.calculateConfidence(
                    history.count,
                    timeAlive,
                    history.hasEndPunctuation,
                    params
                );

                // Determine if stable enough for TTS (adaptive)
                const isStable = (
                    history.count >= params.threshold ||
                    (isFinal && history.count >= 1) ||
                    (timeAlive > params.timeMs && history.count >= 2)
                );

                if (isStable && !session.playedSentences.has(hash)) {
                    stableSentences.push({
                        text: sentence,
                        confidence: confidence,
                        count: history.count,
                        timeAlive: timeAlive,
                        hash: hash
                    });

                    // Mark as played
                    session.playedSentences.add(hash);

                    console.log(`✅ [HYBRID] Stable ${params.phraseMode ? 'phrase' : 'sentence'} detected:
                        Text: "${sentence.substring(0, 50)}..."
                        Count: ${history.count}
                        Confidence: ${(confidence * 100).toFixed(1)}%
                        Time alive: ${timeAlive}ms`);
                }
            }
        }

        // Handle sentences that disappeared (possible revision)
        this.detectRevisions(session, currentSentences, now);

        // Update last partial
        session.lastPartialText = text;

        // Prepare result
        result.stableSentences = stableSentences;
        result.shouldGenerateTTS = stableSentences.length > 0;

        if (result.shouldGenerateTTS) {
            console.log(`🎯 [HYBRID] ${stableSentences.length} ${params.phraseMode ? 'phrases' : 'sentences'} ready for TTS`);
        }

        return result;
    }
    /**
     * Extract shorter phrases when in conference/phrase mode
     */
    extractPhrases(text) {
        if (!text) return [];
        // Split on commas or short pause markers; fallback to words if none
        const parts = text.split(/[,؛،]\s+|\s+-\s+|\s+—\s+/);
        const phrases = [];
        for (const p of parts) {
            const s = p.trim();
            if (s.length >= 6) {
                phrases.push(s);
            }
        }
        // If too long with no commas, fallback to chunk every ~7-10 words
        if (phrases.length === 0) {
            const words = text.trim().split(/\s+/);
            for (let i = 0; i < words.length; i += 8) {
                const chunk = words.slice(i, i + 8).join(' ');
                if (chunk.length >= 6) phrases.push(chunk);
            }
        }
        return phrases;
    }

    /**
     * Detect and handle sentence revisions
     */
    detectRevisions(session, currentSentences, now) {
        const currentSet = new Set(currentSentences);

        for (const [sentence, history] of session.sentenceHistory) {
            // If sentence hasn't appeared recently and isn't in current partial
            if (!currentSet.has(sentence) &&
                (now - history.lastSeen) > 1000 &&
                history.count < this.STABILITY_THRESHOLD) {

                // Likely a revision, remove from history
                session.sentenceHistory.delete(sentence);
                console.log(`🔄 [HYBRID] Detected revision, removing: "${sentence.substring(0, 30)}..."`);
            }
        }
    }

    /**
     * Clean up old sentence history to prevent memory growth
     */
    cleanupOldSentences(session, now) {
        for (const [sentence, history] of session.sentenceHistory) {
            if ((now - history.lastSeen) > this.CLEANUP_THRESHOLD_MS) {
                session.sentenceHistory.delete(sentence);
            }
        }
    }

    /**
     * Clear session data
     */
    clearSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        this.sessions.delete(key);
    }
}

// Export singleton instance
export const hybridSentenceExtractor = new HybridSentenceExtractor();