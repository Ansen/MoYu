# 📡 MoYu (摩语) - Morse Code & Chinese Telecode Training Terminal

Language: [English](README.md) | [简体中文](README_CN.md)

> *"Transmitting our secret signals through silent radio waves."*

**MoYu (摩语)** is a lightweight, minimalist, and professional Morse code training terminal and Chinese telecode translator built with **Tauri (Rust) + React**. Designed for Amateur Radio (HAM) operators, Morse code learners, and secret signal enthusiasts.

---

## ✨ Features

- **🕵️‍♂️ Smart Translation Terminal (Morse & Telecode)**:
  - **Full Chinese Support**: Breaks the limitation of traditional Morse code by enabling seamless bi-directional translation between Chinese characters, Chinese Telecode (标准电码), and Morse code.
  - **Auto Detection**: Automatically detects whether your input is Chinese, telecode numbers, or Morse code without requiring manual mode switching.

- **📻 Audio Code Player (Immersive CW Training)**:
  - **E-Book Reader**: Import local `.txt` or `.epub` files directly with automatic chapter parsing.
  - **Real-Time CW Playback**: Converts text to authentic telegraph audio in real time with synchronized text highlighting.
  - **Vintage Radio Audio Engine**: Customizable WPM (words per minute), side-tone frequency (Hz), and vintage radio harmonic distortion simulation for realistic copy practice.
  - **Numeric Code Modes**: Full support for Standard Long Codes, Abbreviated 5-digit Codes, and Abbreviated 10-digit Codes.

- **📚 Custom Dictionary System**:
  - Built-in standard Chinese Telecode dictionary.
  - Supports importing and managing custom external dictionaries.

- **🚀 Modern Cross-Platform Architecture**:
  - Powered by **Tauri (Rust)**: Ultra-small binary size, fast startup time, and low memory usage.
  - Cross-platform support for **Windows**, **macOS** (Intel & Apple Silicon), and **Linux**.
  - High-DPI screen adaptive layout.

---

## 🛠 Development & Build

This project uses `pnpm` as the package manager and `Tauri` with `Rust` for the desktop backend.

### Prerequisites

1. [Node.js](https://nodejs.org/) (v18+)
2. [pnpm](https://pnpm.io/installation)
3. [Rust](https://www.rust-lang.org/tools/install) & [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Ansen/MoYu.git
cd MoYu

# Install dependencies
pnpm install

# Run dev server & Tauri window
pnpm tauri dev
```

### Building for Release

```bash
# Build binary installer for current platform (.exe / .dmg / .deb)
pnpm tauri build
```

---

## 🤝 Contributing

Issues and Pull Requests are welcome! Feel free to report bugs or submit feature requests.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the [LICENSE](LICENSE) file for details.

Copyright © 2024-2026 BA8BAK