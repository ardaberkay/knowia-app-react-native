import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import tr from '../locales/tr.json';
import en from '../locales/en.json';
import ar from '../locales/ar.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';

const resources = {
  tr: { translation: tr },
  en: { translation: en },
  ar: { translation: ar },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
};

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (cb) => {
    try {
      const savedLang = await AsyncStorage.getItem('user-language');
      if (savedLang) {
        cb(savedLang);
      } else {
        const locales = Localization.getLocales();
        const locale = locales && locales.length > 0 ? locales[0].languageCode : 'en';
        const supportedLanguages = ['tr', 'en', 'ar', 'es', 'fr', 'pt'];
        const detectedLanguage = supportedLanguages.find(lang => locale.startsWith(lang)) || 'en';
        cb(detectedLanguage);
      }
    } catch (e) {
      cb('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (lng) => {
    await AsyncStorage.setItem('user-language', lng);
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
  });

export default i18n; 