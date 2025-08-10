# Conference Test Scripts - Speech-to-Speech Translation System

## System is Fixed! What Was Changed:

1. **Deduplication Fixed**: Segments are now tracked properly and will only be read ONCE
2. **Natural Segments**: Minimum 5 words per sentence for natural speech
3. **Conference Mode**: New optimized mode specifically for live conferences
4. **Smart Detection**: Similar sentences won't be repeated (85% similarity threshold)

## Test Script 1: Basic Conference Introduction
**Read this slowly and clearly with natural pauses:**

```
Good morning everyone and welcome to our international conference.
Today we have participants from many different countries joining us.
I'm excited to share our latest developments with all of you.
Let's begin with a brief overview of today's agenda.
We'll have three main sessions followed by a networking lunch.
```

### Expected Behavior:
- Each sentence plays ONCE and only once
- French listeners hear: "Bonjour à tous et bienvenue à notre conférence internationale..."
- TTS starts ~200ms after you finish each sentence
- No repetition of "Good morning everyone" or any other phrase
- Natural voice with proper French pronunciation

---

## Test Script 2: Technical Presentation
**Read with normal conference pace:**

```
Our new artificial intelligence platform represents a major breakthrough.
The system can process millions of transactions per second.
We've achieved a ninety-five percent accuracy rate in our testing.
The implementation uses advanced neural network architectures.
This technology will be available starting next quarter.
```

### Expected Behavior:
- Numbers preserved correctly (95% → 95%)
- Technical terms translated accurately
- Each sentence plays once
- ~200-300ms latency maintained

---

## Test Script 3: Rapid Q&A Session
**Read quickly to test adaptive speed:**

```
Question one, how does the system handle data privacy?
Question two, what are the licensing costs?
Question three, is there multi-platform support?
Question four, can we integrate with existing systems?
Question five, what about technical support options?
```

### Expected Behavior:
- System detects rapid speech after 2-3 questions
- TTS speed increases to 1.1x, then 1.2x
- Queue shows 2-3 items but catches up
- No sentences repeated
- All questions heard clearly

---

## Test Script 4: Mixed Length Sentences
**Test natural conversation flow:**

```
Hello everyone.
Welcome to today's session on innovation and technology advancement.
That's great.
Let me explain how our revolutionary new system works in detail.
Perfect.
The benefits include increased efficiency, reduced costs, and better user experience.
Any questions?
```

### Expected Behavior:
- Short sentences ("Hello everyone") play normally
- Long sentences play completely without being cut off
- No repetition of beginnings like "Hello" or "Welcome"
- Natural flow maintained

---

## Test Script 5: Conference Interruption Scenario
**Read the first part, pause for 3 seconds, then continue:**

```
The financial projections for next year show significant growth potential.
[PAUSE 3 SECONDS]
As you can see on the slide, revenue is expected to double.
[PAUSE 2 SECONDS]
This is based on our expansion into new markets.
```

### Expected Behavior:
- First sentence plays completely
- System waits during pause
- Second sentence plays once (not repeated)
- No replay of earlier content

---

## What You Should See in the Console:

✅ **GOOD** (Fixed):
```
✅ [CONF] New sentence #1: "Good morning everyone and welcome to our..."
✅ [CONF] New sentence #2: "Today we have participants from many..."
🔊 [CONFERENCE] Sent sentence #1: "Good morning everyone and welcome..."
🔊 [CONFERENCE] Sent sentence #2: "Today we have participants from..."
```

❌ **BAD** (What was happening before):
```
✅ [HYBRID] Stable sentence detected: "Bonjour à tous..."
✅ [HYBRID] Stable sentence detected: "Bonjour à tous..." (DUPLICATE!)
🔊 [HYBRID] TTS sent for fr: "Bonjour à tous..." 
🔊 [HYBRID] TTS sent for fr: "Bonjour à tous..." (PLAYING AGAIN!)
```

---

## Quick Validation Checklist:

- [ ] Each sentence plays exactly ONCE
- [ ] No repetition of sentence beginnings
- [ ] Natural sentence lengths (not too short)
- [ ] ~200-300ms latency from speech to translation
- [ ] Proper language pronunciation (French sounds French, not English)
- [ ] Adaptive speed kicks in during rapid speech
- [ ] Display updates immediately, audio follows shortly
- [ ] Session cleanup when speaker disconnects

---

## Testing URLs:

**Speaker**: http://localhost:8080/speaker-streaming.html
**Listener**: http://localhost:8080/listener-streaming.html

Use session code: **TEST** or any 4-letter code

---

## System Status Indicators:

🟢 **Working Correctly**:
- History shows each sentence once
- Queue stays under 5 items
- Latency under 300ms
- Natural speech flow

🔴 **Issues to Report**:
- Same sentence in history multiple times
- Queue building up (>10 items)
- Choppy or unnatural segments
- Wrong language pronunciation