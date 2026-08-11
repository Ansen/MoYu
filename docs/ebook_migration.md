# 电子书阅读器及桌面端重构日志

**日期**: 2026-08-11
**模块**: 桌面客户端集成 / 电子书播放器 / 音频引擎重构

## 1. 背景与目标
原先存在于 `ham-toolbox`（微信小程序）中的电子书莫尔斯电码跟读功能，因小程序平台的历史局限性（音频接口碎片化、环境封闭、缺乏标准 Web Audio API 支持等），代码冗余严重（约 1500 行）。
本次任务的目标是将该功能完整移植至当前的 `MoYu` (基于 React 19 + Vite) 项目，并将其直接升级为**跨平台、高性能、高颜值的原生桌面端应用**。

## 2. 技术选型与架构变更

### 2.1 桌面端框架：Tauri v2
- **原因**：项目纯前端主导，Tauri v2 可以做到零成本接入现有的 Vite 工程。最终打包体积只有几 MB，并且提供了强大的本地接口（文件系统、弹窗对话框）。
- **变更点**：在 `web/` 目录下初始化了 `src-tauri` 环境，配置了无边框透明窗口 (`transparent: true, decorations: false`)，并在顶层 UI 实现了拖拽栏 (`data-tauri-drag-region`)。

### 2.2 核心音频引擎重构 (极大优化)
- 移除了原 `ham-toolbox` 为了兼容 iOS 微信静音机制而编写的 `IOSSilentKeeper`。
- 移除了原小程序环境下基于 Base64 WAV 预渲染来规避 InnerAudioContext 缺陷的降级代码。
- **重构方案**：在 `src/utils/audioPlayer.js` 中直接采用标准 `Web Audio API` (`OscillatorNode`) 实现纯粹的硬件级正弦波合成，具备**微秒级**精度的发声响应和极简的包络线 (Envelope) 保护设计，彻底根除爆音。代码量由 1500+ 行骤减至不到 100 行。

### 2.3 文件解析与本地存储
- **文件选择**：引入 `@tauri-apps/plugin-dialog`，由系统原生对话框替代网页版的 input 标签。
- **EPUB 解析**：引入 `epub.js` 专门负责 EPUB 的排版渲染，设定为向下滚动的连续流式阅读 (`flow: 'scrolled-doc'`)。
- **进度持久化**：引入 `@tauri-apps/plugin-store`。通过自定义封装的 `src/utils/store.js`，将电子书进度 (CFI)、用户偏好安全地写入系统级的 `moyu-reader-settings.json` 本地应用数据文件中。解决了传统 IndexedDB 或 LocalStorage 容易被浏览器清理丢失的痛点。

## 3. 新增代码结构说明

在 `web/src/` 目录下，主要新增了以下模块：

- **`hooks/useEbook.js`**
  负责拉起操作系统的文件选择器、调用 Tauri 接口读取本地的 `.txt` 和 `.epub` 文件内容，并对 `epub.js` 实例进行初始化。

- **`components/Reader.jsx`**
  电子书阅读器的主要 UI 呈现组件，包含了：
  1. 顶部无边框的沉浸式控制栏（带系统级拖拽区域）。
  2. 中间的文字展示区。
  3. `epub.js` 的挂载渲染与样式注入。

- **`utils/audioPlayer.js`**
  基于桌面版最新 Web Audio 标准重构的高性能电码合成引擎。

- **`utils/store.js`**
  基于 Tauri Plugin Store 的纯本地文件读写封装，负责持久化书签与配置。

## 4. 后续规划 (TODOs)
- **翻译器联动**：目前 UI 已呈现，但文本选取后的莫尔斯电码生成逻辑尚未完全连接。需要将 `Translator` 的解析逻辑接入阅读器的取词选区。
- **设置面板**：在阅读器界面开发可视化的“跟读速度(WPM)”、“音频频率(Hz)”设置入口，并挂载到 `audioPlayer` 的实例参数上。
