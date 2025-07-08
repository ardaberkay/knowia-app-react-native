import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import tr from '../locales/tr.json';
import en from '../locales/en.json';

const resources = {
  tr: { translation: tr },
  en: { translation: en },
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
        const locale = Localization.locale;
        cb(locale.startsWith('tr') ? 'tr' : 'en');
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