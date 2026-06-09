# ostar-simple-metronome

一个功能丰富的网页节拍器，纯 HTML/CSS/JS 实现，浏览器直接打开即可使用。

## 功能

- 🎯 **精确节拍**：基于 Web Audio API 的 look-ahead 调度器，确保时序精准
- 🎵 **自定义强弱拍**：每拍可独立设为 强 / 次强 / 弱 / 休止，点击节拍圆点即可切换
- 🎛️ **可调响度**：强、次强、弱三种拍位各自独立设置响度
- 🔊 **四种音色**：经典 / 木鱼 / 电子 / 响棒
- 🕰️ **多种拍号**：快速切换 2/4、3/4、4/4、3/8、6/8、12/8
- 👆 **打点测速**：Tap Tempo 功能
- 💾 **自动记忆**：所有设置自动保存，重新打开恢复上次配置
- ⌨️ **键盘快捷键**：Space 启停、方向键调 BPM、T 键打点

## 使用方法

用浏览器打开 `metronome.html` 即可。

```
open metronome.html
```

## 键盘快捷键

| 按键 | 功能 |
|------|------|
| Space | 播放 / 暂停 |
| ↑↓ | BPM ±1 |
| ←→ | BPM ±1（Shift + ←→ = ±10） |
| T | Tap Tempo |

## 项目结构

```
.
├── metronome.html   # 单文件应用（CSS + HTML + JS 内联）
├── README.md
└── .gitignore
```

## 技术栈

- 纯静态 HTML/CSS/JS，无框架，无构建工具
- Web Audio API 音频合成与调度
- localStorage 持久化
