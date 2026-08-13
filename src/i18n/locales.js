export const translations = {
  zh: {
    'app.name': '摩语',

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
    'menu.help.guide': '使用帮助指南',
    'menu.help.about': '关于 摩语',
    
    // 侧边栏
    'sidebar.home': '首页导航',
    'sidebar.explorer': '功能导航',
    'sidebar.translator': '摩言密语',
    'sidebar.library': '电码播放器',
    
    // 摩言密语
    'translator.editor.title': '摩言密语 (自动识别)',
    'translator.editor.placeholder': '在此输入需要转换的中文、摩尔斯码或标准电码...',
    'translator.loading': '加载字典...',
    'translator.chinese': '中文 (CHINESE)',
    'translator.codes': '标准电码 (TELECODES)',
    'translator.morse': '摩尔斯码 (MORSE CODE)',
    'translator.output.placeholder': '翻译输出结果',
    
    // 播放器 (Player)
    'library.title': '工作区 / 播放列表',
    'library.import.file': '打开文件',
    'library.import.folder': '打开文件夹',
    'library.gen.numbers': '生成数码报底',
    'library.gen.letters': '生成英文分组报底',
    'library.clear.all': '全部清除',
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
    'settings.dict.1983t': '标准电码 (1983 台湾版)',
    'settings.dict.custom': '自定义加密字典',
    'settings.audio': '摩尔斯电码音频 (Morse Audio)',
    'settings.audio.speed': '发报速度 (WPM)',
    'settings.audio.freq': '音调频率 (Hz)',
    'settings.cancel': '取消',
    'settings.save': '保存设置',
    
    // 问候语
    'greeting.earlyMorning': '凌晨好',
    'greeting.morning': '早上好',
    'greeting.noon': '中午好',
    'greeting.afternoon': '下午好',
    'greeting.evening': '晚上好',

    // 首页
    'home.welcome': '欢迎使用 摩语',
    'home.subtitle': '专业的摩尔斯电码与标准电码训练终端',
    'home.translator.title': '摩言密语',
    'home.translator.desc': '支持中文、标准电码、摩尔斯码之间的双向互译与自动识别。',
    'home.player.title': '电码播放器',
    'home.player.desc': '导入 TXT 或 EPUB 电子书，支持原文章节解析与沉浸式摩尔斯电码跟读训练。',
    'home.recent': '最近打开的文档',
    'home.card.launch': '进入工具',
    
    // 更新
    'update.check': '检查更新',
    'update.checking': '正在检查更新...',
    'update.available': '发现新版本！',
    'update.uptodate': '当前已是最新版本。',
    'update.download.github': 'GitHub 官方下载',
    'update.download.proxy': '国内加速下载',
    'update.install.restart': '立刻更新并重启',
    'update.downloading': '正在下载更新...',
    'update.failed': '更新失败',
    
    // 标题栏
    'titlebar.restore': '向下还原',
    'titlebar.maximize': '最大化',

    // 帮助指南
    'help.title': '使用帮助指南',
    'help.core.title': '核心功能 (Core)',
    'help.core.1': '听读文章：',
    'help.core.1.desc': '点击顶部工具栏的“播放”按钮，软件会将当前高亮的单词转换为摩斯电码声音播报。',
    'help.core.2': '指定起点：',
    'help.core.2.desc': '在阅读界面，点击任意单词/段落，即可直接从该位置开始播放。',
    'help.core.3': '导入书籍：',
    'help.core.3.desc': '在“阅读器”界面，点击侧边栏下方的导入按钮，支持选择本地的 .txt 或 .epub 文件。也可直接将文件拖拽进窗口。',
    
    'help.settings.title': '发报参数 (Settings)',
    'help.settings.1': 'WPM (词语速度)：',
    'help.settings.1.desc': 'Words Per Minute。数值越大，发报速度越快。新手建议设置在 15~20 左右，熟练后可逐渐提高。',
    'help.settings.2': 'Hz (音调频率)：',
    'help.settings.2.desc': '控制摩斯电码的音高。通常在 600Hz ~ 800Hz 之间听感最佳。如果您觉得高频刺耳，可适当调低至 500Hz。',
    'help.settings.3': '数字模式：',
    'help.settings.3.desc': '短码（只发报单个点或划，适合专业比赛）；长码（标准全码发送，适合日常训练）。',
    
    'help.shortcuts.title': '快捷操作 (Shortcuts)',
    'help.shortcuts.play': '播放 / 暂停',
    'help.shortcuts.play.key': 'Space / 空格键',
    'help.shortcuts.prev': '上一页 / 上一章',
    'help.shortcuts.prev.key': '← 向左方向键',
    'help.shortcuts.next': '下一页 / 下一章',
    'help.shortcuts.next.key': '→ 向右方向键'
  },
  en: {
    'app.name': 'MoYu',

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
    'menu.help.guide': 'User Guide',
    'menu.help.about': 'About MoYu',
    
    // Sidebar
    'sidebar.home': 'Home',
    'sidebar.explorer': 'NAVIGATION',
    'sidebar.translator': 'Smart Translator',
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
    'library.import.file': 'Open File',
    'library.import.folder': 'Open Folder',
    'library.gen.numbers': 'Generate Numbers',
    'library.gen.letters': 'Generate Letter Groups',
    'library.clear.all': 'Clear All',
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
    'settings.dict.1983t': 'Telecodes (1983 Taiwan)',
    'settings.dict.custom': 'Custom Crypto Dictionary',
    'settings.audio': 'Morse Audio',
    'settings.audio.speed': 'Speed (WPM)',
    'settings.audio.freq': 'Tone Frequency (Hz)',
    'settings.cancel': 'Cancel',
    'settings.save': 'Save Settings',

    // Greetings
    'greeting.earlyMorning': 'Good early morning',
    'greeting.morning': 'Good morning',
    'greeting.noon': 'Good afternoon',
    'greeting.afternoon': 'Good afternoon',
    'greeting.evening': 'Good evening',
    
    // Home
    'home.welcome': 'Welcome to MoYu',
    'home.subtitle': 'Professional Morse Code & Telecode Training Terminal',
    'home.translator.title': 'Smart Translator',
    'home.translator.desc': 'Bidirectional translation between Chinese, Telecodes, and Morse Code with auto-detection.',
    'home.player.title': 'Morse Player',
    'home.player.desc': 'Import TXT or EPUB files for immersive Morse code reading and listening practice.',
    'home.recent': 'Recent Documents',
    'home.card.launch': 'Open Tool',
    
    // Updater
    'update.check': 'Check for Updates',
    'update.checking': 'Checking for updates...',
    'update.available': 'New version available!',
    'update.uptodate': 'You are up to date.',
    'update.download.github': 'Download from GitHub',
    'update.download.proxy': 'Download via Proxy (China)',
    'update.install.restart': 'Install Update and Restart',
    'update.downloading': 'Downloading Update...',
    'update.failed': 'Update Failed',
    
    // Titlebar
    'titlebar.restore': 'Restore Down',
    'titlebar.maximize': 'Maximize',

    // Help Guide
    'help.title': 'User Guide',
    'help.core.title': 'Core Features',
    'help.core.1': 'Listening:',
    'help.core.1.desc': 'Click the "Play" button in the top toolbar to convert highlighted words into Morse code audio.',
    'help.core.2': 'Start Point:',
    'help.core.2.desc': 'In the reader view, click any word or paragraph to start playing directly from that position.',
    'help.core.3': 'Import Books:',
    'help.core.3.desc': 'In the "Library" view, click the import button in the sidebar to open local .txt or .epub files. You can also drag and drop files into the window.',
    
    'help.settings.title': 'Audio Settings',
    'help.settings.1': 'WPM (Speed):',
    'help.settings.1.desc': 'Words Per Minute. Higher values mean faster speed. Beginners are recommended to start around 15-20.',
    'help.settings.2': 'Hz (Frequency):',
    'help.settings.2.desc': 'Controls the pitch of the Morse code. 600Hz - 800Hz usually sounds best. If it is too harsh, lower it to 500Hz.',
    'help.settings.3': 'Number Mode:',
    'help.settings.3.desc': 'Short code (single dot/dash, suitable for competitions) vs Long code (standard full code, suitable for training).',
    
    'help.shortcuts.title': 'Shortcuts',
    'help.shortcuts.play': 'Play / Pause',
    'help.shortcuts.play.key': 'Space',
    'help.shortcuts.prev': 'Previous Page / Chapter',
    'help.shortcuts.prev.key': '← Left Arrow',
    'help.shortcuts.next': 'Next Page / Chapter',
    'help.shortcuts.next.key': '→ Right Arrow'
  }
};

