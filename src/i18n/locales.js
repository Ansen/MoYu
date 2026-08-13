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
    
    // 关于
    'about.author': '作者',
    'about.website': '网站',
    'about.email': '联系邮箱',
    'about.repo': '开源仓库',
    
    // 侧边栏
    'sidebar.home': '首页导航',
    'sidebar.explorer': '功能导航',
    'sidebar.translator': '摩言密语',
    'sidebar.library': '电码播放器',
    'sidebar.expand': '展开侧边栏',
    'sidebar.collapse': '折叠侧边栏',
    
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
    
    // 阅读器 (Reader)
    'reader.back': '返回书库',
    'reader.sidebar': '侧边栏',
    'reader.font.size': '字号 (px)',
    'reader.speed': '发报速度 (WPM)',
    'reader.freq': '侧音频率 (Hz)',
    'reader.more': '更多设置',
    'reader.skip.title': '跳过标题播放',
    'reader.hide.title': '隐藏正文大标题',
    'reader.harmonics': '电台失真音色 (谐波)',
    'reader.harmonics.desc': '开启后模拟真实老式电台的过载失真音色',
    'reader.number.mode': '数字报底模式',
    'reader.number.long': '长码',
    'reader.number.short5': '短五',
    'reader.number.short10': '短十',
    'reader.regenerate': '重新生成',
    'reader.play': '播放',
    'reader.pause': '暂停',
    'reader.resume': '继续',
    'reader.toc': '目录',
    'reader.filelist': '文件列表',
    
    // 字典导入 & 翻译器
    'dict.import.title': '导入自定义字典',
    'dict.import.desc': '支持导入 .txt 纯文本文件或 .json 格式的映射文件。请参考以下示例格式：',
    'dict.import.format.txt': 'TXT 格式',
    'dict.import.format.json': 'JSON 格式',
    'dict.import.btn': '选择文件并导入',
    'dict.import.success': '导入成功！',
    'dict.import.error.format': '导入失败：文件格式无法识别',
    'dict.import.error.read': '读取文件失败',
    'dict.selector.builtin': '内置字典',
    'dict.selector.custom': '自定义字典',
    'dict.selector.notfound': '未找到字典',
    'dict.btn.delete': '删除当前字典',
    'dict.btn.import': '导入',
    'dict.delete.confirm': '确定要删除此自定义字典吗？',
    
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
    'home.recent.clear': '清除此记录',
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
    
    // About
    'about.author': 'Author',
    'about.website': 'Website',
    'about.email': 'Email',
    'about.repo': 'Repository',
    
    // Sidebar
    'sidebar.home': 'Home',
    'sidebar.explorer': 'NAVIGATION',
    'sidebar.translator': 'Smart Translator',
    'sidebar.library': 'Morse Player',
    'sidebar.expand': 'Expand',
    'sidebar.collapse': 'Collapse',
    
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
    'library.gen.letters': 'Generate Letters',
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

    // Reader
    'reader.back': 'Back to Library',
    'reader.sidebar': 'Sidebar',
    'reader.font.size': 'Font Size (px)',
    'reader.speed': 'Speed (WPM)',
    'reader.freq': 'Tone Frequency (Hz)',
    'reader.more': 'More Settings',
    'reader.skip.title': 'Skip Title Playback',
    'reader.hide.title': 'Hide Main Title',
    'reader.harmonics': 'Radio Distortion (Harmonics)',
    'reader.harmonics.desc': 'Simulate the overload distortion tone of real vintage radios when enabled',
    'reader.number.mode': 'Number Mode',
    'reader.number.long': 'Long',
    'reader.number.short5': 'Short 5',
    'reader.number.short10': 'Short 10',
    'reader.regenerate': 'Regenerate',
    'reader.play': 'Play',
    'reader.pause': 'Pause',
    'reader.resume': 'Resume',
    'reader.toc': 'Table of Contents',
    'reader.filelist': 'File List',

    // Dictionary Import & Translator
    'dict.import.title': 'Import Custom Dictionary',
    'dict.import.desc': 'Supports importing .txt plain text files or .json mapping files. Please refer to the examples below:',
    'dict.import.format.txt': 'TXT Format',
    'dict.import.format.json': 'JSON Format',
    'dict.import.btn': 'Select File to Import',
    'dict.import.success': 'Import successful!',
    'dict.import.error.format': 'Import failed: Unrecognized file format',
    'dict.import.error.read': 'Failed to read file',
    'dict.selector.builtin': 'Built-in Dictionaries',
    'dict.selector.custom': 'Custom Dictionaries',
    'dict.selector.notfound': 'Dictionary not found',
    'dict.btn.delete': 'Delete Current Dictionary',
    'dict.btn.import': 'Import',
    'dict.delete.confirm': 'Are you sure you want to delete this custom dictionary?',

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
    'home.recent.clear': 'Clear this record',
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

