/**
 * Punctuation Helper for Partial Transcripts
 * Adds intelligent punctuation to improve sentence extraction
 */

export class PunctuationHelper {
    constructor() {
        // Common sentence-ending patterns
        this.sentencePatterns = [
            // Question patterns
            { pattern: /^(what|where|when|who|why|how|could|would|should|can|will|do|does|did|is|are|am|was|were)\b/i, punctuation: '?' },
            // Greeting patterns
            { pattern: /^(hello|hi|hey|good morning|good afternoon|good evening)\b/i, punctuation: '.' },
            // Common complete phrases
            { pattern: /\b(thank you|thanks|please|yes|no|okay|alright|sure)\s*$/i, punctuation: '.' },
        ];
        
        // Track context for better punctuation
        this.sessionContext = new Map();
    }
    
    /**
     * Add intelligent punctuation to text
     */
    punctuate(text, sessionId = 'default', isFinal = false) {
        if (!text || text.trim().length === 0) return text;
        
        // Clean the text
        text = text.trim();
        
        // Check if already has ending punctuation
        if (/[.!?]$/.test(text)) {
            return text;
        }
        
        // Get session context
        let context = this.sessionContext.get(sessionId);
        if (!context) {
            context = { 
                wordCount: 0, 
                lastText: '',
                sentenceCount: 0 
            };
            this.sessionContext.set(sessionId, context);
        }
        
        // Count words
        const words = text.split(/\s+/);
        const wordCount = words.length;
        
        // For final transcripts, always add punctuation
        if (isFinal) {
            const punctuation = this.determinePunctuation(text);
            context.sentenceCount++;
            context.lastText = text;
            return text + punctuation;
        }
        
        // For partial transcripts, add punctuation if it looks complete
        if (this.looksComplete(text, wordCount)) {
            const punctuation = this.determinePunctuation(text);
            return text + punctuation;
        }
        
        // Update context
        context.wordCount = wordCount;
        context.lastText = text;
        
        return text;
    }
    
    /**
     * Determine if text looks like a complete sentence
     */
    looksComplete(text, wordCount) {
        // Check for common complete phrase endings
        if (/\b(today|yesterday|tomorrow|now|later|soon|already|yet|too|also|well|much|lot|enough)\s*$/i.test(text)) {
            return wordCount >= 4;
        }
        
        // Check for subject-verb-object patterns
        if (wordCount >= 5) {
            // Has both subject pronouns and verbs
            const hasSubject = /\b(i|you|he|she|it|we|they|this|that)\b/i.test(text);
            const hasVerb = /\b(is|are|am|was|were|have|has|had|do|does|did|will|would|could|should|can|want|need|like|think|know|see|say|go|get|make|take)\b/i.test(text);
            
            if (hasSubject && hasVerb && wordCount >= 6) {
                return true;
            }
        }
        
        // Natural pause points (after 7+ words)
        if (wordCount >= 7) {
            // Check for conjunctions that might indicate sentence boundary
            if (/\b(but|however|although|though|because|since|while|after|before)\b/i.test(text)) {
                const lastWord = text.split(/\s+/).pop();
                // If the last word isn't a conjunction, might be end of sentence
                if (!/^(and|or|but|so|for|nor|yet)$/i.test(lastWord)) {
                    return true;
                }
            }
            return true;
        }
        
        return false;
    }
    
    /**
     * Determine appropriate punctuation
     */
    determinePunctuation(text) {
        const lowerText = text.toLowerCase();
        
        // Check question patterns
        for (const { pattern, punctuation } of this.sentencePatterns) {
            if (pattern.test(lowerText)) {
                return punctuation;
            }
        }
        
        // Check if it's likely a question based on structure
        if (/\b(what|where|when|who|why|how|could|would|should|can|will|shall|may|might)\b.*\b(you|i|we|they|he|she|it)\b/i.test(text)) {
            return '?';
        }
        
        // Check for exclamation patterns
        if (/\b(wow|amazing|incredible|fantastic|great|awesome|terrible|horrible|oh no|oh my)\b/i.test(lowerText)) {
            return '!';
        }
        
        // Default to period
        return '.';
    }
    
    /**
     * Clear session context
     */
    clearSession(sessionId) {
        this.sessionContext.delete(sessionId);
    }
}

// Export singleton
export const punctuationHelper = new PunctuationHelper();