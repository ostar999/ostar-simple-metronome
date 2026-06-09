# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

单文件节拍器 Web 应用（`metronome.html`），纯静态 HTML/CSS/JS，无需构建工具，浏览器直接打开。

## 使用方法

```bash
open metronome.html
```

## 文件结构

`metronome.html` 约 1500 行，三段式结构：

- **CSS（~1–570 行）**：CSS 变量定义颜色体系（`--accent: #d4453b` 红色主调），组件样式按 `/* ── 组件名 ── */` 注释分隔
- **HTML（~577–710 行）**：节拍器 UI 布局，所有 id 引用被 JS 使用
- **JS（~729–1470 行）**：IIFE 包裹，按 `// ═══ 功能模块 ═══` 注释分隔

## JS 架构

### 状态变量
所有可变状态集中在全局闭包顶部（~755 行）：`bpm`, `beatsPerMeasure`, `beatStates[]`, `soundType`, `volume`, `emphasizeSecondary`, `gainStrong/Secondary/Weak`, `isPlaying`, `currentBeat`

### 核心模块
| 模块 | 行号 | 职责 |
|------|------|------|
| DOM refs | ~786 | `$xxx` 命名获取所有 id 元素 |
| Beat dots UI | ~822 | `renderBeatDots()` 渲染节拍圆点，`cycleBeatState(idx)` 切换强/次强/弱/休止 |
| Sound synthesis | ~882 | `createClickBuffer(gain, sound)` 四种音色的 AudioBuffer 合成（经典/木鱼/电子/响棒） |
| Scheduler | ~958 | Web Audio API look-ahead 调度器，`SCHEDULE_AHEAD=0.1s`，每 20ms 检查一次，确保精确节拍 |
| Pendulum animation | ~1004 | `requestAnimationFrame` 驱动余弦插值摆锤动画 |
| Persistence | ~1144 | `saveSettings()` / `loadSettings()` 通过 localStorage 持久化，key=`metronome_settings_v2` |
| Start/Stop | ~1036 | `start()` / `stop()` 管理 AudioContext 和调度器生命周期 |

### 关键设计
- **音频时序**：不依赖 `setInterval` 打节拍，而是用 AudioContext 时间线提前调度（look-ahead），视觉更新通过 `setTimeout` 对齐音频时间
- **摆锤动画**：播放时根据距上次节拍的时间计算余弦插值角度，停止时指数衰减归零
- **强弱增益**：`getBeatGain()` 根据 `emphasizeSecondary` 开关和三个自定义增益值（`gainStrong/Secondary/Weak`）计算每拍振幅

## 注意事项

- 所有修改在单一 HTML 文件中完成，CSS/HTML/JS 在同一文件
- 新增功能需要同步更新 `saveSettings` / `loadSettings` / `resetToDefaults` 三个函数
- localStorage key 为 `metronome_settings_v2`，修改数据结构时考虑兼容性
- 音色合成纯 Web Audio API，不依赖外部音频文件
