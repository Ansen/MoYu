# CH552G 摩尔斯电键 USB-HID 免驱转接器制作与固件指南

本文档为 MoYu 跟发模式/电码游戏的配套硬件指南。使用价格低廉（约 5~7 元）的 **沁恒 CH552G 迷你双头开发板**，制作一个支持手键（Straight Key）与自动键（Paddle）的 **免驱 USB-HID 转接器**。

---

## 1. 硬件准备与接线图

### 1.1 准备物料
1. **CH552G 双头开发板**（带 USB-A 公头 + Type-C 口，自带按键）。
2. **3.5mm TRS 耳机母座**（3 脚立体声母座）。
3. 电烙铁、焊锡、3 根细导线。

### 1.2 3.5mm TRS 母座引脚定义
标准电键插头（3.5mm）定义如下：
- **Sleeve（套管/最外圈金属）**：公共地线（GND）。
- **Tip（尖端）**：手键开关（Straight Key） / 自动键“点”（Dit）。
- **Ring（中环）**：自动键“划”（Dah）。如果是两芯手键（TS），Ring 自动接地或悬空。

### 1.3 焊接引脚映射表

| 3.5mm 母座引脚 | CH552G 开发板引脚 | 功能说明 | 内部状态 |
| :--- | :--- | :--- | :--- |
| **Sleeve (地线)** | **GND** | 电气参考地 | 0V |
| **Tip (点/手键)** | **P1.4** (P14) | 点信号输入 | 开启内部弱上拉，按键闭合时拉低为 0 |
| **Ring (划)** | **P1.5** (P15) | 划信号输入 | 开启内部弱上拉，按键闭合时拉低为 0 |

> 💡 **提示**：CH552G 所有 P1 口均支持软件内置上拉电阻，无需在外部焊接任何电阻或电容，引脚直连即可！

---

## 2. 软件输入映射标准

转接器在插入电脑后，枚举为标准 **USB HID 键盘**（或游戏手柄），映射为标准按键：

| 输入动作 | 模拟的按键 | 适用模式 | 键盘对应键码 |
| :--- | :--- | :--- | :--- |
| **手键按下** | **`Space`** 或 **`J`** | 单键手键模式 | Keydown / Keyup |
| **自动键点 (Dit)** | **`J`** | 自动双桨模式 | Keydown / Keyup |
| **自动键划 (Dah)** | **`K`** | 自动双桨模式 | Keydown / Keyup |

> 这样设计的好处是：**即使没有硬件转接器，用户直接用电脑键盘的 `J` / `K` 或 `Space` 键，代码逻辑 100% 完全通用！**

---

## 3. 固件完整源码 (Arduino IDE / ch55xduino)

本固件基于开源的 [ch55xduino](https://github.com/DeqingSun/ch55xduino) 核心库编写。

### 3.1 固件代码 (`ch552_cw_keyer.ino`)

```cpp
/**
 * MoYu CH552G USB-HID CW Keyer Adapter
 * 摩尔斯电键免驱转接器固件
 * 
 * 硬件: CH552G 开发板
 * 接线: 
 *   - 3.5mm Sleeve -> GND
 *   - 3.5mm Tip    -> P1.4 (点 Dit / 手键 Straight Key)
 *   - 3.5mm Ring   -> P1.5 (划 Dah)
 */

#ifndef USER_USB_RAM
#error "请在 Arduino IDE 的 Tools 菜单中确认已选择 CH552 芯片并启用 USB 支持"
#endif

// 引脚定义
#define PIN_DIT   14  // P1.4 对应点/手键
#define PIN_DAH   15  // P1.5 对应划

// 映射键码 (使用 J / K 键，避免与系统输入法冲突)
#define KEY_DIT   'j'
#define KEY_DAH   'k'

// 软件消抖阈值 (毫秒) - 机械电键触点会有微小抖动
#define DEBOUNCE_MS 2

void setup() {
  // 配置 P1.4 和 P1.5 为带上拉输入
  pinMode(PIN_DIT, INPUT_PULLUP);
  pinMode(PIN_DAH, INPUT_PULLUP);

  // 初始化 USB 键盘
  Keyboard_begin();
}

// 记录按键状态
bool lastDitState = HIGH;
bool lastDahState = HIGH;
unsigned long lastDitDebounceTime = 0;
unsigned long lastDahDebounceTime = 0;

void loop() {
  unsigned long now = millis();

  // 1. 读取点/手键信号
  int ditReading = digitalRead(PIN_DIT);
  if (ditReading != lastDitState) {
    if ((now - lastDitDebounceTime) > DEBOUNCE_MS) {
      lastDitDebounceTime = now;
      lastDitState = ditReading;
      if (ditReading == LOW) {
        // 电键闭合
        Keyboard_press(KEY_DIT);
      } else {
        // 电键断开
        Keyboard_release(KEY_DIT);
      }
    }
  }

  // 2. 读取划信号
  int dahReading = digitalRead(PIN_DAH);
  if (dahReading != lastDahState) {
    if ((now - lastDahDebounceTime) > DEBOUNCE_MS) {
      lastDahDebounceTime = now;
      lastDahState = dahReading;
      if (dahReading == LOW) {
        Keyboard_press(KEY_DAH);
      } else {
        Keyboard_release(KEY_DAH);
      }
    }
  }
}
```

---

## 4. 固件烧录步骤（3分钟搞定）

1. **安装 Arduino IDE**（若未安装，从官网下载）。
2. **添加 CH55x 支持**：
   - 打开 Arduino IDE 的 `首选项` (Preferences)。
   - 在“其他开发板管理器地址”填入：  
     `https://raw.githubusercontent.com/DeqingSun/ch55xduino/ch55xduino/package_ch55xduino_index.json`
   - 打开 `开发板管理器`，搜索 `ch55xduino` 并点击安装。
3. **选择板卡配置**：
   - `工具` -> `开发板` -> `CH55x Boards` -> 选择 **CH552**。
   - `USB Settings` -> 选择 **Default CDC / HID** 或 **Keyboard**。
4. **一键烧录**：
   - **按住 CH552G 开发板上的微动按键不放**，将其插入电脑 USB 接口。
   - 插入后听到提示音，松开按键（此时芯片进入 Bootloader 下载模式）。
   - 在 Arduino IDE 中点击 **“上传”** 按钮。
   - 编译完成后即可自动烧录成功！

烧录完毕后重新插拔，板子便成为了永久免驱的专业 CW 电键适配器！插上手键，按下时电脑就会接收到瞬间响应的按键事件。
