# Azure Real-Time Speech-to-Speech Translation System

A production-ready, real-time speech translation system that enables simultaneous translation across multiple languages with ultra-low latency (<200ms target). Built with Azure Cognitive Services, Node.js, and WebSockets.

## 🌟 Features

- **Real-time Speech Recognition**: Continuous speech-to-text using Azure Speech SDK
- **Instant Translation**: Multi-language translation via Azure Translator
- **Natural Voice Synthesis**: Text-to-speech in target languages using Azure TTS
- **WebSocket Communication**: Low-latency, real-time updates
- **Session-Based Architecture**: Simple 4-character codes for easy sharing
- **No Repetition**: Advanced deduplication ensures each sentence plays exactly once
- **Auto-Play Audio**: Smart audio handling that works across browsers

## 🏗️ Architecture

```
Speaker (Browser) → Azure STT → Server → Azure Translator → Listeners (Browser)
                                    ↓
                              Azure TTS → Audio Stream
```

### Key Components

- **Speaker Interface**: Captures speech, sends to server for translation
- **Listener Interface**: Receives translations, plays synthesized speech
- **WebSocket Server**: Manages sessions, orchestrates translation pipeline
- **Sentence Extractor**: Prevents repetition, ensures clean audio playback

## 📋 Prerequisites

- Node.js 18+ 
- Azure subscription with:
  - Speech Service
  - Translator Service
- Optional: Redis for caching

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone [your-repo-url]
cd azure-s2s-translation
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and add your Azure keys:

```bash
cp .env.example .env
```

Edit `.env`:
```env
SPEECH_KEY=your_azure_speech_key
SPEECH_REGION=eastus
TRANSLATOR_KEY=your_azure_translator_key
TRANSLATOR_REGION=eastus
```

### 3. Start the Server

```bash
npm run dev
```

Server will start at http://localhost:8080

### 4. Use the Application

1. **Speaker**: Open http://localhost:8080/speaker-streaming.html
   - Enter a 4-character session code (e.g., "TEST")
   - Select source language
   - Click "Start" and begin speaking

2. **Listeners**: Open http://localhost:8080/listener-streaming.html
   - Enter the same session code
   - Select preferred language
   - Click "Join Session"
   - Audio will play automatically!

## 🎯 What We Built & Fixed

### Original Challenges
1. **Sentence Repetition**: Partial transcripts caused the same sentence to play multiple times
2. **Audio Blocking**: Browsers block autoplay, requiring manual interaction
3. **Translation Timing**: Balancing speed vs. accuracy in real-time translation

### Our Solutions

#### 1. Sentence Repetition Fix
**Problem**: Evolving partial transcripts were treated as different sentences
```
"Hello" → plays
"Hello how are" → plays again
"Hello how are you?" → plays third time
```

**Solution**: Only generate audio from FINAL speech results
- Partials are displayed for visual feedback but never spoken
- Finals are processed once with strict deduplication
- Result: Each sentence plays exactly once

#### 2. Auto-Play Audio Fix
**Problem**: Modern browsers block audio autoplay for user protection

**Solution**: Aggressive unlock strategy
- Pre-enable audio on session join
- Attempt playback immediately when audio arrives
- Multiple fallback event listeners (click, keydown, touch)
- Clear visual feedback when interaction needed

#### 3. Optimized Translation Pipeline
- Parallel translation for multiple target languages
- Smart caching to reduce API calls
- Separate handling for partials (display) vs finals (audio)
- Sentence extraction for natural speech flow

## 📁 Project Structure

```
azure-s2s-translation/
├── server/
│   ├── index.js                      # Express server entry point
│   ├── websocket.js                  # WebSocket session management
│   ├── streaming-sentence-extractor.js # Deduplication & sentence extraction
│   ├── text-translator.js            # Azure Translator integration
│   ├── streaming-tts.js              # Text-to-speech synthesis
│   ├── token-route.js                # Azure Speech token endpoint
│   ├── performance-monitor.js        # Metrics & monitoring
│   └── punctuation-helper.js         # Text processing utilities
├── public/
│   ├── speaker-streaming.html        # Speaker interface (optimized)
│   ├── listener-streaming.html       # Listener interface (optimized)
│   ├── speaker.html                  # Original speaker interface
│   └── listener.html                 # Original listener interface
├── package.json
├── .env.example
└── README.md
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SPEECH_KEY` | Azure Speech Service key | Yes | - |
| `SPEECH_REGION` | Azure Speech region | Yes | - |
| `TRANSLATOR_KEY` | Azure Translator key | Yes | - |
| `TRANSLATOR_REGION` | Azure Translator region | Yes | - |
| `TRANSLATOR_ENDPOINT` | Translator API endpoint | No | https://api.cognitive.microsofttranslator.com |
| `REDIS_URL` | Redis connection URL | No | - |
| `PORT` | Server port | No | 8080 |

### Supported Languages

Default voice mappings:
- English (en-US): JennyNeural
- Spanish (es-ES): ElviraNeural
- French (fr-CA): SylvieNeural
- German (de-DE): KatjaNeural
- Chinese (zh-CN): XiaoxiaoNeural
- Japanese (ja-JP): NanamiNeural

## 🧪 Testing

### Test Scenarios

1. **Simple Sentence**: Say "Hello world" - should play once after completion
2. **Question**: Say "How are you?" - single playback, no repetition
3. **Multiple Sentences**: Say "Hello. My name is John. Nice to meet you." - three separate playbacks
4. **Long Pause**: Say "I think..." (pause) "...this is working" - plays complete sentence once

### Performance Metrics

- **Target Latency**: <200ms translation
- **Audio Latency**: <500ms from speech to playback
- **Deduplication**: 100% prevention of repeated sentences
- **Auto-play Success**: Works after first interaction

## 🐛 Troubleshooting

### Safari Connection Issues
- Use full URL with `http://` prefix
- Try `127.0.0.1` instead of `localhost`
- Clear Safari cache: Develop → Empty Caches
- Check security settings for localhost access

### Audio Not Playing
- Click anywhere on the page to unlock audio
- Check browser console for errors
- Ensure microphone permissions granted
- Verify Azure TTS service is configured

### High Latency
- Check network connection
- Verify Azure service regions are optimal
- Consider enabling Redis caching
- Monitor server performance metrics

## 📊 Performance Monitoring

The system includes built-in performance monitoring:

```javascript
// Access metrics at http://localhost:8080/api/metrics
{
  "translations": {
    "count": 150,
    "avgLatency": 187,
    "minLatency": 45,
    "maxLatency": 420
  },
  "connections": {
    "active": 5,
    "peak": 12
  }
}
```

## 🚢 Deployment

### Production Considerations

1. **Security**: 
   - Use HTTPS in production
   - Implement authentication for sessions
   - Rate limit API endpoints
   - Validate all inputs

2. **Scaling**:
   - Use Redis for session state
   - Implement load balancing
   - Consider horizontal scaling

3. **Monitoring**:
   - Set up application monitoring
   - Track Azure service usage
   - Monitor error rates

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 🙏 Acknowledgments

- Azure Cognitive Services for speech & translation APIs
- Socket.IO for real-time WebSocket communication
- The open-source community for inspiration and tools

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

Built with ❤️ for breaking language barriers in real-time communication.