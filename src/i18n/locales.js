export const translations = {
  zh: {
    // 菜单栏
    'menu.view': '主题(T)',
    'menu.view.system': '跟随系统',
    'menu.view.light': '浅色模式',
    'menu.view.dark': '深色模式',
    
    'menu.language': '语言(L)',
    'menu.language.system': '跟随系统',
    'menu.language.zh': '简体中文',
    'menu.language.en': 'English',

    'menu.settings': '设置(S)',
    'menu.settings.prefs': '全局偏好设置',
    
    'menu.help': '帮助(H)',
    'menu.help.about': '关于 摩语',
    
    // 侧边栏
    'sidebar.home': '首页导航',
    'sidebar.explorer': '功能导航',
    'sidebar.translator': '摩言摩语',
    'sidebar.library': '电码播放器',
    
    // 摩言摩语
    'translator.editor.title': '摩言摩语 (自动识别)',
    'translator.editor.placeholder': '在此输入需要转换的中文、摩尔斯码或标准电码...',
    'translator.loading': '加载字典...',
    'translator.chinese': '中文 (CHINESE)',
    'translator.codes': '标准电码 (TELECODES)',
    'translator.morse': '摩尔斯码 (MORSE CODE)',
    'translator.output.placeholder': '翻译输出结果',
    
    // 播放器 (Player)
    'library.title': '工作区 / 播放列表',
    'library.import.file': '+ 打开文件',
    'library.import.folder': '+ 打开文件夹',
    'library.opening': '正在打开...',
    'library.empty.title': '没有打开的文档',
    'library.empty.desc': '打开一个 EPUB 或 TXT 文件以开始阅读和练习。',
    'library.recent': '最近打开',
    
    // 偏好设置
    'settings.title': '全局偏好设置 (Preferences)',
    'settings.startup': '启动行为 (Startup)',
    'settings.startup.home': '始终进入首页导航',
    'settings.startup.restore': '恢复上次退出的页面',
    'settings.dict': '标准电码词典 (Telecode Dictionary)',
    'settings.dict.1983m': '标准电码 (1983 大陆版)',
    'settings.dict.1983t': '标准电码 (1983 台湾版) - 暂未实现',
    'settings.dict.custom': '自定义加密字典 - 暂未实现',
    'settings.audio': '摩尔斯电码音频 (Morse Audio)',
    'settings.audio.speed': '发报速度 (WPM)',
    'settings.audio.freq': '音调频率 (Hz)',
    'settings.cancel': '取消',
    'settings.save': '保存设置',
    
    // 首页
    'home.welcome': '欢迎使用 摩语 MoYu',
    'home.subtitle': '专业的摩尔斯电码与标准电码训练终端',
    'home.translator.title': '摩言摩语',
    'home.translator.desc': '支持中文、标准电码、摩尔斯码之间的双向互译与自动识别。',
    'home.player.title': '电码播放器',
    'home.player.desc': '导入 TXT 或 EPUB 电子书，支持原文章节解析与沉浸式摩尔斯电码跟读训练。',
    'home.recent': '最近打开的文档'
  },
  en: {
    // Menubar
    'menu.view': 'Theme(T)',
    'menu.view.system': 'System Theme',
    'menu.view.light': 'Light Theme',
    'menu.view.dark': 'Dark Theme',
    
    'menu.language': 'Language(L)',
    'menu.language.system': 'System Default',
    'menu.language.zh': '简体中文',
    'menu.language.en': 'English',

    'menu.settings': 'Settings(S)',
    'menu.settings.prefs': 'Preferences',
    
    'menu.help': 'Help(H)',
    'menu.help.about': 'About MoYu',
    
    // Sidebar
    'sidebar.home': 'Home',
    'sidebar.explorer': 'NAVIGATION',
    'sidebar.translator': 'MoYan MoYu',
    'sidebar.library': 'Morse Player',
    
    // Translator
    'translator.editor.title': 'EDITOR (AUTO-DETECT)',
    'translator.editor.placeholder': 'Type Chinese, Telecodes, or Morse code here...',
    'translator.loading': 'Loading dictionary...',
    'translator.chinese': 'CHINESE',
    'translator.codes': 'TELECODES',
    'translator.morse': 'MORSE CODE',
    'translator.output.placeholder': 'Translation Output',
    
    // Player
    'library.title': 'WORKSPACE / PLAYLIST',
    'library.import.file': '+ Open File',
    'library.import.folder': '+ Open Folder',
    'library.opening': 'Opening...',
    'library.empty.title': 'No documents open.',
    'library.empty.desc': 'Open an EPUB or TXT file to start reading and practicing.',
    'library.recent': 'Recent Files',
    
    // Settings
    'settings.title': 'Preferences',
    'settings.startup': 'Startup Behavior',
    'settings.startup.home': 'Always show Home Dashboard',
    'settings.startup.restore': 'Restore last viewed page',
    'settings.dict': 'Telecode Dictionary',
    'settings.dict.1983m': 'Telecodes (1983 Mainland)',
    'settings.dict.1983t': 'Telecodes (1983 Taiwan) - WIP',
    'settings.dict.custom': 'Custom Crypto Dictionary - WIP',
    'settings.audio': 'Morse Audio',
    'settings.audio.speed': 'Speed (WPM)',
    'settings.audio.freq': 'Tone Frequency (Hz)',
    'settings.cancel': 'Cancel',
    'settings.save': 'Save Settings',
    
    // Home
    'home.welcome': 'Welcome to 摩语 MoYu',
    'home.subtitle': 'Professional Morse Code & Telecode Training Terminal',
    'home.translator.title': 'MoYan MoYu',
    'home.translator.desc': 'Bidirectional translation between Chinese, Telecodes, and Morse Code with auto-detection.',
    'home.player.title': 'Morse Player',
    'home.player.desc': 'Import TXT or EPUB files for immersive Morse code reading and listening practice.',
    'home.recent': 'Recent Documents'
  }
};
