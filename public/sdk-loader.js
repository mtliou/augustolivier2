// Azure Speech SDK Loader
(function() {
    // Load the Azure Speech SDK via local proxy to avoid extension/CDN blocking
    function loadSpeechSDKFrom(url, onErrorFallback) {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = function() {
            console.log('Azure Speech SDK loaded successfully from', url);
            if (typeof Microsoft !== 'undefined' && Microsoft.CognitiveServices && Microsoft.CognitiveServices.Speech) {
                window.SpeechSDK = Microsoft.CognitiveServices.Speech;
            }
            window.speechSDKLoaded = true;
            window.dispatchEvent(new Event('speechSDKReady'));
        };
        script.onerror = function() {
            console.error('Failed to load Azure Speech SDK from', url);
            if (onErrorFallback) onErrorFallback();
        };
        document.head.appendChild(script);
    }

    // Try local proxy first, fallback to CDN
    loadSpeechSDKFrom('/sdk/speech.js', () => {
        loadSpeechSDKFrom('https://aka.ms/csspeech/jsbrowserpackageraw');
    });
    
    // Helper function to ensure SDK is loaded
    window.ensureSDKLoaded = function() {
        return new Promise((resolve, reject) => {
            if (window.SpeechSDK) {
                resolve();
            } else if (window.speechSDKLoaded) {
                // SDK is loaded but not yet available
                setTimeout(() => resolve(), 100);
            } else {
                // Wait for SDK to load
                window.addEventListener('speechSDKReady', resolve);
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    reject(new Error('Speech SDK failed to load after 10 seconds'));
                }, 10000);
            }
        });
    };
})();