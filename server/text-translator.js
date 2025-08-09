/**
 * Azure Translator Text API v3
 * Fallback translation when Speech SDK doesn't provide translations
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class TextTranslator {
    constructor() {
        // Try both naming conventions for environment variables
        this.endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT || process.env.TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';
        this.key = process.env.AZURE_TRANSLATOR_KEY || process.env.TRANSLATOR_KEY;
        this.region = process.env.AZURE_TRANSLATOR_REGION || process.env.TRANSLATOR_REGION || 'eastus';
        
        if (!this.key) {
            console.warn('⚠️ Azure Translator API key not configured - check AZURE_TRANSLATOR_KEY env variable');
        } else {
            console.log('✅ Azure Translator API configured');
        }
    }

    /**
     * Translate text to multiple target languages
     * @param {string} text - Text to translate
     * @param {string[]} targetLangs - Target language codes (e.g., ['es', 'fr', 'ar'])
     * @param {string} sourceLang - Source language code (optional)
     * @returns {Object} Translations keyed by language code
     */
    async translate(text, targetLangs, sourceLang = null) {
        if (!this.key || !text || targetLangs.length === 0) {
            return {};
        }

        try {
            // Build the request URL
            const params = new URLSearchParams({
                'api-version': '3.0',
                ...targetLangs.reduce((acc, lang) => ({...acc, to: lang}), {})
            });
            
            // Add 'to' parameter for each target language
            const toParams = targetLangs.map(lang => `to=${lang}`).join('&');
            const url = `${this.endpoint}/translate?api-version=3.0&${toParams}`;
            
            if (sourceLang) {
                params.append('from', sourceLang);
            }

            // Make the request
            const response = await axios({
                method: 'post',
                url: url,
                headers: {
                    'Ocp-Apim-Subscription-Key': this.key,
                    'Ocp-Apim-Subscription-Region': this.region,
                    'Content-Type': 'application/json',
                    'X-ClientTraceId': uuidv4()
                },
                data: [{
                    text: text
                }],
                timeout: 2000 // 2 second timeout for low latency
            });

            // Parse response
            const result = response.data[0];
            const translations = {};
            
            if (result && result.translations) {
                result.translations.forEach(trans => {
                    translations[trans.to] = trans.text;
                });
            }

            return translations;
            
        } catch (error) {
            console.error('Translation error:', error.response?.data || error.message);
            // Return original text as fallback
            const fallback = {};
            targetLangs.forEach(lang => {
                fallback[lang] = text;
            });
            return fallback;
        }
    }

    /**
     * Batch translate multiple texts
     * @param {string[]} texts - Array of texts to translate
     * @param {string[]} targetLangs - Target language codes
     * @param {string} sourceLang - Source language code (optional)
     * @returns {Array} Array of translation results
     */
    async batchTranslate(texts, targetLangs, sourceLang = null) {
        if (!this.key || texts.length === 0 || targetLangs.length === 0) {
            return texts.map(() => ({}));
        }

        try {
            const toParams = targetLangs.map(lang => `to=${lang}`).join('&');
            const url = `${this.endpoint}/translate?api-version=3.0&${toParams}`;

            const response = await axios({
                method: 'post',
                url: url,
                headers: {
                    'Ocp-Apim-Subscription-Key': this.key,
                    'Ocp-Apim-Subscription-Region': this.region,
                    'Content-Type': 'application/json',
                    'X-ClientTraceId': uuidv4()
                },
                data: texts.map(text => ({ text })),
                timeout: 3000
            });

            return response.data.map(result => {
                const translations = {};
                if (result && result.translations) {
                    result.translations.forEach(trans => {
                        translations[trans.to] = trans.text;
                    });
                }
                return translations;
            });
            
        } catch (error) {
            console.error('Batch translation error:', error.response?.data || error.message);
            // Return original texts as fallback
            return texts.map(text => {
                const fallback = {};
                targetLangs.forEach(lang => {
                    fallback[lang] = text;
                });
                return fallback;
            });
        }
    }

    /**
     * Detect language of text
     * @param {string} text - Text to detect language for
     * @returns {string} Detected language code
     */
    async detectLanguage(text) {
        if (!this.key || !text) {
            return 'en';
        }

        try {
            const url = `${this.endpoint}/detect?api-version=3.0`;

            const response = await axios({
                method: 'post',
                url: url,
                headers: {
                    'Ocp-Apim-Subscription-Key': this.key,
                    'Ocp-Apim-Subscription-Region': this.region,
                    'Content-Type': 'application/json',
                    'X-ClientTraceId': uuidv4()
                },
                data: [{ text }],
                timeout: 1000
            });

            if (response.data && response.data[0] && response.data[0].language) {
                return response.data[0].language;
            }
            
        } catch (error) {
            console.error('Language detection error:', error.message);
        }
        
        return 'en'; // Default to English
    }
}

// Singleton instance
let translatorInstance = null;

export function getTranslator() {
    if (!translatorInstance) {
        translatorInstance = new TextTranslator();
    }
    return translatorInstance;
}