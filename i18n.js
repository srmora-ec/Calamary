import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector'; 
import global_es from './locales/es.json';
import global_en from './locales/en.json';

i18n
  .use(LanguageDetector) // Usar el detector
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: global_es },
      en: { translation: global_en }
    },
    // lng: "es", 
    
    fallbackLng: "es", // Si no hay nada guardado, usa español

    // 4. Configuración para que solo use almacenamiento local (no navegador)
    detection: {
      order: ['localStorage'], // Primero busca en localStorage
      caches: ['localStorage'], // Cuando cambie idioma, guarda en localStorage
    },

    interpolation: { escapeValue: false }
  });

export default i18n;