/**
 * Voice Profile Configuration for Multi-language TTS
 * Native speakers with neutral accents for conference clarity
 */

export const voiceProfiles = {
  // English voices
  'en-US': {
    default: 'adam',
    voices: {
      'adam': {
        id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam',
        gender: 'male',
        description: 'Professional American male, clear and neutral',
        model: 'eleven_turbo_v2'
      },
      'rachel': {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        gender: 'female',
        description: 'Professional American female, warm and clear',
        model: 'eleven_turbo_v2'
      },
      'josh': {
        id: 'TxGEqnHWrfWFTfGW9XjX',
        name: 'Josh',
        gender: 'male',
        description: 'Young American male, energetic',
        model: 'eleven_turbo_v2'
      },
      'domi': {
        id: 'AZnzlk1XvdvUeBnXmlld',
        name: 'Domi',
        gender: 'female',
        description: 'Professional female, articulate',
        model: 'eleven_turbo_v2'
      }
    }
  },

  // Spanish voices (native Spanish speakers)
  'es': {
    default: 'matias',
    voices: {
      'matias': {
        id: 'UNl8xNFcjQDUCrtwp4ae',
        name: 'Matias',
        gender: 'male',
        description: 'Native Spanish male, neutral accent',
        model: 'eleven_multilingual_v2'
      },
      'valentina': {
        id: '7DPIJTVjSphHJIFlL58C',
        name: 'Valentina',
        gender: 'female',
        description: 'Native Spanish female, clear pronunciation',
        model: 'eleven_multilingual_v2'
      },
      'nicolas': {
        id: 'cjmJHipqvnlNKIMQpHBx',
        name: 'Nicolas',
        gender: 'male',
        description: 'Professional Spanish male',
        model: 'eleven_multilingual_v2'
      }
    }
  },

  // French voices (native French speakers)
  'fr': {
    default: 'charlotte',
    voices: {
      'charlotte': {
        id: 'XB0fDUnXU5powFXDhCwa',
        name: 'Charlotte',
        gender: 'female',
        description: 'Native French female, Parisian accent',
        model: 'eleven_multilingual_v2'
      },
      'serena': {
        id: 'pMsXgVXv3BLzUgSXRplE',
        name: 'Serena',
        gender: 'female',
        description: 'Professional French female, neutral',
        model: 'eleven_multilingual_v2'
      },
      'thomas': {
        id: 'GBv7mTt0atIp3Br8iCZE',
        name: 'Thomas',
        gender: 'male',
        description: 'Native French male, clear pronunciation',
        model: 'eleven_multilingual_v2'
      }
    }
  },

  // French Canadian
  'fr-CA': {
    default: 'charlotte', // Same voices work for Canadian French
    voices: {
      'charlotte': {
        id: 'XB0fDUnXU5powFXDhCwa',
        name: 'Charlotte',
        gender: 'female',
        description: 'French speaker, adaptable to Canadian',
        model: 'eleven_multilingual_v2'
      },
      'serena': {
        id: 'pMsXgVXv3BLzUgSXRplE',
        name: 'Serena',
        gender: 'female',
        description: 'Professional French, neutral accent',
        model: 'eleven_multilingual_v2'
      }
    }
  },

  // German voices (native German speakers)
  'de': {
    default: 'freya',
    voices: {
      'freya': {
        id: 'jsCqWAovK2LkecY7zXl4',
        name: 'Freya',
        gender: 'female',
        description: 'Native German female, standard Hochdeutsch',
        model: 'eleven_multilingual_v2'
      },
      'daniel': {
        id: 'onwK4e9ZLuTAKqWW03F9',
        name: 'Daniel',
        gender: 'male',
        description: 'Professional German male, clear',
        model: 'eleven_multilingual_v2'
      }
    }
  },

  // Italian voices
  'it': {
    default: 'alice',
    voices: {
      'alice': {
        id: 'Xb7hH8MSUJpSbSDYk0k2',
        name: 'Alice',
        gender: 'female',
        description: 'Native Italian female, neutral accent',
        model: 'eleven_multilingual_v2'
      },
      'giovanni': {
        id: 'pFVBWHpKpPMqrJJmXZLV',
        name: 'Giovanni',
        gender: 'male',
        description: 'Professional Italian male',
        model: 'eleven_multilingual_v2'
      }
    }
  },

  // Portuguese (Brazilian)
  'pt-BR': {
    default: 'laura',
    voices: {
      'laura': {
        id: 'FGY2WhTYpPnrIDTdsKH5',
        name: 'Laura',
        gender: 'female',
        description: 'Native Brazilian Portuguese, São Paulo accent',
        model: 'eleven_multilingual_v2'
      },
      'antonio': {
        id: 'nPczCjzI2devNBz1zQrb',
        name: 'Antonio',
        gender: 'male',
        description: 'Professional Brazilian male',
        model: 'eleven_multilingual_v2'
      }
    }
  },

  // Chinese (Mandarin)
  'zh-CN': {
    default: 'lily',
    voices: {
      'lily': {
        id: 'pFZP5JQG7iQjIQuC4Bku',
        name: 'Lily',
        gender: 'female',
        description: 'Native Mandarin speaker, standard pronunciation',
        model: 'eleven_multilingual_v2'
      },
      'william': {
        id: 'Zlb1dXrM653N07WRdFW3',
        name: 'William',
        gender: 'male',
        description: 'Professional Mandarin male',
        model: 'eleven_multilingual_v2'
      }
    }
  },

  // Japanese
  'ja-JP': {
    default: 'nanami',
    voices: {
      'nanami': {
        id: 'LcfcDJNUP1GQjkzn1xUU',
        name: 'Nanami',
        gender: 'female',
        description: 'Native Japanese female, Tokyo accent',
        model: 'eleven_multilingual_v2'
      },
      'kazuhiko': {
        id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Kazuhiko',
        gender: 'male',
        description: 'Professional Japanese male',
        model: 'eleven_multilingual_v2'
      }
    }
  },

  // Korean
  'ko-KR': {
    default: 'serena-ko',
    voices: {
      'serena-ko': {
        id: 'pMsXgVXv3BLzUgSXRplE',
        name: 'Serena',
        gender: 'female',
        description: 'Professional Korean female',
        model: 'eleven_multilingual_v2'
      }
    }
  },

  // Default fallback
  'default': {
    default: 'adam',
    voices: {
      'adam': {
        id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam',
        gender: 'male',
        description: 'Default professional voice',
        model: 'eleven_turbo_v2'
      }
    }
  }
};

/**
 * Get voice configuration for a language and voice preference
 */
export function getVoiceConfig(language, voicePreference = null) {
  // Normalize language code
  const langCode = language.toLowerCase();
  
  // Find matching profile
  let profile = voiceProfiles[langCode];
  
  // Try base language if specific variant not found
  if (!profile && langCode.includes('-')) {
    const baseLang = langCode.split('-')[0];
    profile = voiceProfiles[baseLang];
  }
  
  // Fallback to default
  if (!profile) {
    profile = voiceProfiles['default'];
  }
  
  // Get specific voice or default
  let voice;
  if (voicePreference && profile.voices[voicePreference]) {
    voice = profile.voices[voicePreference];
  } else {
    voice = profile.voices[profile.default];
  }
  
  return {
    ...voice,
    language: langCode
  };
}

/**
 * Get available voices for a language
 */
export function getAvailableVoices(language) {
  const langCode = language.toLowerCase();
  let profile = voiceProfiles[langCode];
  
  if (!profile && langCode.includes('-')) {
    const baseLang = langCode.split('-')[0];
    profile = voiceProfiles[baseLang];
  }
  
  if (!profile) {
    profile = voiceProfiles['default'];
  }
  
  return Object.entries(profile.voices).map(([key, voice]) => ({
    key,
    ...voice
  }));
}

/**
 * Conference scenario examples
 */
export const conferenceScenarios = {
  scenario1: {
    title: "International Tech Conference",
    description: "Multiple speakers presenting in different languages",
    setup: `
      1. Main speaker (English): Presenting new product features
      2. Spanish Q&A participant: Asking questions
      3. French technical expert: Providing detailed explanations
      4. Japanese investor: Discussing business aspects
    `,
    flow: [
      {
        speaker: "English presenter",
        says: "Welcome everyone to our product launch. Today we're introducing revolutionary AI features.",
        listeners: {
          spanish: "Hears: 'Bienvenidos todos a nuestro lanzamiento de producto. Hoy presentamos características revolucionarias de IA.' (Matias voice, neutral Spanish)",
          french: "Hears: 'Bienvenue à tous à notre lancement de produit. Aujourd'hui, nous présentons des fonctionnalités d'IA révolutionnaires.' (Charlotte voice, clear French)",
          japanese: "Hears: '皆様、製品発表会へようこそ。本日は革命的なAI機能をご紹介します。' (Nanami voice, professional Japanese)"
        },
        latency: "~200ms from speech to translation audio"
      },
      {
        speaker: "Spanish participant",
        says: "¿Cómo maneja el sistema la privacidad de datos?",
        listeners: {
          english: "Hears: 'How does the system handle data privacy?' (Adam voice, clear English)",
          french: "Hears: 'Comment le système gère-t-il la confidentialité des données?' (Charlotte voice)",
          japanese: "Hears: 'システムはデータプライバシーをどのように処理しますか？' (Nanami voice)"
        },
        latency: "~200ms, adaptive speed kicks in if multiple questions"
      }
    ],
    features: [
      "Each listener chooses their preferred voice (male/female, tone)",
      "Queue management prevents audio buildup during rapid exchanges",
      "Adaptive speed increases up to 1.4x during fast discussions",
      "Sentence-level translation for natural flow"
    ]
  },
  
  scenario2: {
    title: "Medical Symposium",
    description: "Technical discussion requiring precision",
    setup: `
      1. German doctor presenting research
      2. French medical team discussing findings
      3. English-speaking audience
      4. Real-time Q&A with multiple languages
    `,
    flow: [
      {
        speaker: "German doctor",
        says: "Die Studienergebnisse zeigen eine 95% Wirksamkeit",
        listeners: {
          english: "Hears: 'The study results show 95% efficacy' (Rachel voice, professional female)",
          french: "Hears: 'Les résultats de l'étude montrent une efficacité de 95%' (Thomas voice, male option)"
        },
        latency: "~150-200ms for technical terms"
      }
    ],
    features: [
      "Technical terminology handled accurately",
      "Voice selection persists throughout session",
      "Minimal latency even with complex medical terms",
      "Clear pronunciation prioritized over speed"
    ]
  },
  
  scenario3: {
    title: "Business Negotiation",
    description: "Fast-paced multi-party discussion",
    setup: `
      1. Chinese CEO speaking Mandarin
      2. American legal team in English
      3. French financial advisors
      4. Rapid back-and-forth dialogue
    `,
    flow: [
      {
        context: "Multiple people speaking quickly",
        behavior: "System detects rapid speech after 2 seconds",
        adaptation: "TTS speed increases to 1.2x, then 1.3x as queue builds",
        result: "Audio stays synchronized, ~300ms behind speaker"
      }
    ],
    features: [
      "Automatic speed adaptation based on queue depth",
      "Drops old queued audio if speaker changes topic",
      "Each participant's chosen voice remains consistent",
      "Phrase-mode activated for faster response in rapid exchanges"
    ]
  }
};