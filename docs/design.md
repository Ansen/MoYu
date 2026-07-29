# 摩尔斯码与中文互译工具 (MoYu) 架构设计

## 1. 总体架构与演进方向

本项目旨在提供一个支持中文、数字电码和摩尔斯码三态互译的工具。
- **当前阶段 (Web Demo)**：采用前后端完全分离架构。Go (Echo) 作为轻量级静态服务器提供宿载，核心的实时翻译逻辑完全在 React 前端完成（实现按键零延迟）。
- **未来阶段 (桌面 APP)**：当前的 React 前端代码可以直接嵌入 Tauri (Rust) 或 Wails (Go) 或 Electron 中，无需修改翻译核心逻辑即可打包为跨平台桌面应用。

## 2. 数据结构设计

由于 `1983.sql` 仅作为原始参考数据，我们对其进行重构。在 Web 和未来的桌面端，查询数据库（SQLite）会导致不必要的异步 I/O 延迟。因此将映射数据设计为内存字典（JSON）：

### 2.1 映射表格式 (JSON)
映射表将包含正向（中文->数字）和反向（数字->中文）两种结构的组合，供前端直接全量加载。
```json
{
  "version": "1.0",
  "name": "Standard_1983_with_Punctuation",
  "charToCode": {
    "一": "0001",
    "丁": "0002",
    "，": "9901",
    "。": "9902"
  },
  "codeToChar": {
    "0001": "一",
    "0002": "丁",
    "9901": "，",
    "9902": "。"
  }
}
```

### 2.2 标点符号与特殊字符保留策略
由于原生电码不包含现代标点，我们划定 `9900` - `9999` 作为保留区段用于常用标点，确保翻译句子的连贯性。

## 3. 技术选型 (基于规则)

| 模块 | 技术栈 | 说明 |
|------|--------|------|
| **前端框架** | React + Vite | 快速构建纯粹的 SPA，后续可无缝迁移至桌面壳 |
| **前端语言** | JavaScript | 按照规范禁用 TypeScript |
| **UI/样式** | Tailwind CSS | 高效实现现代化高颜值界面、暗黑模式等 |
| **后端框架** | Go 1.21+ (Echo) | 标准 Go Layout，当前版本负责启动 Web 静态服务 |
| **脚本** | Python 3 | 用于数据清洗和生成 `mapping.json` |

## 4. 核心功能与翻译流

### 4.1 翻译引擎 (Translator Engine)
提供完全纯函数的前端翻译模块：
- `chineseToCodes(text)`: 将中文字符串转为空格分隔的数字电码。
- `codesToMorse(codes)`: 将数字电码转为摩尔斯码（空格或 `/` 分隔）。
- `morseToCodes(morse)`: 将摩尔斯信号解析为数字串。
- `codesToChinese(codes)`: 将数字电码映射回中文字符。

### 4.2 实时三态联动
用户界面包含三个主要文本框（或支持智能探测的单一/双文本框）。当用户在任意文本框输入时：
1. 触发 `onChange` 事件。
2. 调用翻译引擎计算另外两种形态。
3. 更新 React State 以触发重绘。

## 5. 项目目录结构

遵循 Standard Go Layout 及前端分离规范：

```text
MoYu/
├── docs/                   # 设计文档
│   └── design.md
├── data/
│   └── 1983.sql            # 原始参考数据
├── scripts/
│   └── generate_dict.py    # 数据清洗脚本
├── cmd/
│   └── serve.go            # Go 启动服务入口
├── internal/
│   └── server/             # Echo 服务与路由配置
├── web/                    # React 工程
│   ├── public/
│   │   └── dict/           # 存放 JSON 映射表
│   ├── src/
│   │   ├── utils/
│   │   │   └── translator.js
│   │   ├── components/
│   │   └── App.jsx
│   └── package.json
└── Makefile                # 统一构建脚本
```
