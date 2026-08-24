import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './locales';

const I18nContext = createContext();

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }) {
  // language state: 'zh', 'en', 'system'
  const [langSetting, setLangSetting] = useState('system');
  const [activeLang, setActiveLang] = useState('zh');

  useEffect(() => {
    const saved = localStorage.getItem('app_language');
    if (saved) {
      setLangSetting(saved);
    }
  }, []);

  useEffect(() => {
    if (langSetting === 'system') {
      const isEn = navigator.language.toLowerCase().startsWith('en');
      setActiveLang(isEn ? 'en' : 'zh');
    } else {
      setActiveLang(langSetting);
    }
    
    if (langSetting !== 'system') {
      localStorage.setItem('app_language', langSetting);
    } else {
      localStorage.removeItem('app_language');
    }
  }, [langSetting]);

  const t = (key, params) => {
    const dict = translations[activeLang] || translations['zh'];
    let str = dict[key] || key;
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(k => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
      });
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ t, langSetting, setLangSetting, activeLang }}>
      {children}
    </I18nContext.Provider>
  );
}
