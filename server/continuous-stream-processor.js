/**
 * Continuous Stream Processor for WebSocket TTS
 * Simply forwards text to WebSocket TTS without chunking
 * The WebSocket handles all audio generation continuously
 */

export class ContinuousStreamProcessor {
    constructor() {
        // Track what we've already sent per session
        this.sessions = new Map();
        
        // Minimum new content before sending (to avoid single character updates)
        this.MIN_NEW_CHARS = 3;
    }
    
    /**
     * Get or create session
     */
    getSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        if (!this.sessions.has(key)) {
            this.sessions.set(key, {
                lastSentLength: 0,      // Track how much we've sent
                fullText: '',            // Complete text so far
                lastUpdateTime: Date.now()
            });
        }
        return this.sessions.get(key);
    }
    
    /**
     * Process incoming text stream
     * Returns the new text to be sent to TTS
     */
    processText(sessionId, language, text, isFinal = false) {
        const session = this.getSession(sessionId, language);
        
        // Update full text
        session.fullText = text;
        
        // Calculate new content since last send
        const newContentLength = text.length - session.lastSentLength;
        
        // Determine what to send
        let textToSend = '';
        let shouldSend = false;
        
        if (newContentLength >= this.MIN_NEW_CHARS || isFinal) {
            // Get only the new portion
            textToSend = text.substring(session.lastSentLength);
            
            if (textToSend.trim().length > 0) {
                shouldSend = true;
                session.lastSentLength = text.length;
                session.lastUpdateTime = Date.now();
            }
        }
        
        return {
            shouldSend,
            textToSend,
            isFinal,
            totalLength: text.length,
            newChars: newContentLength
        };
    }
    
    /**
     * Clear session
     */
    clearSession(sessionId, language) {
        const key = `${sessionId}:${language}`;
        this.sessions.delete(key);
        console.log(`🧹 [CONTINUOUS] Cleared session ${key}`);
    }
    
    /**
     * Get session stats
     */
    getStats(sessionId, language) {
        const session = this.getSession(sessionId, language);
        return {
            totalCharsSent: session.lastSentLength,
            fullTextLength: session.fullText.length,
            pendingChars: session.fullText.length - session.lastSentLength
        };
    }
}

// Export singleton
export const continuousStreamProcessor = new ContinuousStreamProcessor();