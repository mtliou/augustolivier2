import { v4 as uuid } from 'uuid';
import { recordConnection, recordTranslation, recordError } from './performance-monitor.js';
import { getTranslator } from './text-translator.js';
import { streamingSentenceExtractor } from './streaming-sentence-extractor.js';
import { hybridSentenceExtractor } from './hybrid-sentence-extractor.js';
import { StreamingTTS } from './streaming-tts.js';
import { punctuationHelper } from './punctuation-helper.js';

const sessions = new Map(); // code -> { speakerId, sourceLang, targetLangs, listeners: Map, metrics }

// Configuration for hybrid mode
const USE_HYBRID_MODE = true; // Toggle between hybrid and original approach
const HYBRID_CONFIG = {
  stabilityThreshold: 2,    // Sentences need 2 appearances
  stabilityTimeMs: 500,     // Or 500ms persistence
  displayPartials: true      // Show partials immediately
};

// Initialize TTS provider
const ttsProvider = new StreamingTTS({
  provider: 'azure',
  quality: 'balanced',
  streamingEnabled: true
});

export function initOptimizedSocket(io) {
  io.on('connection', (socket) => {
    recordConnection('connect');

    // Helper: get unique listener languages for a session
    const getListenerLangs = (session) => {
      return Array.from(new Set(Array.from(session.listeners.values()).map(l => l.lang).filter(Boolean)));
    };

    // Continuous speech detection state
    const continuousState = new Map(); // code:lang -> { lastTs, runStartTs, continuous }

    // Unified processing pipeline for incoming text (partials/finals)
    const processIncoming = async (data) => {
      const code = (data.sessionCode || '').trim().toUpperCase();
      const session = sessions.get(code);
      if (!session) return;

      const nowTs = Date.now();
      const ts = data.timestamp || nowTs;
      const latency = nowTs - ts;

      // Record metrics
      session.metrics.translations++;
      session.metrics.totalLatency += latency;
      recordTranslation(latency);

      // Add punctuation to improve sentence extraction (force terminal punctuation on finals)
      let punctuatedText = punctuationHelper.punctuate(
        data.original,
        code,
        data.isFinal
      );
      if (data.isFinal && punctuatedText && !/[.!?؟。！]$/.test(punctuatedText)) {
        // Ensure final ends with a delimiter for clean splitting
        punctuatedText += '.';
      }

      // Log processing mode
      if (USE_HYBRID_MODE) {
        console.log(`🔄 [HYBRID] Processing ${data.isFinal ? 'FINAL' : 'PARTIAL'} #${session.metrics.translations}`);
      }

      // Continuous speech detection per language; lower thresholds when rapid partials
      const keyFor = (lang) => `${code}:${lang}`;
      const adjustForContinuousSpeech = (lang) => {
        const key = keyFor(lang);
        const st = continuousState.get(key) || { lastTs: 0, runStartTs: nowTs, continuous: false };
        const delta = nowTs - st.lastTs;
        st.lastTs = nowTs;
        if (delta < 350) { // partials arriving faster than ~3/sec
          if (!st.continuous) st.runStartTs = nowTs;
          st.continuous = true;
        } else if (delta > 900) {
          st.continuous = false; // pause detected
        }
        continuousState.set(key, st);
        const duration = nowTs - st.runStartTs;
        if (st.continuous && duration > 3000) {
          // In continuous mode for >3s -> use phrase mode with lower threshold
          hybridSentenceExtractor.setSessionParams(code, lang, { threshold: 1, timeMs: 300, phraseMode: true });
        } else {
          // Default mode
          hybridSentenceExtractor.setSessionParams(code, lang, { threshold: 2, timeMs: 600, phraseMode: false });
        }
      };

      // Determine target languages: explicit session targetLangs or listener languages
      const targetLangsUsed = (session.targetLangs && session.targetLangs.length > 0)
        ? session.targetLangs
        : getListenerLangs(session);

      // Check if we have translations or need to generate them (accept both 'translations' and legacy 'translated')
      let translations = data.translations || data.translated || {};

      // If no translations provided, use Azure Translator
      if ((!translations || Object.keys(translations).length === 0) && punctuatedText) {
        try {
          const translator = getTranslator();
          console.log(`🔄 Translating: "${punctuatedText.substring(0, 50)}..." → [${targetLangsUsed.join(', ')}]`);
          translations = targetLangsUsed.length > 0
            ? await translator.translate(
                punctuatedText,
                targetLangsUsed,
                session.sourceLang
              )
            : {}; // no targets yet
          if (Object.keys(translations).length > 0) {
            console.log(`✅ Translations generated for ${Object.keys(translations).length} languages`);
          }
        } catch (error) {
          console.error('Translation error:', error);
          // Fallback to original text for all languages
          targetLangsUsed.forEach(lang => {
            translations[lang] = punctuatedText;
          });
        }
      }

      // Broadcast to all listeners in the session (diagnostic)
      socket.to(code).emit('translation-broadcast', {
        original: data.original,
        translations: translations,
        isFinal: data.isFinal,
        timestamp: ts,
        offset: data.offset,
        duration: data.duration,
        latency
      });

      // Generate TTS/display based on selected mode
      if (USE_HYBRID_MODE) {
        // HYBRID MODE: Generate TTS for stable sentences across partials
        for (const [lang, translatedText] of Object.entries(translations)) {
          if (!translatedText) continue;

          // Continuous speech adaptive thresholds/mode per language
          adjustForContinuousSpeech(lang);

          // Process with hybrid extractor
          const result = hybridSentenceExtractor.processPartial(
            code,
            lang,
            translatedText,
            data.isFinal
          );

          // Send display update immediately (all partials)
          session.listeners.forEach((listener, listenerId) => {
            if (listener.lang === lang) {
              const listenerSocket = io.sockets.sockets.get(listenerId);
              if (listenerSocket) {
                listenerSocket.emit('translation-update', {
                  text: result.displayText,
                  language: lang,
                  isFinal: data.isFinal,
                  partialNumber: result.partialNumber
                });
              }
            }
          });

          // Generate TTS only for stable sentences
          if (result.shouldGenerateTTS && result.stableSentences.length > 0) {
            console.log(`🎯 [HYBRID] Generating TTS for ${result.stableSentences.length} stable sentences in ${lang}`);

            for (const sentenceData of result.stableSentences) {
              try {
                // Deduplicate against any previously spoken sentences (hybrid or final)
                streamingSentenceExtractor.registerSpoken(code, lang, sentenceData.text);

                // Generate TTS audio
                const audioStream = await ttsProvider.streamSynthesize(sentenceData.text, lang);
                if (audioStream) {
                  const chunks = [];
                  audioStream.on('data', chunk => chunks.push(chunk));
                  audioStream.on('end', () => {
                    const audioBuffer = Buffer.concat(chunks);
                    const base64Audio = audioBuffer.toString('base64');

                    // Send audio to listeners of this language
                    session.listeners.forEach((listener, listenerId) => {
                      if (listener.lang === lang) {
                        const listenerSocket = io.sockets.sockets.get(listenerId);
                        if (listenerSocket) {
                          listenerSocket.emit('audio-stream', {
                            audio: base64Audio,
                            format: 'mp3',
                            language: lang,
                            text: sentenceData.text,
                            confidence: sentenceData.confidence,
                            isStable: true
                          });
                          console.log(`🔊 [HYBRID] TTS sent for ${lang}: "${sentenceData.text.substring(0, 30)}..." (confidence: ${(sentenceData.confidence * 100).toFixed(0)}%)`);
                        }
                      }
                    });
                  });
                  audioStream.on('error', (error) => {
                    console.error(`TTS stream error for ${lang}:`, error);
                  });
                } else {
                  console.warn(`⚠️ [HYBRID] No audio stream returned for ${lang}`);
                }
              } catch (error) {
                console.error(`TTS generation error for ${lang}:`, error);
              }
            }
          } else if (data.isFinal) {
            // Fallback: if final and nothing stable emitted, synthesize final sentences to ensure audio
            const { sentences } = streamingSentenceExtractor.processTranscript(
              code,
              lang,
              translations[lang],
              true
            );
            if (sentences && sentences.length > 0) {
              console.log(`🎯 [HYBRID-FALLBACK] Generating TTS for ${sentences.length} final sentences in ${lang}`);
              for (const sentence of sentences) {
                try {
                  // Skip anything already spoken by hybrid
                  streamingSentenceExtractor.registerSpoken(code, lang, sentence);

                  const audioStream = await ttsProvider.streamSynthesize(sentence, lang);
                  if (audioStream) {
                    const chunks = [];
                    audioStream.on('data', chunk => chunks.push(chunk));
                    audioStream.on('end', () => {
                      const audioBuffer = Buffer.concat(chunks);
                      const base64Audio = audioBuffer.toString('base64');
                      session.listeners.forEach((listener, listenerId) => {
                        if (listener.lang === lang) {
                          const listenerSocket = io.sockets.sockets.get(listenerId);
                          if (listenerSocket) {
                            listenerSocket.emit('audio-stream', {
                              audio: base64Audio,
                              format: 'mp3',
                              language: lang,
                              text: sentence,
                              isStable: true
                            });
                            console.log(`🔊 [HYBRID-FALLBACK] TTS sent for ${lang}: "${sentence.substring(0, 30)}..."`);
                          }
                        }
                      });
                    });
                    audioStream.on('error', (error) => {
                      console.error(`TTS stream error (fallback) for ${lang}:`, error);
                    });
                  }
                } catch (error) {
                  console.error(`TTS generation error (fallback) for ${lang}:`, error);
                }
              }
            }
          }
        }
      } else {
        // ORIGINAL MODE: Only process finals to avoid repetition
        for (const [lang, translatedText] of Object.entries(translations)) {
          if (!translatedText) continue;

          // Process transcript - only generates TTS for final results
          const { sentences, shouldGenerateTTS } = streamingSentenceExtractor.processTranscript(
            code,
            lang,
            translatedText,
            data.isFinal
          );

          // Only generate TTS if we have new sentences from a final result
          if (shouldGenerateTTS && sentences.length > 0) {
            console.log(`🎯 [ORIGINAL] Generating TTS for ${sentences.length} final sentences in ${lang}`);

            for (const sentence of sentences) {
              try {
                const audioStream = await ttsProvider.streamSynthesize(sentence, lang);
                if (audioStream) {
                  const chunks = [];
                  audioStream.on('data', chunk => chunks.push(chunk));

                  audioStream.on('end', () => {
                    const audioBuffer = Buffer.concat(chunks);
                    const base64Audio = audioBuffer.toString('base64');

                    session.listeners.forEach((listener, listenerId) => {
                      if (listener.lang === lang) {
                        const listenerSocket = io.sockets.sockets.get(listenerId);
                        if (listenerSocket) {
                          listenerSocket.emit('audio-stream', {
                            audio: base64Audio,
                            format: 'mp3',
                            language: lang,
                            text: sentence
                          });
                          console.log(`🔊 [ORIGINAL] TTS sent for ${lang}: "${sentence.substring(0, 30)}..."`);
                        }
                      }
                    });
                  });

                  audioStream.on('error', (error) => {
                    console.error(`TTS stream error for ${lang}:`, error);
                  });
                }
              } catch (error) {
                console.error(`TTS generation error for ${lang}:`, error);
              }
            }
          }
        }
      }

      // Log performance warnings
      if (latency > 200 && data.isFinal) {
        console.warn(`⚠️ High latency: ${latency}ms for session ${code}`);
      }
    };
    // Handle both optimized and streaming speaker join events
    const handleSpeakerJoin = ({ sessionCode, sourceLang, targetLangs, sourceLanguageHint }) => {
      const code = (sessionCode || '').trim().toUpperCase();
      if (!code || code.length !== 4) return;

      const resolvedSource = sourceLang || sourceLanguageHint;
      const resolvedTargets = Array.isArray(targetLangs) ? targetLangs : [];

      const session = {
        speakerId: socket.id,
        sourceLang: resolvedSource,
        targetLangs: resolvedTargets,
        listeners: new Map(),
        metrics: {
          startTime: Date.now(),
          translations: 0,
          totalLatency: 0
        }
      };

      sessions.set(code, session);
      socket.join(code);

      io.to(code).emit('session-started', {
        sourceLang: resolvedSource,
        targetLangs: resolvedTargets,
        method: 'direct-translation'
      });

      console.log(`🎙️ Speaker joined session ${code} (${resolvedSource} → ${resolvedTargets.join(', ') || 'listeners-defined'})`);

      // Send success response
      socket.emit('joined', {
        ok: true,
        sessionCode: code,
        mode: 'streaming',
        targetLatency: 400
      });
    };

    // Listen for both event names (plus legacy)
    socket.on('optimized-speaker-join', handleSpeakerJoin);
    socket.on('streaming-speaker-join', handleSpeakerJoin);
    socket.on('speaker-join', handleSpeakerJoin);

    // Unified stream handler - translate if needed
    socket.on('translation-stream', async (data) => {
      await processIncoming(data);
    });

    // Legacy STT event handlers from speaker.html (partials + finals)
    socket.on('stt-partial', ({ sessionCode, text, sourceLanguage, t0, offset, duration }) => {
      processIncoming({
        sessionCode,
        original: text,
        translations: {},
        isFinal: false,
        timestamp: t0 || Date.now(),
        offset,
        duration
      });
    });

    socket.on('stt-final', ({ sessionCode, text, sourceLanguage, t0, offset, duration }) => {
      processIncoming({
        sessionCode,
        original: text,
        translations: {},
        isFinal: true,
        timestamp: t0 || Date.now(),
        offset,
        duration
      });
    });

    // Handle listener joins
    const handleListenerJoin = ({ sessionCode, preferredLanguage }) => {
      const code = (sessionCode || '').trim().toUpperCase();
      const session = sessions.get(code);

      if (!session) {
        recordError('session-not-found');
        return socket.emit('session-not-found');
      }

      session.listeners.set(socket.id, {
        lang: preferredLanguage,
        joinedAt: Date.now()
      });

      socket.join(code);
      socket.emit('joined', {
        ok: true,
        sessionCode: code,
        availableLanguages: session.targetLangs,
        sourceLang: session.sourceLang,
        method: 'direct-translation'
      });

      console.log(`👂 Listener joined session ${code} for ${preferredLanguage}`);
    };

    // Listen for both event names
    socket.on('listener-join', handleListenerJoin);
    socket.on('streaming-listener-join', handleListenerJoin);

    // Handle language change
    socket.on('change-language', ({ sessionCode, language }) => {
      const code = (sessionCode || '').trim().toUpperCase();
      const session = sessions.get(code);

      if (session && session.listeners.has(socket.id)) {
        const listener = session.listeners.get(socket.id);
        console.log(`🔄 Language change for listener ${socket.id}: ${listener.lang} → ${language}`);
        listener.lang = language;

        socket.emit('language-changed', {
          language: language,
          success: true
        });
      }
    });

    // Listener leaves
    socket.on('listener-leave', ({ sessionCode }) => {
      const code = (sessionCode || '').trim().toUpperCase();
      const session = sessions.get(code);

      if (session && session.listeners.has(socket.id)) {
        session.listeners.delete(socket.id);
        socket.leave(code);
        console.log(`👋 Listener left session ${code}`);
      }
    });

    // Cleanup
    socket.on('disconnect', () => {
      recordConnection('disconnect');

      for (const [code, session] of sessions.entries()) {
        if (session.speakerId === socket.id) {
          // Log session metrics before cleanup
          if (session.metrics.translations > 0) {
            const avgLatency = session.metrics.totalLatency / session.metrics.translations;
            const duration = (Date.now() - session.metrics.startTime) / 1000;

            console.log(`📊 Session ${code} ended:`);
            console.log(`   Duration: ${duration.toFixed(2)}s`);
            console.log(`   Translations: ${session.metrics.translations}`);
            console.log(`   Avg Latency: ${avgLatency.toFixed(2)}ms`);
          }

          // Clean up hybrid extractors if using hybrid mode
          if (USE_HYBRID_MODE) {
            session.targetLangs.forEach(lang => {
              hybridSentenceExtractor.clearSession(code, lang);
            });
            console.log(`🧹 [HYBRID] Cleaned up extractors for session ${code}`);
          }

          io.to(code).emit('speaker-disconnected');
          sessions.delete(code);
        } else if (session.listeners.has(socket.id)) {
          session.listeners.delete(socket.id);
        }
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      recordError('socket-error');
    });
  });

  // Periodic session cleanup (remove stale sessions)
  setInterval(() => {
    const now = Date.now();
    const staleTimeout = 30 * 60 * 1000; // 30 minutes

    for (const [code, session] of sessions.entries()) {
      const age = now - session.metrics.startTime;

      if (age > staleTimeout && session.listeners.size === 0) {
        console.log(`🧹 Cleaning up stale session ${code}`);
        sessions.delete(code);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}