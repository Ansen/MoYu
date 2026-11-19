import { createContext, useContext } from 'react';
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

export const I18nContext = createContext(defaultContextValue);

export function useI18n() {
  const context = useContext(I18nContext);
  return context || defaultContextValue;
}
