import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './locales';

const defaultTranslate = (key, params, fallback) => {
  const dict = translations['zh'] || {};
  let str = dict[key];
  if (str === undefined) {
    if (typeof params === 'string') {
      str = params;
    } else if (typeof fallback === 'string') {
      str = fallback;
    } else {
      str = key;
    }
  }
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

function getInitialLangSetting() {
  try {
    return localStorage.getItem('app_language') || 'system';
  } catch {
    return 'system';
  }
}

function resolveActiveLang(setting) {
  if (setting === 'system') {
    const navLang =
      typeof navigator !== 'undefined' && navigator.language
        ? navigator.language.toLowerCase()
        : 'zh';
    return navLang.startsWith('en') ? 'en' : 'zh';
  }
  return setting;
}

export function I18nProvider({ children }) {
  // 首帧同步读取语言设置，避免切换语言前闪烁默认中文
  const [langSetting, setLangSetting] = useState(getInitialLangSetting);
  const activeLang = resolveActiveLang(langSetting);

  useEffect(() => {
    try {
      if (langSetting !== 'system') {
        localStorage.setItem('app_language', langSetting);
      } else {
        localStorage.removeItem('app_language');
      }
    } catch {
      // 忽略存储异常
    }
  }, [langSetting]);

  const t = (key, params, fallback) => {
    const dict = translations[activeLang] || translations['zh'] || {};
    let str = dict[key];
    if (str === undefined) {
      if (typeof params === 'string') {
        str = params;
      } else if (typeof fallback === 'string') {
        str = fallback;
      } else {
        str = key;
      }
    }
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
