# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Architecture

This is a real-time speech-to-speech translation system built with Node.js/Express and Azure Cognitive Services. The system follows a session-based WebSocket architecture where speakers broadcast speech that gets translated and synthesized for listeners in real-time.

### Key Design Patterns

1. **Session-Based Architecture**: Uses 4-character codes for simple session management
2. **WebSocket Communication**: Socket.IO for real-time bidirectional communication
3. **Streaming Pipeline**: Speaker → STT → Translation → TTS → Listeners
4. **Deduplication Strategy**: Only processes FINAL speech results to prevent repetition

### Critical Business Logic

The **sentence repetition prevention** is critical - the system must only generate audio from FINAL speech results, never from partials. This is implemented in `streaming-sentence-extractor.js` and prevents the same sentence from playing multiple times as transcripts evolve.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 8080)
npm run dev

# Test Azure API keys configuration
npm run test:keys

# Test audio playback
npm run test:audio
```

## Required Environment Configuration

Create a `.env` file with Azure service credentials:
```
SPEECH_KEY=<Azure Speech Service key>
SPEECH_REGION=<Azure region, e.g., eastus>
TRANSLATOR_KEY=<Azure Translator key>
TRANSLATOR_REGION=<Azure region>
```

## Key Components & Their Responsibilities

### Server Components
- `server/index.js`: Express server entry point, route configuration
- `server/websocket.js`: WebSocket session management, translation orchestration
- `server/streaming-sentence-extractor.js`: **Critical** - Deduplication logic to prevent audio repetition
- `server/text-translator.js`: Azure Translator API integration for multi-language translation
- `server/streaming-tts.js`: Text-to-speech synthesis using Azure TTS
- `server/token-route.js`: Azure Speech SDK token generation endpoint
- `server/performance-monitor.js`: Metrics tracking and monitoring

### Client Interfaces
- `public/speaker-streaming.html`: Optimized speaker interface with continuous STT
- `public/listener-streaming.html`: Optimized listener interface with auto-play audio
- Original versions (`speaker.html`, `listener.html`) are preserved but not actively used

## WebSocket Event Flow

### Speaker Flow
1. `streaming-speaker-join`: Join session with source language
2. `translation-stream`: Send transcript with `{original, translated, isFinal, timestamp}`
3. Only `isFinal: true` messages trigger TTS generation

### Listener Flow  
1. `streaming-listener-join`: Join session with target language preference
2. `audio-stream`: Receive base64 audio chunks
3. `translation-update`: Receive text updates for display

## Important Implementation Details

1. **Hybrid Mode (NEW)**: The system now supports a hybrid approach that displays translations immediately while generating audio only for stable sentences. Toggle with `USE_HYBRID_MODE` in websocket.js.

2. **Audio Auto-Play**: Browsers block autoplay by default. The system includes aggressive unlock strategies with fallback event listeners (click, keydown, touch).

3. **Translation Caching**: Optional Redis support for caching translations to reduce API calls.

4. **Performance Targets**: 
   - Display latency: <200ms (hybrid mode)
   - Audio stability: 500-800ms (hybrid mode)
   - Translation latency: <200ms
   - End-to-end audio latency: <500ms
   - Deduplication rate: 100%

4. **Language Support**: Default voices configured for en-US, es-ES, fr-CA, de-DE, zh-CN, ja-JP

5. **Punctuation Helper**: Intelligently adds punctuation to improve sentence extraction quality

## Testing Scenarios

When testing changes, verify:
1. Simple sentences play exactly once after completion
2. Questions with punctuation are handled correctly
3. Multiple sentences are played separately
4. Long pauses don't cause repetition
5. Safari compatibility (use full URLs with http://)

## Monitoring & Debugging

- Performance metrics available at `http://localhost:8080/api/metrics`
- Health check endpoint at `/healthz`
- Extensive console logging with emoji indicators for different stages
- Session tracking in `websocket.js` using Map structures

## Common Issues & Solutions

1. **Safari Connection Issues**: Use `127.0.0.1` instead of `localhost`
2. **Audio Not Playing**: Click page to unlock audio context
3. **High Latency**: Check Azure region configuration
4. **Sentence Repetition**: Ensure only FINAL results trigger TTS