# MoYu 项目代码审查报告

本报告对 MoYu (摩语) 项目的前端 React 代码进行了系统性的审查，指出了可优化的地方，包括组件提取、多余代码清理、性能优化及架构改进。

## 1. 可单独抽离的组件 (Component Extraction)

目前项目整体结构清晰，但部分页面存在 UI 相似且重复的代码块，建议将其抽离为独立的组件以提高复用性和可维护性：

- **`Titlebar.jsx` 中的下拉菜单**：
  文件中有多个具有相同结构的下拉菜单（视图、语言、设置、帮助）。它们的 HTML 结构、动画类名（`animate-in fade-in...`）、交互逻辑高度一致。
  - **建议**：抽离出统一的 `<DropdownMenu>` 和 `<DropdownItem>` 组件，通过配置数组来渲染这些菜单，极大地减少模板代码。

- **`Home.jsx` 中的功能卡片 (Feature Cards)**：
  “摩言摩语”和“电码播放器”这两个入口卡片的 DOM 结构几乎完全一样，只是图标、文字和点击事件不同。
  - **建议**：抽离出 `<FeatureCard>` 组件，通过传入 `title`, `desc`, `icon`, `onClick` 属性来渲染。

- **`Home.jsx` 和 `Library.jsx` 中的最近文件列表**：
  这两处都渲染了最近打开文件的列表（文件图标、名称、路径等），结构相似。
  - **建议**：抽离一个公共的 `<RecentFileItem>` 组件供首页和书库页共同使用。

- **`SettingsModal.jsx` 中的设置项**：
  各种 `<select>` 和 `<input type="range">` 组合结构重复。
  - **建议**：可以提取如 `<SettingRow>`, `<SettingSelect>`, `<SettingSlider>` 等微组件。

## 2. 多余与无用的代码 (Dead / Unused Code)

经过静态扫描和引用检查，项目中存在一些遗留的无用代码，建议清理以保持代码库整洁：

- **未使用的 CSS 文件 `src/App.css`**：
  该文件包含了一些 Vite 默认模板的样式（如 `.counter`, `.hero`, `#next-steps` 等）。但在 `App.jsx` 和 `main.jsx` 中并未引入该文件，完全是一份未使用的废弃代码。
  - **建议**：直接删除 `src/App.css` 文件。

- **未使用的 State 变量**：
  在 `src/components/Reader.jsx` 的第 25 行定义了：`const [showMoreMenu, setShowMoreMenu] = useState(false);`，但在文件中并未被使用过，实际控制菜单状态的是 `isMoreMenuOpen`。
  - **建议**：删除 `showMoreMenu` 的声明。

- **未使用的未导出函数/导入**：
  - 在 `src/components/layout/Titlebar.jsx` 中，导入了 `FolderOpen` 和 `LogOut`，但并未在代码中使用。
  - 在 `src/utils/store.js` 中，导出了 `saveGlobalSettings` 和 `loadGlobalSettings`，但全局并没有任何地方调用它们（目前设置直接存在 `localStorage` 中）。

## 3. 性能与最佳实践 (Performance & Best Practices)

- **`localStorage` 的直接访问**：
  目前项目中很多组件（如 `App.jsx`, `Reader.jsx`, `SettingsModal.jsx`）在 `useState` 的初始化函数或 `useEffect` 中直接读写 `localStorage`。
  - **建议**：可以封装一个自定义 Hook（如 `useLocalStorage`）来统一管理状态和本地存储的同步，避免每个组件自己去写样板代码。

- **事件监听器的优化**：
  - `Sidebar.jsx` 和 `TocSidebar.jsx` 都各自实现了一套拖拽调整宽度的逻辑（`mousemove` 和 `mouseup` 监听）。可以将这部分逻辑提取为一个公共的自定义 Hook `useResizable`，实现逻辑复用，并在 `mousemove` 中可以考虑加入 `requestAnimationFrame` 节流以提升调整时的渲染性能。

- **DOM 查找与修改的频率 (Reader.jsx / EpubEngine.jsx)**：
  在 `useHighlighter` 中，为了避免某些 WebView 的高亮 BUG，使用了插入 DOM 遮罩 (`#morse-active-overlay`) 的方式。目前是通过 `doc.getElementById` 去查找并更新位置，如果能在 React 层将其转化为受控的绝对定位浮层，性能和可控性会更好。

## 4. 架构与可维护性 (Architecture & Maintainability)

- **配置常量的集中管理**：
  在 `store.js`、`Reader.jsx` 等处，存储到 `localStorage` 的 key 是分散写死的字符串（如 `moyu_last_view`、`pref_startup`、`pref_dictionary` 等）。
  - **建议**：在一个单独的常量文件中（例如 `src/config/constants.js`）统一定义这些 Storage Keys，避免拼写错误和未来重构时的遗漏。

- **I18n (国际化) 的扩展性**：
  在 `Translator.jsx` 等视图中，部分提示文字（如“Type anything on the left to see magic happen”）和部分渲染逻辑还没有完全接入 i18n 系统。
  - **建议**：检查并提取所有的硬编码中文字符串到 `locales.js`，保证多语言的全面覆盖。

---
**总结**：
代码整体质量较高，特别是 Web Audio API 和 Epub.js 的封装处理得非常细腻。只要通过少量的组件抽离和废弃代码清理，项目的可维护性将能再上一个台阶。
