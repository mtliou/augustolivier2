/**
 * Comprehensive Test Suite for Hybrid Translation System
 * Tests various speech patterns and edge cases
 */

import { io } from 'socket.io-client';

class HybridSystemTester {
    constructor() {
        this.serverUrl = 'http://localhost:8080';
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }
    
    /**
     * Connect as speaker and listener
     */
    async setupSession(sessionCode, sourceLang, targetLangs) {
        return new Promise((resolve) => {
            const speaker = io(this.serverUrl);
            const listener = io(this.serverUrl);
            
            let speakerReady = false;
            let listenerReady = false;
            
            speaker.on('connect', () => {
                speaker.emit('streaming-speaker-join', {
                    sessionCode,
                    sourceLang,
                    targetLangs
                });
            });
            
            speaker.on('joined', () => {
                speakerReady = true;
                if (speakerReady && listenerReady) {
                    resolve({ speaker, listener });
                }
            });
            
            listener.on('connect', () => {
                listener.emit('streaming-listener-join', {
                    sessionCode,
                    preferredLanguage: targetLangs[0]
                });
            });
            
            listener.on('joined', () => {
                listenerReady = true;
                if (speakerReady && listenerReady) {
                    resolve({ speaker, listener });
                }
            });
        });
    }
    
    /**
     * Test 1: Simple sentence with progressive partials
     */
    async testProgressiveSentence() {
        console.log('\n📝 Test 1: Progressive Sentence Building');
        
        const sessionCode = 'TST1';
        const { speaker, listener } = await this.setupSession(sessionCode, 'en-US', ['es']);
        
        const audioReceived = [];
        const translationUpdates = [];
        
        listener.on('translation-update', (data) => {
            translationUpdates.push(data);
        });
        
        listener.on('audio-stream', (data) => {
            audioReceived.push(data.text);
            console.log(`  🔊 Audio generated: "${data.text}" (confidence: ${data.confidence})`);
        });
        
        // Simulate progressive sentence building
        const partials = [
            "Hello",
            "Hello everyone",
            "Hello everyone.",
            "Hello everyone. Welcome",
            "Hello everyone. Welcome to",
            "Hello everyone. Welcome to the",
            "Hello everyone. Welcome to the meeting.",
            "Hello everyone. Welcome to the meeting."
        ];
        
        for (let i = 0; i < partials.length; i++) {
            speaker.emit('translation-stream', {
                sessionCode,
                original: partials[i],
                translated: { es: `Hola${i < 3 ? '' : ' a todos.'}${i >= 3 ? ' Bienvenidos' : ''}${i >= 6 ? ' a la reunión.' : ''}` },
                isFinal: i === partials.length - 1,
                timestamp: Date.now(),
                offset: i * 500,
                duration: 500
            });
            await this.delay(100);
        }
        
        await this.delay(1000);
        
        // Verify results
        const passed = (
            translationUpdates.length === partials.length &&
            audioReceived.length > 0 &&
            audioReceived.length <= 2 // Should generate 1-2 audio segments
        );
        
        this.logResult('Progressive Sentence', passed, {
            updates: translationUpdates.length,
            audio: audioReceived.length,
            sentences: audioReceived
        });
        
        speaker.disconnect();
        listener.disconnect();
        
        return passed;
    }
    
    /**
     * Test 2: Continuous speech without pauses
     */
    async testContinuousSpeech() {
        console.log('\n📝 Test 2: Continuous Speech (No Pauses)');
        
        const sessionCode = 'TST2';
        const { speaker, listener } = await this.setupSession(sessionCode, 'en-US', ['es']);
        
        const audioReceived = [];
        const audioTimestamps = [];
        
        listener.on('audio-stream', (data) => {
            audioReceived.push(data.text);
            audioTimestamps.push(Date.now());
            console.log(`  🔊 Audio at ${Date.now()}: "${data.text?.substring(0, 40)}..."`);
        });
        
        // Simulate 30 seconds of continuous speech
        const speech = [
            "Good morning everyone.",
            "Good morning everyone. Today we'll discuss",
            "Good morning everyone. Today we'll discuss our quarterly",
            "Good morning everyone. Today we'll discuss our quarterly results.",
            "Good morning everyone. Today we'll discuss our quarterly results. First,",
            "Good morning everyone. Today we'll discuss our quarterly results. First, let me",
            "Good morning everyone. Today we'll discuss our quarterly results. First, let me share",
            "Good morning everyone. Today we'll discuss our quarterly results. First, let me share the highlights.",
            "Good morning everyone. Today we'll discuss our quarterly results. First, let me share the highlights. Revenue",
            "Good morning everyone. Today we'll discuss our quarterly results. First, let me share the highlights. Revenue increased",
            "Good morning everyone. Today we'll discuss our quarterly results. First, let me share the highlights. Revenue increased by",
            "Good morning everyone. Today we'll discuss our quarterly results. First, let me share the highlights. Revenue increased by twenty percent."
        ];
        
        const startTime = Date.now();
        
        for (let i = 0; i < speech.length; i++) {
            speaker.emit('translation-stream', {
                sessionCode,
                original: speech[i],
                translated: { es: this.translateToSpanish(speech[i]) },
                isFinal: false, // Never send finals to simulate continuous speech
                timestamp: Date.now(),
                offset: i * 500,
                duration: 500
            });
            await this.delay(200); // Fast partials
        }
        
        await this.delay(2000);
        
        const elapsedTime = Date.now() - startTime;
        
        // Verify progressive audio generation
        const passed = (
            audioReceived.length >= 2 && // Should generate multiple audio segments
            audioTimestamps.length > 0 &&
            audioTimestamps[0] - startTime < 3000 // First audio within 3 seconds
        );
        
        this.logResult('Continuous Speech', passed, {
            totalTime: `${(elapsedTime / 1000).toFixed(1)}s`,
            audioSegments: audioReceived.length,
            firstAudioDelay: audioTimestamps[0] ? `${audioTimestamps[0] - startTime}ms` : 'N/A'
        });
        
        speaker.disconnect();
        listener.disconnect();
        
        return passed;
    }
    
    /**
     * Test 3: Speech with revisions
     */
    async testSpeechRevisions() {
        console.log('\n📝 Test 3: Speech Revisions');
        
        const sessionCode = 'TST3';
        const { speaker, listener } = await this.setupSession(sessionCode, 'en-US', ['es']);
        
        const audioReceived = [];
        
        listener.on('audio-stream', (data) => {
            audioReceived.push(data.text);
            console.log(`  🔊 Audio: "${data.text}"`);
        });
        
        // Simulate speech with revision
        const partials = [
            "The cat",
            "The cat is",
            "The cats", // Revision: cat -> cats
            "The cats are",
            "The cats are playing",
            "The cats are playing in",
            "The cats are playing in the",
            "The cats are playing in the garden."
        ];
        
        for (let i = 0; i < partials.length; i++) {
            speaker.emit('translation-stream', {
                sessionCode,
                original: partials[i],
                translated: { es: this.translateToSpanish(partials[i]) },
                isFinal: i === partials.length - 1,
                timestamp: Date.now(),
                offset: i * 300,
                duration: 300
            });
            await this.delay(150);
        }
        
        await this.delay(1000);
        
        // Should only play the corrected version
        const passed = (
            audioReceived.length === 1 &&
            audioReceived[0].includes('gatos') && // Spanish for cats (plural)
            !audioReceived[0].includes('gato ') // Not singular
        );
        
        this.logResult('Speech Revisions', passed, {
            audioCount: audioReceived.length,
            finalAudio: audioReceived[0] || 'None'
        });
        
        speaker.disconnect();
        listener.disconnect();
        
        return passed;
    }
    
    /**
     * Test 4: Multiple sentences in one partial
     */
    async testMultipleSentences() {
        console.log('\n📝 Test 4: Multiple Sentences');
        
        const sessionCode = 'TST4';
        const { speaker, listener } = await this.setupSession(sessionCode, 'en-US', ['es']);
        
        const audioReceived = [];
        
        listener.on('audio-stream', (data) => {
            audioReceived.push(data.text);
            console.log(`  🔊 Audio: "${data.text?.substring(0, 40)}..."`);
        });
        
        // Send multiple sentences at once
        const text = "Hello. How are you? I'm fine, thank you.";
        
        // Simulate partials building up
        const partials = [
            "Hello.",
            "Hello. How are",
            "Hello. How are you?",
            "Hello. How are you? I'm",
            "Hello. How are you? I'm fine,",
            "Hello. How are you? I'm fine, thank you."
        ];
        
        for (let i = 0; i < partials.length; i++) {
            speaker.emit('translation-stream', {
                sessionCode,
                original: partials[i],
                translated: { es: this.translateToSpanish(partials[i]) },
                isFinal: i === partials.length - 1,
                timestamp: Date.now(),
                offset: i * 200,
                duration: 200
            });
            await this.delay(100);
        }
        
        await this.delay(1500);
        
        // Should generate audio for each complete sentence
        const passed = audioReceived.length >= 2 && audioReceived.length <= 3;
        
        this.logResult('Multiple Sentences', passed, {
            audioSegments: audioReceived.length,
            sentences: audioReceived
        });
        
        speaker.disconnect();
        listener.disconnect();
        
        return passed;
    }
    
    /**
     * Test 5: Long pause handling
     */
    async testLongPause() {
        console.log('\n📝 Test 5: Long Pause Handling');
        
        const sessionCode = 'TST5';
        const { speaker, listener } = await this.setupSession(sessionCode, 'en-US', ['es']);
        
        const audioReceived = [];
        const audioTimestamps = [];
        
        listener.on('audio-stream', (data) => {
            audioReceived.push(data.text);
            audioTimestamps.push(Date.now());
            console.log(`  🔊 Audio at +${Date.now() - startTime}ms: "${data.text}"`);
        });
        
        const startTime = Date.now();
        
        // First sentence
        speaker.emit('translation-stream', {
            sessionCode,
            original: "I think",
            translated: { es: "Creo que" },
            isFinal: false,
            timestamp: Date.now()
        });
        
        await this.delay(300);
        
        speaker.emit('translation-stream', {
            sessionCode,
            original: "I think this",
            translated: { es: "Creo que esto" },
            isFinal: false,
            timestamp: Date.now()
        });
        
        // Long pause (3 seconds)
        await this.delay(3000);
        
        // Continue after pause
        speaker.emit('translation-stream', {
            sessionCode,
            original: "I think this is working.",
            translated: { es: "Creo que esto está funcionando." },
            isFinal: true,
            timestamp: Date.now()
        });
        
        await this.delay(1000);
        
        // Should still generate audio despite pause
        const passed = audioReceived.length >= 1;
        
        this.logResult('Long Pause Handling', passed, {
            audioGenerated: audioReceived.length,
            timing: audioTimestamps.map(t => `+${t - startTime}ms`).join(', ')
        });
        
        speaker.disconnect();
        listener.disconnect();
        
        return passed;
    }
    
    /**
     * Helper: Simple Spanish translation
     */
    translateToSpanish(text) {
        const translations = {
            "Hello": "Hola",
            "Hello everyone": "Hola a todos",
            "Hello everyone.": "Hola a todos.",
            "Welcome": "Bienvenidos",
            "Welcome to the meeting": "Bienvenidos a la reunión",
            "Welcome to the meeting.": "Bienvenidos a la reunión.",
            "Good morning everyone.": "Buenos días a todos.",
            "Today we'll discuss": "Hoy discutiremos",
            "our quarterly results": "nuestros resultados trimestrales",
            "First, let me share": "Primero, déjenme compartir",
            "the highlights": "los aspectos destacados",
            "Revenue increased": "Los ingresos aumentaron",
            "by twenty percent": "en un veinte por ciento",
            "The cat": "El gato",
            "The cats": "Los gatos",
            "are playing": "están jugando",
            "in the garden": "en el jardín",
            "How are you?": "¿Cómo estás?",
            "I'm fine, thank you.": "Estoy bien, gracias.",
            "I think": "Creo que",
            "this is working": "esto está funcionando"
        };
        
        // Try exact match first
        if (translations[text]) {
            return translations[text];
        }
        
        // Build translation from parts
        let result = text;
        for (const [eng, esp] of Object.entries(translations)) {
            result = result.replace(eng, esp);
        }
        
        return result;
    }
    
    /**
     * Helper: Delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Helper: Log test result
     */
    logResult(testName, passed, details) {
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`  ${status}: ${testName}`);
        
        if (details) {
            Object.entries(details).forEach(([key, value]) => {
                console.log(`    ${key}: ${value}`);
            });
        }
        
        this.results.tests.push({ testName, passed, details });
        if (passed) {
            this.results.passed++;
        } else {
            this.results.failed++;
        }
    }
    
    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Hybrid Translation System Tests');
        console.log('==========================================');
        
        const tests = [
            () => this.testProgressiveSentence(),
            () => this.testContinuousSpeech(),
            () => this.testSpeechRevisions(),
            () => this.testMultipleSentences(),
            () => this.testLongPause()
        ];
        
        for (const test of tests) {
            try {
                await test();
                await this.delay(1000); // Pause between tests
            } catch (error) {
                console.error('Test error:', error);
                this.results.failed++;
            }
        }
        
        // Print summary
        console.log('\n==========================================');
        console.log('📊 Test Summary');
        console.log(`  Total Tests: ${this.results.passed + this.results.failed}`);
        console.log(`  ✅ Passed: ${this.results.passed}`);
        console.log(`  ❌ Failed: ${this.results.failed}`);
        console.log(`  Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
        
        // Exit with appropriate code
        process.exit(this.results.failed > 0 ? 1 : 0);
    }
}

// Run tests
const tester = new HybridSystemTester();
tester.runAllTests().catch(console.error);