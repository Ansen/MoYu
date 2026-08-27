import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './locales';

const defaultTranslate = (key, params) => {
  const dict = translations['zh'] || {};
  let str = dict[key] || key;
  if (params && typeof params === 'object') {
    Object.keys(params).forEach(k => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
  }
  return str;
};

const defaultContextValue = {
  t: defaultTranslate,
  langSetting: 'system',
  setLangSetting: () => {},
  activeLang: 'zh'
};

const I18nContext = createContext(defaultContextValue);

export function useI18n() {
  const context = useContext(I18nContext);
  return context || defaultContextValue;
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
