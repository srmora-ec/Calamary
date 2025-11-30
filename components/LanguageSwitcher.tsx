'use client'; 

import React from 'react';
// 1. Importa el hook
import { useTranslation } from 'react-i18next';
// 2. IMPORTA TU CONFIGURACIÓN AQUÍ DIRECTAMENTE PARA QUE CORRA EN EL CLIENTE
import i18nInstance from '../i18n'; // <--- Ajusta la ruta a donde esté tu i18n.js

export default function LanguageSwitcher() {
  // Usamos el hook solo para que el componente se repinte cuando cambie el idioma
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    // 3. Usamos 'i18nInstance' (el importado directo) o verificamos 'i18n'
    // A veces el hook devuelve un i18n incompleto si no hay Provider, 
    // así que usar el importado directo es más seguro en este caso simple.
    
    const currentLang = i18nInstance.language || 'es'; // Fallback a 'es'
    const newLang = currentLang === 'es' ? 'en' : 'es';
    
    i18nInstance.changeLanguage(newLang);
  };

  return (
    <button 
      onClick={toggleLanguage}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition cursor-pointer"
    >
    {t('botones.btn_lang')}
    </button>
  );
}