/**
 * MoYu (摩语) Official Website - Core Interactivity & Logic
 */

// ==========================================================================
// 1. Translations (i18n) Dictionary
// ==========================================================================
const translations = {
  zh: {
    "nav.features": "核心特性",
    "nav.player": "电码播放器",
    "nav.translator": "摩言密语",
    "nav.demo": "在线体验",
    "nav.preview": "终端预览",
    "nav.downloads": "立即下载",
    
    "hero.badge": "v0.1.15 正式版已发布",
    "hero.title_html": "专业的摩尔斯电码<br class=\"hero-br\"><span class=\"gradient-text\">与标准中文电码训练终端</span>",
    "hero.subtitle": "基于 Tauri + React 构建的轻量、极简且专业的摩尔斯密码训练与中文电码互译桌面应用。为业余无线电爱好者与发报玩家打造沉浸式体验。",
    "hero.download_auto": "免费下载",
    "hero.all_platforms": "查看所有系统版本",
    "hero.detected_platform": "检测到你的系统为：",
    "hero.source_label": "下载源：",
    "hero.source_cdn": "国内高速 CDN (EdgeOne)",
    "hero.source_github": "GitHub 官方源",

    "mockup.nav.home": "首页导航",
    "mockup.nav.translator": "摩言密语",
    "mockup.nav.player": "电码播放器",
    "mockup.nav.settings": "系统偏好",
    "mockup.greeting": "早上好，欢迎使用 摩语",
    "mockup.sub": "专业的摩尔斯密码训练与中文电码互译终端",
    "mockup.card.trans.title": "摩言密语",
    "mockup.card.trans.desc": "中文汉字、标准电码与摩尔斯电码智能双向互译",
    "mockup.card.player.title": "电码播放器",
    "mockup.card.player.desc": "导入 TXT 或 EPUB 电子书，沉浸式高亮听抄跟读",
    "mockup.recent.title": "内置推荐训练材料",

    "demo.badge": "互动体验",
    "demo.title": "在线摩斯电码发报模拟",
    "demo.subtitle": "输入字符即可实时转换摩斯密码，并体验真实的 800Hz 电台侧音发报声。",
    "demo.input_label": "输入文本 (英文字母 / 数字)",
    "demo.output_label": "摩尔斯电码 (Morse Code)",
    "demo.wpm_label": "发报速度 (WPM):",
    "demo.freq_label": "侧音频偏 (Hz):",
    "demo.play": "播放发报音",
    "demo.stop": "停止播放",

    "feat.badge": "功能亮点",
    "feat.title": "匠心打造的无线电训练利器",
    "feat.subtitle": "打破传统摩斯工具的单一局限，将汉字标准电码与现代电子书阅读深度融合。",
    
    "feat.1.title": "摩言密语 · 智能互译",
    "feat.1.desc": "打破传统摩斯码只支持英文的限制，支持中文汉字、标准四位中文电码与摩尔斯电码的双向即时互译，输入自动识别。",
    "feat.2.title": "沉浸式 CW 电子书播放器",
    "feat.2.desc": "支持导入本地 TXT 与 EPUB 电子书，自动解析章节目录，实时发报模拟并高亮追踪阅读进度。",
    "feat.3.title": "专业电台音效仿真",
    "feat.3.desc": "自定义 WPM 报速、侧音频偏 Hz、点划间隔比，更支持老式电子管电台过载失真 (谐波) 音效模拟，还原真实通联。",
    "feat.4.title": "轻量极速 · 跨平台架构",
    "feat.4.desc": "基于 Rust + Tauri 原生构建，内存占用不足百兆，秒级极速启动，全平台 Windows / macOS / Linux / Android 统一体验。",

    "gallery.badge": "界面设计",
    "gallery.title": "极简大方，专为专注而生",
    "gallery.subtitle": "精心调校的暗黑美学与交互反馈，让练习与阅读成为一种享受。",
    "gallery.tab.home": "首页导航",
    "gallery.tab.translator": "智能互译",
    "gallery.tab.player": "电码播放器",
    "gallery.tab.window": "听抄阅读窗口",

    "dl.badge": "多端适配",
    "dl.title": "选择适合你的版本",
    "dl.subtitle": "所有版本均通过数字签名与 Hash 校验，安全、纯净、无任何广告与追踪。",
    "dl.win.desc": "Windows 10 / 11 (64位)",
    "dl.mac.desc": "macOS 11.0+ (Universal / Apple Silicon & Intel)",
    "dl.linux.desc": "Ubuntu, Debian, Fedora, Arch 等主流发行版",
    "dl.mobile.title": "移动端 · 微信小程序",
    "dl.mobile.desc": "免安装即开即用 · 微信扫码即刻体验「HAM百宝箱」",
    "dl.mobile.qr_tip": "微信扫一扫 · 打开 HAM百宝箱",
    "dl.mobile.status": "🟢 微信小程序已就绪",

    "footer.desc": "专业的摩尔斯电码与标准电码训练终端。在无声的电波中，传递我们的专属密语。",
    "footer.links.product": "产品",
    "footer.links.resources": "资源",
    "footer.links.community": "社区",
    "footer.repo": "GitHub 仓库",
    "footer.releases": "历史版本",
    "footer.license": "GPL-3.0 协议",
    "footer.author": "作者主页 (BA8BAK)",
    "footer.rights": "版权所有。基于 GPL-3.0 协议开源。"
  },
  en: {
    "nav.features": "Features",
    "nav.player": "CW Player",
    "nav.translator": "Translator",
    "nav.demo": "Live Demo",
    "nav.preview": "Terminal",
    "nav.downloads": "Download",
    
    "hero.badge": "v0.1.15 is now available",
    "hero.title_html": "Professional Morse Code<br class=\"hero-br\"><span class=\"gradient-text\">&amp; Chinese Telecode Terminal</span>",
    "hero.subtitle": "A lightweight, modern, and professional Morse code practice and Chinese Telecode translation desktop terminal built with Tauri + React. Designed for amateur radio enthusiasts (HAM) and telegraphers.",
    "hero.download_auto": "Download Free",
    "hero.all_platforms": "View All Platforms",
    "hero.detected_platform": "Detected your operating system:",
    "hero.source_label": "Download Source:",
    "hero.source_cdn": "China High-speed CDN",
    "hero.source_github": "Official GitHub",

    "mockup.nav.home": "Home",
    "mockup.nav.translator": "Translator",
    "mockup.nav.player": "CW Player",
    "mockup.nav.settings": "Settings",
    "mockup.greeting": "Good day, Welcome to MoYu",
    "mockup.sub": "Professional Morse Code & Telecode Training Terminal",
    "mockup.card.trans.title": "Smart Translator",
    "mockup.card.trans.desc": "Bidirectional translation between Chinese, Telecodes & Morse",
    "mockup.card.player.title": "CW Player",
    "mockup.card.player.desc": "Import TXT or EPUB with highlighted tracking audio playback",
    "mockup.recent.title": "Recommended Built-in Materials",

    "demo.badge": "Interactive Demo",
    "demo.title": "Online Morse Telegraph Simulator",
    "demo.subtitle": "Type any text to convert to Morse code instantly and experience real 800Hz side-tone telegraph audio.",
    "demo.input_label": "Input Text (Letters / Numbers)",
    "demo.output_label": "Morse Code",
    "demo.wpm_label": "Speed (WPM):",
    "demo.freq_label": "Frequency (Hz):",
    "demo.play": "Play Morse Sound",
    "demo.stop": "Stop Audio",

    "feat.badge": "Highlights",
    "feat.title": "Crafted for Amateur Radio & CW Practice",
    "feat.subtitle": "Breaking the limitation of English-only Morse tools by seamlessly integrating Chinese Telecodes with modern eBook CW reading.",
    
    "feat.1.title": "Smart Telecode Translator",
    "feat.1.desc": "Supports bidirectional conversion between Chinese characters, 4-digit standard Chinese Telecodes, and Morse code with auto-detection.",
    "feat.2.title": "Immersive CW eBook Player",
    "feat.2.desc": "Import local TXT and EPUB eBooks, automatically parse chapter outlines, and listen to real-time Morse code with highlighted tracking.",
    "feat.3.title": "Radio Audio Simulation",
    "feat.3.desc": "Customize WPM speed, side-tone Hz, and vintage radio tube overdrive harmonic distortion for authentic on-air listening practice.",
    "feat.4.title": "Ultra-lightweight Architecture",
    "feat.4.desc": "Built with Rust + Tauri, consuming under 100MB RAM, instant launch, and unified experience across Windows, macOS, Linux, and Android.",

    "gallery.badge": "Interface",
    "gallery.title": "Clean, Modern, and Distraction-free",
    "gallery.subtitle": "Fine-tuned dark aesthetics and smooth interactions designed for focused training.",
    "gallery.tab.home": "Home Hub",
    "gallery.tab.translator": "Smart Translator",
    "gallery.tab.player": "CW Player",
    "gallery.tab.window": "Reader Window",

    "dl.badge": "Downloads",
    "dl.title": "Choose Your Platform",
    "dl.subtitle": "All binaries are cryptographically signed and SHA256 verified. Free, safe, and open-source.",
    "dl.win.desc": "Windows 10 / 11 (64-bit)",
    "dl.mac.desc": "macOS 11.0+ (Universal / Apple Silicon & Intel)",
    "dl.linux.desc": "Ubuntu, Debian, Fedora, Arch Linux",
    "dl.mobile.title": "Mobile · WeChat Mini Program",
    "dl.mobile.desc": "Zero-install, instant access · Scan QR code to launch HAM Tools",
    "dl.mobile.qr_tip": "Scan with WeChat to open HAM Tools",
    "dl.mobile.status": "🟢 Mini Program Ready",

    "footer.desc": "A professional Morse code and Chinese Telecode training terminal. Sending our secret codes across silent radio waves.",
    "footer.links.product": "Product",
    "footer.links.resources": "Resources",
    "footer.links.community": "Community",
    "footer.repo": "GitHub Repository",
    "footer.releases": "Release Notes",
    "footer.license": "GPL-3.0 License",
    "footer.author": "Author (BA8BAK)",
    "footer.rights": "All rights reserved. Open-sourced under GPL-3.0."
  }
};

// Current App Version State
let currentVersion = '0.1.15';
let downloadSource = 'cdn'; // 'cdn' or 'github'

const CDN_BASE = `https://moyu-dl.wjzhx.com/Ansen/MoYu/releases/download`;
const GITHUB_BASE = `https://github.com/Ansen/MoYu/releases/download`;

function getDownloadUrls(ver = currentVersion) {
  const base = downloadSource === 'cdn' ? CDN_BASE : GITHUB_BASE;
  return {
    win: `${base}/v${ver}/MoYu_${ver}_x64-setup.exe`,
    macArm: `${base}/v${ver}/MoYu_aarch64.app.tar.gz`,
    macIntel: `${base}/v${ver}/MoYu_x64.app.tar.gz`,
    linuxDeb: `${base}/v${ver}/MoYu_${ver}_amd64.deb`,
    linuxAppImage: `${base}/v${ver}/MoYu_${ver}_amd64.AppImage`,
  };
}

// ==========================================================================
// 2. Intelligent Adaptive Screenshots Engine
// ==========================================================================
const screenshots = {
  home: {
    dark: {
      zh: 'screenshort/home_dark_cn.png',
      en: 'screenshort/home_dark_en.png'
    },
    light: {
      zh: 'screenshort/home_light.png',
      en: 'screenshort/home_light.png'
    }
  },
  player: {
    dark: {
      zh: 'screenshort/cw-player-dark.png',
      en: 'screenshort/cw-player-dark.png'
    },
    light: {
      zh: 'screenshort/cw-player-light.png',
      en: 'screenshort/cw-player-light.png'
    }
  },
  translator: {
    dark: {
      zh: 'screenshort/trans_dark_en.png',
      en: 'screenshort/trans_dark_en.png'
    },
    light: {
      zh: 'screenshort/trans_light.png',
      en: 'screenshort/trans_light.png'
    }
  }
};

let currentGalleryTab = 'home';

function updateScreenshots() {
  const langKey = currentLang === 'zh' ? 'zh' : 'en';
  const themeKey = currentTheme === 'dark' ? 'dark' : 'light';

  // 1. Update Hero Preview Image (Home Workspace)
  const heroImg = document.getElementById('hero-preview-img');
  if (heroImg && screenshots.home[themeKey]) {
    const targetSrc = screenshots.home[themeKey][langKey] || screenshots.home[themeKey].zh;
    if (!heroImg.src.endsWith(targetSrc)) {
      heroImg.style.opacity = '0.3';
      setTimeout(() => {
        heroImg.src = targetSrc;
        heroImg.style.opacity = '1';
      }, 120);
    }
  }

  // 2. Update Gallery Showcase Image
  const galleryImg = document.getElementById('gallery-img');
  const galleryTitle = document.getElementById('gallery-window-title');
  if (galleryImg && screenshots[currentGalleryTab]?.[themeKey]) {
    const targetSrc = screenshots[currentGalleryTab][themeKey][langKey] || screenshots[currentGalleryTab][themeKey].zh;
    galleryImg.style.opacity = '0.3';
    setTimeout(() => {
      galleryImg.src = targetSrc;
      galleryImg.style.opacity = '1';
    }, 120);
  }
}

// ==========================================================================
// 3. Language & Theme Management (Follow System by Default)
// ==========================================================================
function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSystemLang() {
  const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  return navLang.startsWith('zh') ? 'zh' : 'en';
}

let currentLang = localStorage.getItem('moyu_lang') || getSystemLang();
let currentTheme = localStorage.getItem('moyu_theme') || getSystemTheme();

function setLanguage(lang, save = true) {
  currentLang = lang;
  if (save) localStorage.setItem('moyu_lang', lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

  const dict = translations[lang] || translations.zh;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  const titleContainer = document.getElementById('hero-title-container');
  if (titleContainer && dict["hero.title_html"]) {
    titleContainer.innerHTML = dict["hero.title_html"];
  }

  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) langBtn.textContent = lang === 'zh' ? 'EN' : '中文';

  detectAndHighlightPlatform();
  updateScreenshots();
}

function setTheme(theme, save = true) {
  currentTheme = theme;
  if (save) localStorage.setItem('moyu_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);

  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  updateScreenshots();
}

// ==========================================================================
// 3. Platform Detection
// ==========================================================================
function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/mac/i.test(platform) || /macintosh/i.test(ua)) return 'mac';
  if (/win/i.test(platform) || /windows/i.test(ua)) return 'win';
  if (/linux/i.test(platform) || /linux/i.test(ua)) return 'linux';
  return 'win';
}

function detectAndHighlightPlatform() {
  const p = detectPlatform();
  const urls = getDownloadUrls();
  const mainBtn = document.getElementById('hero-main-download-btn');
  const platformText = document.getElementById('detected-platform-text');

  let btnLabel = '';
  let targetUrl = urls.win;
  let name = 'Windows (x64 .exe)';

  if (p === 'win') {
    name = 'Windows 10/11 (64-bit)';
    targetUrl = urls.win;
  } else if (p === 'mac') {
    name = 'macOS (Apple Silicon & Intel)';
    targetUrl = urls.macArm;
  } else if (p === 'linux') {
    name = 'Linux (x86_64 .deb)';
    targetUrl = urls.linuxDeb;
  } else if (p === 'android' || p === 'ios') {
    name = currentLang === 'zh' ? '微信小程序「HAM百宝箱」' : 'WeChat Mini Program (HAM Tools)';
    targetUrl = '#downloads';
  }

  if (platformText) {
    platformText.textContent = `${translations[currentLang]["hero.detected_platform"]} ${name}`;
  }

  if (mainBtn) {
    mainBtn.href = targetUrl;
    const textSpan = mainBtn.querySelector('.btn-text');
    if (textSpan) {
      if (p === 'android' || p === 'ios') {
        textSpan.textContent = currentLang === 'zh' ? '移动端 · 打开「HAM百宝箱」小程序' : 'Open HAM Tools Mini Program';
      } else {
        textSpan.textContent = `${translations[currentLang]["hero.download_auto"]} (${name.split(' ')[0]})`;
      }
    }
  }

  // Update matrix links
  updateDownloadMatrixLinks();
}

function updateDownloadMatrixLinks() {
  const urls = getDownloadUrls();
  document.querySelectorAll('[data-dl-target]').forEach(el => {
    const target = el.getAttribute('data-dl-target');
    if (urls[target]) {
      el.href = urls[target];
    }
  });
}

// ==========================================================================
// 4. Interactive Live Morse Web Audio
// ==========================================================================
const MORSE_MAP = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
  '9': '----.', '0': '-----', ' ': '/'
};

function textToMorse(text) {
  return text.toUpperCase().split('').map(char => MORSE_MAP[char] || '').filter(Boolean).join(' ');
}

let audioCtx = null;
let isPlayingMorse = false;
let morseTimeouts = [];

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, durationMs) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  // Soft attack and release envelope to prevent clicks
  const attack = 0.005;
  const release = 0.005;
  const now = ctx.currentTime;
  const durSec = durationMs / 1000;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + attack);
  gain.gain.setValueAtTime(0.3, now + durSec - release);
  gain.gain.linearRampToValueAtTime(0, now + durSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durSec);
}

function stopMorsePlayback() {
  isPlayingMorse = false;
  morseTimeouts.forEach(clearTimeout);
  morseTimeouts = [];

  const playBtn = document.getElementById('demo-play-btn');
  if (playBtn) {
    playBtn.classList.remove('playing');
    playBtn.textContent = translations[currentLang]["demo.play"];
  }
}

function playMorseSequence(morseStr, wpm = 20, freq = 700) {
  stopMorsePlayback();
  isPlayingMorse = true;

  const playBtn = document.getElementById('demo-play-btn');
  if (playBtn) {
    playBtn.classList.add('playing');
    playBtn.textContent = translations[currentLang]["demo.stop"];
  }

  // Standard PARIS Morse timing: Dot duration = 1200 / WPM ms
  const dotDuration = 1200 / wpm;
  const dashDuration = dotDuration * 3;
  const symbolGap = dotDuration;
  const letterGap = dotDuration * 3;
  const wordGap = dotDuration * 7;

  let currentDelay = 0;

  for (let i = 0; i < morseStr.length; i++) {
    const char = morseStr[i];
    if (char === '.') {
      const t = setTimeout(() => {
        if (isPlayingMorse) playTone(freq, dotDuration);
      }, currentDelay);
      morseTimeouts.push(t);
      currentDelay += dotDuration + symbolGap;
    } else if (char === '-') {
      const t = setTimeout(() => {
        if (isPlayingMorse) playTone(freq, dashDuration);
      }, currentDelay);
      morseTimeouts.push(t);
      currentDelay += dashDuration + symbolGap;
    } else if (char === ' ') {
      currentDelay += letterGap - symbolGap;
    } else if (char === '/') {
      currentDelay += wordGap - symbolGap;
    }
  }

  const endTimeout = setTimeout(() => {
    stopMorsePlayback();
  }, currentDelay + 100);
  morseTimeouts.push(endTimeout);
}


// ==========================================================================
// 6. Dynamic Version Fetch from CDN
// ==========================================================================
async function fetchLatestVersion() {
  try {
    const res = await fetch('https://moyu-dl.wjzhx.com/Ansen/MoYu/releases/latest/download/latest-cdn.json');
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        currentVersion = data.version;
        document.querySelectorAll('.version-badge-text').forEach(el => {
          el.textContent = `v${currentVersion}`;
        });
        detectAndHighlightPlatform();
      }
    }
  } catch {
    // Keep fallback v0.1.15
  }
}

// ==========================================================================
// 7. Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  setTheme(currentTheme);
  setLanguage(currentLang);
  fetchLatestVersion();

  // Gallery Tab clicks
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGalleryTab = btn.getAttribute('data-tab') || 'home';
      updateScreenshots();
    });
  });

  // Language toggle
  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      setLanguage(currentLang === 'zh' ? 'en' : 'zh');
    });
  }

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      setTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
    });
  }

  // Follow OS system theme dynamic changes if not manually overridden
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('moyu_theme')) {
        setTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }

  // CDN vs GitHub Toggle
  const cdnBtns = document.querySelectorAll('.cdn-toggle-btn');
  cdnBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cdnBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      downloadSource = btn.getAttribute('data-source');
      detectAndHighlightPlatform();
    });
  });

  // Live Morse Demo Binding
  const demoInput = document.getElementById('demo-input');
  const demoOutput = document.getElementById('demo-output');
  const demoPlayBtn = document.getElementById('demo-play-btn');
  const wpmSlider = document.getElementById('wpm-slider');
  const wpmVal = document.getElementById('wpm-val');
  const freqSlider = document.getElementById('freq-slider');
  const freqVal = document.getElementById('freq-val');

  if (demoInput && demoOutput) {
    demoInput.addEventListener('input', (e) => {
      demoOutput.value = textToMorse(e.target.value);
    });
  }

  if (wpmSlider && wpmVal) {
    wpmSlider.addEventListener('input', (e) => {
      wpmVal.textContent = e.target.value;
    });
  }

  if (freqSlider && freqVal) {
    freqSlider.addEventListener('input', (e) => {
      freqVal.textContent = `${e.target.value} Hz`;
    });
  }

  if (demoPlayBtn && demoOutput) {
    demoPlayBtn.addEventListener('click', () => {
      if (isPlayingMorse) {
        stopMorsePlayback();
      } else {
        const text = demoOutput.value.trim();
        if (!text) return;
        const wpm = parseInt(wpmSlider.value, 10) || 20;
        const freq = parseInt(freqSlider.value, 10) || 380;
        playMorseSequence(text, wpm, freq);
      }
    });
  }
});
