/**
 * Hybrid Translation System Configuration
 * Fine-tune performance parameters per language and use case
 */

export const hybridConfig = {
    // Global settings
    global: {
        enabled: true,                    // Enable hybrid mode globally
        displayPartials: true,            // Show partials immediately
        audioOnStable: true,             // Generate audio for stable sentences
        debug: process.env.DEBUG === 'true'
    },
    
    // Stability detection parameters
    stability: {
        default: {
            threshold: 2,                 // Appearances needed for stability
            timeWindowMs: 500,           // Time window for stability
            cleanupMs: 2000,             // Remove old sentences after this time
            minSentenceLength: 3,        // Minimum characters for valid sentence
            maxRevisionMs: 1000          // Max time to detect revisions
        },
        
        // Language-specific overrides
        languages: {
            'en': {
                threshold: 2,             // English has good punctuation
                timeWindowMs: 400
            },
            'es': {
                threshold: 2,             // Spanish has clear boundaries
                timeWindowMs: 500
            },
            'fr': {
                threshold: 2,             // French is similar
                timeWindowMs: 500
            },
            'ja': {
                threshold: 3,             // Japanese needs more confirmations
                timeWindowMs: 700,
                minSentenceLength: 2      // Shorter valid sentences
            },
            'zh': {
                threshold: 3,             // Chinese also needs more
                timeWindowMs: 700,
                minSentenceLength: 2
            },
            'ar': {
                threshold: 3,             // Arabic RTL considerations
                timeWindowMs: 600
            }
        }
    },
    
    // Confidence calculation weights
    confidence: {
        weights: {
            appearanceCount: 0.5,         // 50% weight on count
            timePersistence: 0.3,         // 30% weight on time alive
            completeness: 0.2             // 20% weight on punctuation
        },
        
        // Thresholds for confidence levels
        levels: {
            high: 0.7,                    // >= 70% confidence
            medium: 0.4,                  // >= 40% confidence
            low: 0.0                      // < 40% confidence
        }
    },
    
    // Performance optimizations
    performance: {
        maxSentenceHistory: 100,          // Max sentences to track per session
        maxQueueSize: 50,                 // Max audio queue size
        batchTranslations: true,          // Batch translation requests
        cacheTranslations: true,          // Cache repeated translations
        cacheTTLMs: 60000,                // Cache TTL (1 minute)
        
        // Throttling
        throttle: {
            enabled: true,
            minIntervalMs: 100,           // Min time between partials
            maxPartialsPerSecond: 10      // Rate limit partials
        }
    },
    
    // Audio generation settings
    audio: {
        format: 'mp3',                    // Audio format
        quality: 'balanced',              // balanced, high, low
        streamingEnabled: true,           // Enable streaming TTS
        preloadNext: true,                // Preload next sentence
        maxConcurrent: 3,                 // Max concurrent TTS requests
        
        // Voice settings per language
        voices: {
            'en-US': 'en-US-JennyNeural',
            'es-ES': 'es-ES-ElviraNeural',
            'fr-FR': 'fr-FR-DeniseNeural',
            'de-DE': 'de-DE-KatjaNeural',
            'zh-CN': 'zh-CN-XiaoxiaoNeural',
            'ja-JP': 'ja-JP-NanamiNeural',
            'ar-SA': 'ar-SA-ZariyahNeural',
            'pt-BR': 'pt-BR-FranciscaNeural',
            'ru-RU': 'ru-RU-SvetlanaNeural',
            'ko-KR': 'ko-KR-SunHiNeural'
        }
    },
    
    // Monitoring and metrics
    monitoring: {
        enabled: true,
        logLevel: 'info',                 // debug, info, warn, error
        metricsInterval: 5000,            // Report metrics every 5s
        
        // Alerts
        alerts: {
            highLatencyMs: 500,           // Alert if latency > 500ms
            lowConfidence: 0.3,           // Alert if confidence < 30%
            queueBacklog: 10              // Alert if queue > 10 items
        }
    },
    
    // Experimental features
    experimental: {
        predictiveStability: false,       // ML-based stability prediction
        contextualGrouping: false,        // Group related sentences
        speakerAdaptation: false,        // Adapt to speaker patterns
        parallelProcessing: true,         // Process languages in parallel
        smartRevisionDetection: true     // Enhanced revision detection
    }
};

/**
 * Get configuration for a specific language
 */
export function getLanguageConfig(langCode) {
    const baseConfig = hybridConfig.stability.default;
    const langOverrides = hybridConfig.stability.languages[langCode] || {};
    
    return {
        ...baseConfig,
        ...langOverrides
    };
}

/**
 * Get voice for a language
 */
export function getVoiceForLanguage(langCode) {
    // Handle both short (es) and full (es-ES) language codes
    const voices = hybridConfig.audio.voices;
    
    // Try exact match first
    if (voices[langCode]) {
        return voices[langCode];
    }
    
    // Try to find a match with the base language
    const baseLang = langCode.split('-')[0];
    for (const [code, voice] of Object.entries(voices)) {
        if (code.startsWith(baseLang)) {
            return voice;
        }
    }
    
    // Default to English
    return voices['en-US'];
}

/**
 * Check if hybrid mode is enabled
 */
export function isHybridEnabled() {
    return hybridConfig.global.enabled;
}

/**
 * Get performance settings
 */
export function getPerformanceSettings() {
    return hybridConfig.performance;
}

export default hybridConfig;