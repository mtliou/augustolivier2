// Azure Speech SDK Loader
(function() {
    // Load the Azure Speech SDK from CDN
    const script = document.createElement('script');
    script.src = 'https://aka.ms/csspeech/jsbrowserpackageraw';
    script.onload = function() {
        console.log('Azure Speech SDK loaded successfully');
        window.SpeechSDK = Microsoft.CognitiveServices.Speech;
        
        // Mark SDK as loaded
        window.speechSDKLoaded = true;
        
        // Dispatch event to notify that SDK is ready
        window.dispatchEvent(new Event('speechSDKReady'));
    };
    script.onerror = function() {
        console.error('Failed to load Azure Speech SDK');
    };
    document.head.appendChild(script);
    
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