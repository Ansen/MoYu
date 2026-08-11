import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './i18n/index.jsx'

// 全局劫持 WebView 默认行为，打造纯原生体验
if (typeof window !== 'undefined') {
  // 1. 禁用右键菜单
  document.addEventListener('contextmenu', e => {
    // 除非在输入框里，否则全员禁用右键菜单
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });

  // 2. 禁用浏览器快捷键 (缩放、刷新等)
  document.addEventListener('keydown', e => {
    // 禁用 F5 / Ctrl+R 刷新 (如果在开发模式下可以保留，但这里为了原生感全干掉)
    if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
      e.preventDefault();
    }
    // 禁用 Ctrl+F 默认页面搜索
    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
    }
    // 禁用缩放 Ctrl + '+' / '-'
    if (e.ctrlKey && (e.key === '=' || e.key === '-' || e.key === '+')) {
      e.preventDefault();
    }
  });

  // 3. 禁用触控板/鼠标滚轮缩放
  document.addEventListener('wheel', e => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
