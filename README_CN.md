# 📡 摩语 (MoYu) - 专业的摩尔斯电码与标准电码训练终端

语言: [English](README.md) | [简体中文](README_CN.md)

> “在无声的电波中，传递我们的专属密语。”

**摩语 (MoYu)** 是一款基于 **Tauri + React** 构建的轻量、极简且专业的摩尔斯密码训练与中文电码互译桌面应用。无论是业余无线电爱好者（HAM）进行抄报训练、查阅标准电码，还是加密发送专属暗号，摩语都能为你提供丝滑、沉浸的使用体验。

---

## ✨ 核心特性 (Features)

*   **🕵️‍♂️ 摩言密语 (智能互译)**：
    *   **中文完美支持**：打破传统摩斯码只支持英文的限制，实现中文汉字与标准电码、摩斯电码的精准双向互译。
    *   **自动识别**：无需手动切换模式，边输入边智能识别当前是中文、电码还是摩尔斯码，并极速转换。
*   **📻 电码播放器 (沉浸式训练)**：
    *   **TXT & EPUB 阅读**：直接导入本地 TXT 或 EPUB 电子书，自动解析章节目录。
    *   **实时发报模拟**：将文字实时转化为发报声进行播放跟读，支持高亮追踪阅读进度。
    *   **专业电台音效**：支持自定义发报速度 (WPM)、侧音频率 (Hz)，甚至提供**老式电台过载失真 (谐波)** 音效模拟，还原真实的听抄体验。
    *   **数字报底模式**：全面支持标准长码、短五码、短十码切换。
*   **📚 字典系统**：
    *   内置标准中文电码字典。
    *   支持导入外部自定义字典（例如台湾地区电码标准），并支持可视化字典管理。
*   **🚀 现代化跨平台架构**：
    *   基于 **Tauri (Rust)** 构建，体积轻巧，启动极速，资源占用极低。
    *   完美适配 **Windows**、**macOS** (Intel / Apple Silicon) 与 **Linux** 平台。
    *   支持高分屏自适应，全屏无损缩放。

---

## 🛠 开发与构建 (Development)

本项目使用 `pnpm` 作为前端包管理器，后端基于 `Tauri` 与 `Rust`。

### 环境准备
1. 安装 [Node.js](https://nodejs.org/) (推荐使用 v18+)
2. 安装 [pnpm](https://pnpm.io/installation) 
3. 安装 [Rust](https://www.rust-lang.org/tools/install) 与 Tauri 相关的 [系统依赖](https://tauri.app/v1/guides/getting-started/prerequisites)

### 快速运行
```bash
# 克隆项目
git clone https://github.com/Ansen/MoYu.git
cd MoYu

# 安装前端依赖
pnpm install

# 启动开发服务器与 Tauri 窗口
pnpm tauri dev
```

### 编译打包
```bash
# 打包为当前系统平台的可执行文件 (Windows exe / macOS app / Linux deb)
pnpm tauri build
```

---

## 🤝 贡献与反馈

欢迎提交 Issue 反馈问题，或者发起 Pull Request 贡献代码！

---

## 📄 版权与许可 (License)

本项目采用 **GNU General Public License v3.0 (GPL-3.0)** 许可证开源。详情请参阅 [LICENSE](LICENSE) 文件。

Copyright © 2024-2026 BA8BAK
