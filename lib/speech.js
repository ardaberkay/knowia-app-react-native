// Text-to-speech: voice locale per language, voice ranking, speech rates,
// the stored preference keys, the swipe screen's useCardSpeech hook and
// useSpeakText (plain text, card detail sheet).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { getDeckSpeechLanguages } from '../services/DeckService';
import { getLanguages, languageNativeName } from '../services/LanguageService';
import { triggerHaptic } from './hapticManager';

// languages.language_code ('en') -> a voice locale. The region picks the voice
// that matches the flag shown in the app (Portugal, not Brazil).
export const SPEECH_LOCALES = {
  tr: 'tr-TR', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT', ar: 'ar-SA',
  // Cantonese voices are listed under zh-HK on both platforms.
  zh: 'zh-CN', yue: 'zh-HK',
};
// Base language of a code or locale ('pt-PT' -> 'pt', 'fil' -> 'fil',
// 'yue' -> 'yue'). Not slice(0, 2): 3-letter codes would hit the wrong
// language (fil -> fi = Finnish). Old Android codes map to the current ones.
const LEGACY_CODES = { iw: 'he', in: 'id', ji: 'yi', no: 'nb' };
export const baseLanguage = (code) => {
  const base = (code || '').toLowerCase().split(/[-_]/)[0];
  return LEGACY_CODES[base] || base;
};
export const toSpeechLocale = (code) => {
  const base = baseLanguage(code);
  return SPEECH_LOCALES[base] || base || undefined;
};

// Slightly slower than the system default: easier to follow while learning.
export const SPEECH_RATE = 0.9;
// Voice settings sheet (kebab menu): a 5-step reading speed and a chosen voice
// per language. Stored on the device; a voice applies to every deck in that
// language. A missing or uninstalled voice falls back to the best one.
// 0.9 is the recommended default (the system's 1.0 feels fast for learning).
export const SPEECH_RATES = [0.5, 0.75, SPEECH_RATE, 1.0, 1.25];
// Earlier 3-option setting (slow / normal / fast), mapped onto the new steps.
export const LEGACY_RATE_INDEX_TO_RATE = [0.75, SPEECH_RATE, 1.0];
export const TTS_PREFS_KEY = 'tts_prefs_v1';
// languages.<sort_order> holds the localized language names.
export const LANGUAGE_SORT_ORDER = { tr: 1, en: 2, de: 3, es: 4, fr: 5, pt: 6, ar: 7 };
export const VOICE_SAMPLES = {
  tr: 'Merhaba! Kartlarını bu sesle okuyacağım.',
  en: 'Hello! I will read your cards in this voice.',
  de: 'Hallo! Ich lese deine Karten mit dieser Stimme vor.',
  es: '¡Hola! Leeré tus tarjetas con esta voz.',
  fr: 'Bonjour ! Je lirai tes cartes avec cette voix.',
  pt: 'Olá! Vou ler os teus cartões com esta voz.',
  ar: 'مرحبًا! سأقرأ بطاقاتك بهذا الصوت.',
};

// Best installed voice for a locale. expo-speech reports iOS Premium voices as
// "Default", so rank by the identifier (com.apple.voice.premium|enhanced|
// compact.<locale>.<Name>). Novelty/eloquence voices are skipped. An exact
// locale beats the same base language (en-US over en-GB).
export const voiceRank = (identifier = '') => {
  if (identifier.includes('.premium.')) return 3;
  if (identifier.includes('.enhanced.')) return 2;
  return 1;
};
export const isNoveltyVoice = (identifier = '') =>
  identifier.includes('speech.synthesis') || identifier.includes('eloquence');
// Installed voices for a locale's language, best first (quality, then the
// exact locale, then name).
export const voicesForLocale = (voices, locale) => {
  if (!locale || !voices?.length) return [];
  const base = baseLanguage(locale);
  const exact = locale.toLowerCase();
  const score = (v) => voiceRank(v.identifier) * 10 + ((v.language || '').toLowerCase() === exact ? 1 : 0);
  return voices
    .filter((v) => !isNoveltyVoice(v.identifier) && baseLanguage(v.language) === base)
    .sort((a, b) => (score(b) - score(a)) || (a.name || '').localeCompare(b.name || ''));
};
export const pickBestVoice = (voices, locale) => voicesForLocale(voices, locale)[0]?.identifier;

// Card text as plain speech: drop LaTeX delimiters/commands so formulas don't
// get read out as "dollar backslash frac".
export const stripForSpeech = (text) => (text || '')
  .replace(/\$+/g, ' ')
  .replace(/\\[a-zA-Z]+/g, ' ')
  .replace(/[{}]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const formatRate = (rate) => `${Number.isInteger(rate) ? rate.toFixed(0) : rate}×`;

// Native modules, loaded defensively: builds made before expo-speech /
// expo-audio were added (and OTA updates landing on them) throw on import.
// No Speech = no speaker button; no audio module = speech still works, just
// muted in silent mode.
let Speech = null;
try { Speech = require('expo-speech'); } catch { Speech = null; }
let ExpoAudio = null;
try { ExpoAudio = require('expo-audio'); } catch { ExpoAudio = null; }

export const isSpeechAvailable = Boolean(Speech);

// Device-only reading language per deck: { [deckId]: { front, back } }.
const READING_LANG_KEY = 'tts_reading_lang_v1';

/**
 * Card text-to-speech for the swipe screen: reading languages, installed
 * voices, voice/rate preferences, the audio session and the voice sheet.
 *
 * Speech only starts on an explicit tap of the card's speaker button. Each
 * face reads in its own deck language (decks_languages.side); the back falls
 * back to the front language, a deck with no language to the app's.
 * A new card, a reverse-mode toggle or leaving the screen ends speech; the
 * screen calls stopSpeaking() on a flip.
 */
export function useCardSpeech({ deckId, cardsRef, flippedCardIdRef, isReversed, currentIndex }) {
  const { t, i18n } = useTranslation();

  const [deckSpeechLangs, setDeckSpeechLangs] = useState({ front: null, back: null });
  const [speakingCardId, setSpeakingCardId] = useState(null);
  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    getDeckSpeechLanguages(deckId, i18n.language)
      .then((langs) => { if (!cancelled) setDeckSpeechLangs(langs); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [deckId, i18n.language]);

  // Reading language: a device-only override per deck, set in the voice sheet
  // (the deck's own language is changed in the deck settings). It only changes
  // which language cards are read in; progress and filters are untouched.
  const [readingOverrides, setReadingOverrides] = useState({});
  useEffect(() => {
    AsyncStorage.getItem(READING_LANG_KEY)
      .then((raw) => { if (raw) setReadingOverrides(JSON.parse(raw) || {}); })
      .catch(() => {});
  }, []);
  const readingOverride = deckId ? readingOverrides[deckId] : null;
  const speechLangs = readingOverride || deckSpeechLangs;
  const saveReadingOverride = useCallback((value) => {
    if (!deckId) return;
    setReadingOverrides((prev) => {
      const next = { ...prev };
      if (value) next[deckId] = value;
      else delete next[deckId];
      AsyncStorage.setItem(READING_LANG_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [deckId]);

  // All content languages: reading language picker + section titles.
  const [allLanguages, setAllLanguages] = useState([]);
  useEffect(() => {
    getLanguages().then(setAllLanguages).catch(() => {});
  }, []);
  const languageForCode = useCallback(
    (code) => allLanguages.find((l) => baseLanguage(l.language_code) === baseLanguage(code)),
    [allLanguages]
  );
  const readingLangIds = useMemo(() => {
    const front = languageForCode(speechLangs.front || i18n.language);
    const back = speechLangs.back ? languageForCode(speechLangs.back) : null;
    return [front?.id, back && back.id !== front?.id ? back.id : null].filter(Boolean);
  }, [i18n.language, languageForCode, speechLangs]);
  const handleReadingLanguagesChange = useCallback((ids) => {
    if (!ids?.length) return; // keep the last choice; the picker can't be empty
    const code = (id) => allLanguages.find((l) => l.id === id)?.language_code?.toLowerCase() || null;
    const value = { front: code(ids[0]), back: ids[1] ? code(ids[1]) : null };
    const sameAsDeck = baseLanguage(value.front) === baseLanguage(deckSpeechLangs.front)
      && baseLanguage(value.back || '') === baseLanguage(deckSpeechLangs.back || '');
    saveReadingOverride(sameAsDeck ? null : value);
  }, [allLanguages, deckSpeechLangs, saveReadingOverride]);
  const resetReadingLanguages = useCallback(() => {
    triggerHaptic('selection');
    saveReadingOverride(null);
  }, [saveReadingOverride]);

  // Installed voices. Loaded on mount and again when the voice sheet opens
  // (Android's TTS engine can return an empty list while it starts up).
  const voicesRef = useRef([]);
  const [voices, setVoices] = useState([]);
  const loadVoices = useCallback(() => {
    if (!Speech) return;
    Speech.getAvailableVoicesAsync()
      .then((list) => {
        const next = list || [];
        // Skip the update (and the re-render) when nothing changed.
        const sameList = next.length === voicesRef.current.length
          && next.every((v, i) => v.identifier === voicesRef.current[i]?.identifier);
        if (sameList) return;
        voicesRef.current = next;
        setVoices(next);
      })
      .catch(() => {});
  }, []);
  useEffect(() => { loadVoices(); }, [loadVoices]);

  // Voice settings (rate + chosen voice per language), device-wide. The ref
  // lets handleSpeak read them without being recreated on every change.
  const [ttsPrefs, setTtsPrefs] = useState({ rate: SPEECH_RATE, voices: {} });
  const ttsPrefsRef = useRef(ttsPrefs);
  ttsPrefsRef.current = ttsPrefs;
  useEffect(() => {
    AsyncStorage.getItem(TTS_PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        let rate = SPEECH_RATE;
        if (SPEECH_RATES.includes(saved?.rate)) rate = saved.rate;
        else if (LEGACY_RATE_INDEX_TO_RATE[saved?.rateIndex] != null) rate = LEGACY_RATE_INDEX_TO_RATE[saved.rateIndex];
        setTtsPrefs({
          rate,
          voices: saved?.voices && typeof saved.voices === 'object' ? saved.voices : {},
        });
      })
      .catch(() => {});
  }, []);
  const updateTtsPrefs = useCallback((change) => {
    setTtsPrefs((prev) => {
      const next = {
        rate: change.rate ?? prev.rate,
        voices: { ...prev.voices, ...(change.voices || {}) },
      };
      AsyncStorage.setItem(TTS_PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  // The user's voice for this language if it is still installed, else the best.
  const resolveVoice = useCallback((locale) => {
    const base = baseLanguage(locale);
    const chosen = ttsPrefsRef.current.voices[base];
    if (chosen && voicesRef.current.some((v) => v.identifier === chosen)) return chosen;
    return pickBestVoice(voicesRef.current, locale);
  }, []);
  const currentRate = useCallback(() => ttsPrefsRef.current.rate ?? SPEECH_RATE, []);

  // Audio session: speak even with the ring/silent switch on (user-started
  // playback), and only duck other apps' audio (e.g. music) while speaking.
  // The session is released after each utterance so their volume comes back.
  const audioModeReadyRef = useRef(false);
  const activateSpeechAudio = useCallback(async () => {
    if (!ExpoAudio) return;
    try {
      if (!audioModeReadyRef.current) {
        await ExpoAudio.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
        audioModeReadyRef.current = true;
      }
      await ExpoAudio.setIsAudioActiveAsync(true);
    } catch {
      // Without the session the system default applies (muted in silent mode).
    }
  }, []);
  const releaseSpeechAudio = useCallback(() => {
    ExpoAudio?.setIsAudioActiveAsync(false).catch(() => {});
  }, []);

  const speakingCardIdRef = useRef(null);
  speakingCardIdRef.current = speakingCardId;
  const stopSpeaking = useCallback(() => {
    if (speakingCardIdRef.current == null) return;
    Speech?.stop();
    setSpeakingCardId(null);
  }, []);

  useEffect(() => { stopSpeaking(); }, [currentIndex, isReversed, stopSpeaking]);
  useEffect(() => () => {
    Speech?.stop();
    ExpoAudio?.setIsAudioActiveAsync(false).catch(() => {});
  }, []);

  const handleSpeak = useCallback((id) => {
    if (!Speech) return;
    if (speakingCardId === id) {
      stopSpeaking();
      return;
    }
    const card = cardsRef.current.find((c) => c?.card_id === id)?.cards;
    if (!card) return;

    // Which face is showing, and which deck side it holds (reverse mode
    // puts the answer, i.e. the back-side content, on the front face).
    const showingBack = flippedCardIdRef.current === id;
    const isBackContent = showingBack !== isReversed;
    const text = stripForSpeech(isBackContent ? card.answer : card.question);
    if (!text) return;
    const code = (isBackContent ? speechLangs.back : speechLangs.front) || i18n.language;
    const locale = toSpeechLocale(code);

    Speech.stop();
    setSpeakingCardId(id);
    const done = () => {
      setSpeakingCardId((prev) => (prev === id ? null : prev));
      releaseSpeechAudio();
    };
    activateSpeechAudio().then(() => {
      Speech.speak(text, {
        language: locale,
        voice: resolveVoice(locale),
        rate: currentRate(),
        onDone: done,
        onStopped: done,
        onError: done,
      });
    });
  }, [activateSpeechAudio, cardsRef, currentRate, flippedCardIdRef, i18n.language, isReversed, releaseSpeechAudio, resolveVoice, speakingCardId, speechLangs, stopSpeaking]);

  // Voice sheet: one section per deck language (front first; one section when
  // both sides share a language).
  const voiceSections = useMemo(() => {
    const front = speechLangs.front || i18n.language;
    const back = speechLangs.back || front;
    const sideLabel = {
      front: t('swipeDeck.voice.front', 'Ön yüz'),
      back: t('swipeDeck.voice.back', 'Arka yüz'),
      both: t('swipeDeck.voice.bothSides', 'Ön ve arka yüz'),
    };
    const make = (code, side) => {
      const base = baseLanguage(code);
      const locale = toSpeechLocale(code);
      const order = LANGUAGE_SORT_ORDER[base];
      const language = languageForCode(code);
      return {
        base,
        locale,
        title: language ? languageNativeName(language, t) : (order ? t(`languages.${order}`) : base.toUpperCase()),
        sideLabel: sideLabel[side],
        voices: voicesForLocale(voices, locale),
      };
    };
    const frontBase = baseLanguage(front);
    const backBase = baseLanguage(back);
    if (frontBase === backBase) return [make(front, 'both')];
    return [make(front, 'front'), make(back, 'back')];
  }, [i18n.language, languageForCode, speechLangs, t, voices]);

  // Plays a short sample in the section's language with the given voice
  // (null = automatic) at the current rate, or at `rate` when given.
  const previewVoice = useCallback((identifier, locale, rate) => {
    if (!Speech) return;
    const base = baseLanguage(locale);
    Speech.stop();
    setSpeakingCardId(null);
    activateSpeechAudio().then(() => {
      Speech.speak(VOICE_SAMPLES[base] || VOICE_SAMPLES.en, {
        language: locale,
        voice: identifier || pickBestVoice(voicesRef.current, locale),
        rate: rate ?? currentRate(),
        onDone: releaseSpeechAudio,
        onStopped: releaseSpeechAudio,
        onError: releaseSpeechAudio,
      });
    });
  }, [activateSpeechAudio, currentRate, releaseSpeechAudio]);

  const selectVoice = useCallback((base, identifier, locale) => {
    triggerHaptic('selection');
    updateTtsPrefs({ voices: { [base]: identifier } });
    previewVoice(identifier, locale);
  }, [previewVoice, updateTtsPrefs]);

  // A new speed is saved and heard right away, in the deck's front language.
  const handleRateChange = useCallback((rate) => {
    if (!SPEECH_RATES.includes(rate)) return;
    updateTtsPrefs({ rate });
    const locale = voiceSections[0]?.locale;
    if (locale) previewVoice(resolveVoice(locale), locale, rate);
  }, [previewVoice, resolveVoice, updateTtsPrefs, voiceSections]);

  const voiceSheetRef = useRef(null);
  const openVoiceSheet = useCallback(() => {
    voiceSheetRef.current?.present();
    // Refresh the voice list once the sheet has settled, so a changed list
    // never re-renders anything during the opening animation.
    setTimeout(loadVoices, 450);
  }, [loadVoices]);
  const handleVoiceSheetDismiss = useCallback(() => {
    Speech?.stop();
  }, []);

  return {
    speakingCardId,
    handleSpeak,
    stopSpeaking,
    openVoiceSheet,
    // Spread onto <VoiceSettingsSheet>.
    voiceSheetProps: {
      sheetRef: voiceSheetRef,
      sections: voiceSections,
      rate: ttsPrefs.rate,
      chosenVoices: ttsPrefs.voices,
      onSelectVoice: selectVoice,
      onRateChange: handleRateChange,
      onDismiss: handleVoiceSheetDismiss,
      languages: allLanguages,
      readingLangIds,
      readingOverridden: Boolean(readingOverride),
      onReadingLanguagesChange: handleReadingLanguagesChange,
      onResetReadingLanguages: resetReadingLanguages,
    },
  };
}

// --- Plain text speech (card detail sheet) ---
// Same languages, voices, rate and audio session as the swipe screen, read
// on demand: nothing loads until the sheet shows a deck's card, and voices
// and preferences are read at tap time (so a change in the swipe screen's
// voice sheet applies right away).

let detailVoicesCache = null;
const loadVoicesOnce = async () => {
  if (!Speech) return [];
  if (detailVoicesCache?.length) return detailVoicesCache;
  try {
    detailVoicesCache = (await Speech.getAvailableVoicesAsync()) || [];
  } catch {
    detailVoicesCache = [];
  }
  return detailVoicesCache;
};

const readTtsPrefs = async () => {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(TTS_PREFS_KEY)) || 'null');
    let rate = SPEECH_RATE;
    if (SPEECH_RATES.includes(saved?.rate)) rate = saved.rate;
    else if (LEGACY_RATE_INDEX_TO_RATE[saved?.rateIndex] != null) rate = LEGACY_RATE_INDEX_TO_RATE[saved.rateIndex];
    const voices = saved?.voices && typeof saved.voices === 'object' ? saved.voices : {};
    return { rate, voices };
  } catch {
    return { rate: SPEECH_RATE, voices: {} };
  }
};

const readReadingOverride = async (deckId) => {
  try {
    const all = JSON.parse((await AsyncStorage.getItem(READING_LANG_KEY)) || 'null');
    return all?.[deckId] || null;
  } catch {
    return null;
  }
};

let detailAudioModeReady = false;
const activateDetailAudio = async () => {
  if (!ExpoAudio) return;
  try {
    if (!detailAudioModeReady) {
      await ExpoAudio.setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
      detailAudioModeReady = true;
    }
    await ExpoAudio.setIsAudioActiveAsync(true);
  } catch {
    // Without the session the system default applies (muted in silent mode).
  }
};
const releaseDetailAudio = () => {
  ExpoAudio?.setIsAudioActiveAsync(false).catch(() => {});
};

/**
 * Reads a text aloud in a deck's language: speak(key, text, side) starts it
 * (side 'front' = question language, 'back' = answer language, falling back
 * to the front one, then the app's), the same key again stops it.
 * speakingKey is what is being read (null when silent).
 */
export function useSpeakText(deckId) {
  const { i18n } = useTranslation();
  const [speakingKey, setSpeakingKey] = useState(null);
  const speakingKeyRef = useRef(null);
  speakingKeyRef.current = speakingKey;

  const langsRef = useRef({ front: null, back: null });
  useEffect(() => {
    langsRef.current = { front: null, back: null };
    if (!deckId || !Speech) return undefined;
    let cancelled = false;
    Promise.all([
      getDeckSpeechLanguages(deckId, i18n.language).catch(() => null),
      readReadingOverride(deckId),
    ]).then(([deckLangs, override]) => {
      if (!cancelled) langsRef.current = override || deckLangs || { front: null, back: null };
    });
    return () => { cancelled = true; };
  }, [deckId, i18n.language]);

  // Bumped by every speak / stop: a speak whose setup (prefs, voices) is
  // still loading gives up when it is no longer the latest.
  const requestRef = useRef(0);
  const stop = useCallback(() => {
    requestRef.current += 1;
    if (speakingKeyRef.current == null) return;
    speakingKeyRef.current = null;
    Speech?.stop();
    setSpeakingKey(null);
  }, []);
  useEffect(() => () => {
    requestRef.current += 1;
    if (speakingKeyRef.current == null) return;
    Speech?.stop();
    releaseDetailAudio();
  }, []);

  const speak = useCallback(async (key, text, side = 'front') => {
    if (!Speech) return;
    if (speakingKeyRef.current === key) {
      stop();
      return;
    }
    const clean = stripForSpeech(text);
    if (!clean) return;
    const langs = langsRef.current;
    const code = (side === 'back' ? langs.back || langs.front : langs.front) || i18n.language;
    const locale = toSpeechLocale(code);

    const request = ++requestRef.current;
    Speech.stop();
    speakingKeyRef.current = key;
    setSpeakingKey(key);
    const done = () => {
      setSpeakingKey((prev) => (prev === key ? null : prev));
      releaseDetailAudio();
    };
    const [prefs, voices] = await Promise.all([readTtsPrefs(), loadVoicesOnce()]);
    if (request !== requestRef.current) return; // stopped or replaced meanwhile
    await activateDetailAudio();
    const chosen = prefs.voices[baseLanguage(locale)];
    const voice = chosen && voices.some((v) => v.identifier === chosen) ? chosen : pickBestVoice(voices, locale);
    Speech.speak(clean, {
      language: locale,
      voice,
      rate: prefs.rate,
      onDone: done,
      onStopped: done,
      onError: done,
    });
  }, [i18n.language, stop]);

  return { speakingKey, speak, stop };
}
