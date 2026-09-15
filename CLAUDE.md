# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 首要原则

`index.html`、`assets/metronome.css`、`assets/metronome.js` 和 `metronome_整合版-combined.html` 编辑时，需要同步更新：改动其中任何一个文件，必须把等价改动同步到其余文件，保持拆分版与整合版功能一致。

## 项目概述

节拍器 Web 应用，纯静态 HTML/CSS/JS，浏览器直接打开。两种形态并存，内容等价：

- 整合版（普通用户推荐）：`metronome_整合版-combined.html`（~2000 行，CSS/JS 内联单文件）
- 拆分版（开发者推荐）：`index.html`（页面结构）+ `assets/metronome.css` + `assets/metronome.js`

```bash
# 普通用户推荐：直接打开整合版单文件
open metronome_整合版-combined.html

# 开发者推荐：拆分版
open index.html
```

## 文件结构

三段式：CSS 变量 + 组件样式 → HTML UI → JS IIFE，均按 `/* ── 组件 ── */` / `// ═══ 模块 ═══` 分隔。

- 整合版：三部分内联在 `metronome_整合版-combined.html` 一个文件里（head 内 `<style>` → body UI → body 末尾 `<script>`）
- 拆分版：三部分分别对应 `assets/metronome.css` → `index.html` → `assets/metronome.js`

## JS 架构

### 状态变量（~1171 行）
集中在闭包顶部：`bpm`, `beatsPerMeasure`, `timeSigDenom`, `noteValue`, `beatStates[]`, `soundType`, `volume`, `emphasizeSecondary`, `gainStrong/Secondary/Weak`, `isPlaying`, `currentBeat`

### 核心模块

| 模块 | 关键函数 | 职责 |
|------|---------|------|
| Scheduler (~1385) | `nextStep()`, `scheduler()`, `scheduleBeat()` | AudioContext look-ahead，`SCHEDULE_AHEAD=0.1s`，每 20ms 轮询 |
| 音符时值 (~1246) | `getStepsPerBeat()` = `max(1, round(noteValue/timeSigDenom))` | 按乐理计算每拍步数，4/4+8分→8声，3/8+8分→3声 |
| Beat dots (~1249) | `renderBeatDots()`, `cycleBeatState(idx)` | 渲染并切换强/次强/弱/休止 |
| Sound (~1309) | `createClickBuffer(gain, sound)` | 四种音色 AudioBuffer 合成，gain 参数直传振幅 |
| Gain (~1373) | `getBeatGain(state)` | 根据 `emphasizeSecondary` 和自定义 `gainStrong/Secondary/Weak` 计算振幅 |
| Persistence (~1661) | `saveSettings()`, `loadSettings()`, `resetToDefaults()` | localStorage key=`metronome_settings_v2` |
| Pendulum (~1446) | `animatePendulum()` | rAF 余弦插值，仅主拍时摆动，默认隐藏 |
| Theme (~1961) | `applyTheme()` | `data-theme` 属性切换，localStorage 记忆 |
| Tempo presets (~1937) | `collapsePresets()`, `expandPresets()` | 移动端二级折叠菜单 |

### 关键设计

- **音频时序**：AudioContext 提前调度，`setTimeout` 对齐视觉
- **音符时值公式**：`stepsPerBeat = max(1, round(noteValue / timeSigDenom))`，拍号切换时自动更新分母
- **/8 拍号自动行为**：选 3/8,6/8,12/8 时 `noteValue` 自动切 8，4分按钮禁用
- **次强开关**：关闭时 `gainSecondary` 保存到 `savedSecondaryGain`，显示同步为 `gainWeak` 并禁用输入

## 响应式

- 移动端 460px/380px 断点，摆锤隐藏，速度预设折叠
- 桌面 700px+800px/900px+900px 渐进增强
- body `overflow:hidden`，无滚动条

## 注意事项

- 新增功能必须同步 `saveSettings` / `loadSettings` / `resetToDefaults`
- localStorage key `metronome_settings_v2`，另 `metronome_theme` 存主题
- 音色纯 Web Audio API 合成，无外部文件
