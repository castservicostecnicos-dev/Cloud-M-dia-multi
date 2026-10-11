import { API_BASE_URL } from './api';

// Web Audio API Chime & Multi-Engine Speech Synthesis (Cloud Neural TTS + Web Audio + HTML5 Audio + Web Speech API fallback)
let audioCtx: AudioContext | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeBufferSource: AudioBufferSourceNode | null = null;
let activeHtmlAudio: HTMLAudioElement | null = null;
let sharedHtmlAudio: HTMLAudioElement | null = null;
let htmlAudioUnlocked = false;
let speechTimeoutId: ReturnType<typeof setTimeout> | null = null;
let speechWatchdogId: ReturnType<typeof setTimeout> | null = null;
let speechKeepAliveInterval: ReturnType<typeof setInterval> | null = null;
let currentSpeechSeq = 0;

// Tiny 1-sample silent WAV for unlocking HTMLAudioElement during user gesture
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

// Client-side in-memory cache of validated MP3 ArrayBuffers for instant 0ms playback
const clientTtsCache = new Map<string, ArrayBuffer>();
const inFlightTtsRequests = new Map<string, Promise<ArrayBuffer | null>>();

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

function getOrCreateSharedHtmlAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  if (!sharedHtmlAudio) {
    sharedHtmlAudio = new Audio();
    sharedHtmlAudio.preload = 'auto';
  }
  return sharedHtmlAudio;
}

// Initialize and pre-load voices
export function initAudioAndVoices() {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        cachedVoices = v;
      }
      window.speechSynthesis.onvoiceschanged = () => {
        try {
          const loaded = window.speechSynthesis.getVoices();
          if (loaded && loaded.length > 0) {
            cachedVoices = loaded;
          }
        } catch {}
      };
    }
  } catch {}
}

if (typeof window !== 'undefined') {
  initAudioAndVoices();
}

/**
 * Checks whether the browser's AudioContext is currently unlocked and running
 */
export function isAudioUnlocked(): boolean {
  return Boolean(audioCtx && audioCtx.state === 'running');
}

/**
 * Ensures the AudioContext and HTML5 Audio element are unlocked by a user gesture
 */
export function unlockAudio(): boolean {
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      // Play a 1-sample silent buffer to unlock iOS/Android/SmartTV Web Audio pipeline
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch {}
    }

    // Unlock reusable HTML5 Audio element on first user gesture without disrupting active playback
    if (!htmlAudioUnlocked && !activeHtmlAudio) {
      const audio = getOrCreateSharedHtmlAudio();
      if (audio) {
        try {
          audio.muted = true;
          audio.src = SILENT_WAV_DATA_URI;
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise
              .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;
                htmlAudioUnlocked = true;
              })
              .catch(() => {
                audio.muted = false;
              });
          } else {
            audio.muted = false;
            htmlAudioUnlocked = true;
          }
        } catch {
          audio.muted = false;
        }
      }
    }

    // If native speechSynthesis is paused, resume it (never queue blank whitespace utterances)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the best available Brazilian Portuguese or Portuguese voice
 */
export function getBestPortugueseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  let voices = cachedVoices;
  if (!voices || voices.length === 0) {
    try {
      voices = window.speechSynthesis.getVoices() || [];
      if (voices.length > 0) cachedVoices = voices;
    } catch {
      voices = [];
    }
  }

  if (voices.length === 0) return null;

  // 1. Brazilian Portuguese voices
  const ptBrVoices = voices.filter((v) => {
    const lang = (v.lang || '').replace('_', '-').toLowerCase();
    return lang === 'pt-br';
  });

  if (ptBrVoices.length > 0) {
    const preferred = ptBrVoices.find((v) =>
      /natural|google|microsoft|luciana|francisca|antonio|thalita|maria|leticia|daniel|online/i.test(v.name)
    );
    if (preferred) return preferred;
    return ptBrVoices[0];
  }

  // 2. Any Portuguese voice (pt, pt-PT)
  const anyPt = voices.find((v) => (v.lang || '').toLowerCase().startsWith('pt'));
  if (anyPt) return anyPt;

  // 3. Fallback to default
  return voices.find((v) => v.default) || voices[0] || null;
}

/**
 * Formats phrase for natural speech synthesis in Portuguese
 */
export function formatPhraseForSpeech(rawPhrase: string): string {
  if (!rawPhrase) return '';
  let text = rawPhrase.trim();

  // Replace visual separators with natural speech pauses
  text = text
    .replace(/\s*[•|\/]\s*/g, ', ')
    .replace(/\s+-\s+/g, ', ');

  // Common digital signage abbreviations expanded for clear pronunciation
  text = text
    .replace(/\bcx\.?\s*(\d+)/gi, 'caixa $1')
    .replace(/\bcons\.?\s*(\d+)/gi, 'consultório $1')
    .replace(/\bguiche\.?\s*(\d+)/gi, 'guichê $1')
    .replace(/\bop\.?\s*(\d+)/gi, 'operador $1')
    .replace(/\bpref\.?\b/gi, 'preferencial')
    .replace(/\batend\.?\b/gi, 'atendimento');

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Validates that an ArrayBuffer contains real binary audio (MP3/WAV) and not HTML/JSON error responses
 */
function isValidAudioBuffer(buffer: ArrayBuffer | null | undefined): buffer is ArrayBuffer {
  if (!buffer || buffer.byteLength <= 100) return false;
  const bytes = new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength));
  // Reject HTML ('<' = 0x3c) or JSON ('{' = 0x7b, '[' = 0x5b)
  if (bytes[0] === 0x3c || bytes[0] === 0x7b || bytes[0] === 0x5b) {
    return false;
  }
  return true;
}

/**
 * Pre-fetches and caches the Portuguese TTS audio buffer for zero-latency playback
 */
export async function preloadPhraseAudio(rawPhrase: string): Promise<ArrayBuffer | null> {
  const cleanText = formatPhraseForSpeech(rawPhrase);
  if (!cleanText) return null;
  const cacheKey = cleanText.toLowerCase();

  const existing = clientTtsCache.get(cacheKey);
  if (existing && isValidAudioBuffer(existing)) {
    return existing;
  }

  const inFlight = inFlightTtsRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const fetchPromise = (async (): Promise<ArrayBuffer | null> => {
    try {
      const ttsUrl = `${API_BASE_URL}/tts?lang=pt-BR&text=${encodeURIComponent(cleanText)}`;
      const response = await fetch(ttsUrl, {
        headers: {
          Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.5',
        },
      });
      if (!response.ok) return null;

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (isValidAudioBuffer(arrayBuffer)) {
        if (clientTtsCache.size > 50) {
          const firstKey = clientTtsCache.keys().next().value;
          if (firstKey) clientTtsCache.delete(firstKey);
        }
        clientTtsCache.set(cacheKey, arrayBuffer);
        return arrayBuffer;
      }
    } catch {
      // Ignore preload errors silently
    } finally {
      inFlightTtsRequests.delete(cacheKey);
    }
    return null;
  })();

  inFlightTtsRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Plays the melodic alert chime (Web Audio API)
 */
export function playCallChime(isPriority?: boolean) {
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(isPriority ? 783.99 : 659.25, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Second tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(isPriority ? 1046.5 : 880, now + 0.2);
    gain2.gain.setValueAtTime(0.45, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + (isPriority ? 0.8 : 1.2));
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + (isPriority ? 0.8 : 1.2));

    // Third melodic chime for priority calls
    if (isPriority) {
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1318.51, now + 0.45);
      gain3.gain.setValueAtTime(0.5, now + 0.45);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.45);
      osc3.stop(now + 1.5);
    }
  } catch (err) {
    console.warn('Could not play call audio chime:', err);
  }
}

function clearActiveSpeechTimers() {
  if (speechWatchdogId) {
    clearTimeout(speechWatchdogId);
    speechWatchdogId = null;
  }
  if (speechKeepAliveInterval) {
    clearInterval(speechKeepAliveInterval);
    speechKeepAliveInterval = null;
  }
}

function stopActiveSpeechSources() {
  clearActiveSpeechTimers();

  if (activeBufferSource) {
    try {
      activeBufferSource.onended = null;
      activeBufferSource.stop();
      activeBufferSource.disconnect();
    } catch {}
    activeBufferSource = null;
  }

  if (activeHtmlAudio) {
    try {
      activeHtmlAudio.onended = null;
      activeHtmlAudio.onerror = null;
      activeHtmlAudio.pause();
      activeHtmlAudio.currentTime = 0;
    } catch {}
    activeHtmlAudio = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {}
  }
}

/**
 * Fallback to native browser SpeechSynthesis (used when offline or server TTS unavailable)
 */
function speakViaBrowserSynthesis(
  cleanText: string,
  seq: number,
  options?: {
    isPriority?: boolean;
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
  }
) {
  if (seq !== currentSpeechSeq) return;

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onEnd?.();
    return;
  }

  const startUtterance = () => {
    if (seq !== currentSpeechSeq) return;
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'pt-BR';
      utterance.rate = options?.rate ?? (options?.isPriority ? 0.95 : 0.98);
      utterance.pitch = options?.pitch ?? 1.0;
      utterance.volume = options?.volume ?? 1.0;

      const voice = getBestPortugueseVoice();
      if (voice) {
        utterance.voice = voice;
        if (voice.lang) {
          utterance.lang = voice.lang;
        }
      }

      let finished = false;
      const finishOnce = () => {
        if (finished) return;
        finished = true;
        clearActiveSpeechTimers();
        if (activeUtterance === utterance) {
          activeUtterance = null;
        }
        if (seq === currentSpeechSeq) {
          options?.onEnd?.();
        }
      };

      utterance.onstart = () => {
        if (seq === currentSpeechSeq) {
          options?.onStart?.();
        }
      };

      utterance.onend = () => {
        finishOnce();
      };

      utterance.onerror = (e: any) => {
        if (e?.error !== 'canceled' && e?.error !== 'interrupted') {
          console.warn('SpeechSynthesis warning:', e?.error || e);
        }
        finishOnce();
      };

      // Retain reference to prevent Chromium garbage collection
      activeUtterance = utterance;
      (window as any).__indoorCallActiveUtterance = utterance;

      // Keep-alive for Chrome's 15-second pause bug on long sentences
      speechKeepAliveInterval = setInterval(() => {
        try {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        } catch {}
      }, 10000);

      // Watchdog timeout so UI never stays stuck on "Falando..." if browser TTS hangs
      const estimatedMs = Math.max(4000, Math.min(20000, cleanText.length * 120 + 2500));
      speechWatchdogId = setTimeout(() => {
        finishOnce();
      }, estimatedMs);

      options?.onStart?.();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Error in native SpeechSynthesis:', err);
      options?.onEnd?.();
    }
  };

  // Avoid Chromium race condition when cancelling previous speech
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
    setTimeout(startUtterance, 80);
  } else {
    startUtterance();
  }
}

/**
 * Speaks a phrase in Portuguese using Cloud Neural TTS (through Web Audio API / HTML5 Audio)
 * with automatic fallback to browser SpeechSynthesis if offline.
 */
export async function speakCallPhrase(
  phrase: string,
  options?: {
    isPriority?: boolean;
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
  }
) {
  const cleanText = formatPhraseForSpeech(phrase);
  if (!cleanText) {
    options?.onEnd?.();
    return;
  }

  // Increment sequence ID and stop any currently playing voice
  const seq = ++currentSpeechSeq;
  stopActiveSpeechSources();

  try {
    // 1. Fetch or retrieve cached MP3 buffer from our backend /api/tts
    const rawBuffer = await preloadPhraseAudio(cleanText);

    // If another call or stop happened while fetching, abort
    if (seq !== currentSpeechSeq) return;

    if (isValidAudioBuffer(rawBuffer)) {
      const ctx = getOrCreateAudioContext();

      // Engine 1: Play decoded buffer directly through Web Audio API (same unlocked pipeline as chime)
      if (ctx) {
        try {
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }
          if (seq !== currentSpeechSeq) return;

          // Clone buffer because decodeAudioData detaches the ArrayBuffer
          const bufferCopy = rawBuffer.slice(0);
          const audioBuffer = await ctx.decodeAudioData(bufferCopy);
          if (seq !== currentSpeechSeq) return;

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = options?.isPriority ? 0.97 : 1.0;

          // Boost voice clarity and volume
          const gainNode = ctx.createGain();
          gainNode.gain.value = (options?.volume ?? 1.0) * 1.4;

          source.connect(gainNode);
          gainNode.connect(ctx.destination);

          activeBufferSource = source;
          let ended = false;
          const completePlayback = () => {
            if (ended) return;
            ended = true;
            clearActiveSpeechTimers();
            if (activeBufferSource === source) {
              activeBufferSource = null;
            }
            if (seq === currentSpeechSeq) {
              options?.onEnd?.();
            }
          };

          source.onended = completePlayback;

          // Safety watchdog
          const durationMs = Math.ceil((audioBuffer.duration || 4) * 1000) + 1200;
          speechWatchdogId = setTimeout(completePlayback, durationMs);

          options?.onStart?.();
          source.start(0);
          return;
        } catch (webAudioErr) {
          console.warn('WebAudio TTS decode fallback to HTML5 Audio:', webAudioErr);
        }
      }

      // Engine 2: Play via reusable unlocked HTML5 Audio element
      if (seq !== currentSpeechSeq) return;
      const htmlPlayed = await new Promise<boolean>((resolve) => {
        try {
          const blob = new Blob([rawBuffer], { type: 'audio/mpeg' });
          const blobUrl = URL.createObjectURL(blob);
          const audio = getOrCreateSharedHtmlAudio() || new Audio();
          audio.muted = false;
          audio.volume = Math.min(1.0, options?.volume ?? 1.0);
          audio.src = blobUrl;
          activeHtmlAudio = audio;

          let settled = false;
          let ended = false;

          const cleanupAudio = () => {
            if (ended) return;
            ended = true;
            clearActiveSpeechTimers();
            URL.revokeObjectURL(blobUrl);
            if (activeHtmlAudio === audio) {
              activeHtmlAudio = null;
            }
            if (seq === currentSpeechSeq) {
              options?.onEnd?.();
            }
          };

          audio.onended = () => {
            if (!settled) {
              settled = true;
              resolve(true);
            }
            cleanupAudio();
          };

          audio.onerror = () => {
            clearActiveSpeechTimers();
            URL.revokeObjectURL(blobUrl);
            if (activeHtmlAudio === audio) activeHtmlAudio = null;
            if (!settled) {
              settled = true;
              resolve(false);
            } else {
              cleanupAudio();
            }
          };

          speechWatchdogId = setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve(true);
            }
            cleanupAudio();
          }, 15000);

          const playPromise = audio.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise
              .then(() => {
                if (!settled) {
                  settled = true;
                  options?.onStart?.();
                  resolve(true);
                }
              })
              .catch(() => {
                clearActiveSpeechTimers();
                URL.revokeObjectURL(blobUrl);
                if (activeHtmlAudio === audio) activeHtmlAudio = null;
                if (!settled) {
                  settled = true;
                  resolve(false);
                }
              });
          } else {
            settled = true;
            options?.onStart?.();
            resolve(true);
          }
        } catch {
          resolve(false);
        }
      });

      if (htmlPlayed || seq !== currentSpeechSeq) {
        return;
      }
    }
  } catch (err) {
    console.warn('Cloud TTS unavailable, using native SpeechSynthesis:', err);
  }

  // Engine 3: Offline / fallback to native browser SpeechSynthesis
  if (seq === currentSpeechSeq) {
    speakViaBrowserSynthesis(cleanText, seq, options);
  }
}

/**
 * Complete call notification pipeline:
 * 1. Pre-loads the voice audio immediately while the chime starts
 * 2. Plays melodic alert chime
 * 3. Speaks the designated phrase in Portuguese right after the chime harmonic opening
 */
export function playCallAlert(
  phrase: string,
  isPriority?: boolean,
  callbacks?: {
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
  }
) {
  // Clear any scheduled speech from a previous call
  if (speechTimeoutId) {
    clearTimeout(speechTimeoutId);
    speechTimeoutId = null;
  }
  currentSpeechSeq++;
  stopActiveSpeechSources();

  // Unlock audio immediately on call trigger
  unlockAudio();

  // Start pre-fetching the TTS audio in parallel while the chime plays!
  preloadPhraseAudio(phrase).catch(() => {});

  // 1. Play chime first
  playCallChime(isPriority);

  // 2. Speak phrase right after the chime harmonic opening
  const delayMs = isPriority ? 700 : 500;
  speechTimeoutId = setTimeout(() => {
    speechTimeoutId = null;
    speakCallPhrase(phrase, {
      isPriority,
      onStart: callbacks?.onSpeechStart,
      onEnd: callbacks?.onSpeechEnd,
    });
  }, delayMs);
}

/**
 * Stops all audio alerts and speech immediately
 */
export function stopCallAlert() {
  if (speechTimeoutId) {
    clearTimeout(speechTimeoutId);
    speechTimeoutId = null;
  }
  currentSpeechSeq++;
  stopActiveSpeechSources();
}
