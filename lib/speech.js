// Text-to-speech helpers for the swipe screen: voice locale per language,
// voice ranking, speech rates and the stored preference key.

// languages.language_code ('en') -> a voice locale. The region picks the voice
// that matches the flag shown in the app (Portugal, not Brazil).
export const SPEECH_LOCALES = {
  tr: 'tr-TR', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT', ar: 'ar-SA',
};
export const toSpeechLocale = (code) => {
  const base = (code || '').toLowerCase().slice(0, 2);
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
  const base = locale.slice(0, 2).toLowerCase();
  const exact = locale.toLowerCase();
  const score = (v) => voiceRank(v.identifier) * 10 + ((v.language || '').toLowerCase() === exact ? 1 : 0);
  return voices
    .filter((v) => !isNoveltyVoice(v.identifier) && (v.language || '').toLowerCase().startsWith(base))
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
