# 息间 (XiJian) · 居家呼吸声学监测与 RK3576 边缘端平台

![React](https://img.shields.io/badge/App-React%20%2B%20TypeScript%20PWA-61DAFB?logo=react&logoColor=black)
![Web Audio](https://img.shields.io/badge/Audio-Web%20Audio%20API%20Capture-FF5722)
![Edge](https://img.shields.io/badge/Edge-RK3576%20Acoustic%20Pipeline-008080)
![Privacy](https://img.shields.io/badge/Storage-Local%20Encrypted%20Storage-2E7D32)

面向居家夜间呼吸健康管理的**无接触声学事件记录与边缘分析协同平台**。系统通过移动端采集音频、RK3576 边缘节点本地声学分析，辅助用户追踪夜间咳嗽与疑似喘息事件并生成结构化复诊档案。

---

## 核心特性 (`app/`)

- **移动端 Web/PWA 交互体验**
  - 采用克制的黑白灰视觉层级与毛玻璃质感交互，提供**晨间睡眠呼吸概览、夜间声学事件时间轴、7/14/30 天多周期趋势追踪**。
- **真实麦克风采集与声学回放**
  - 集成浏览器 `Web Audio API` 实时麦克风采样与局域网边缘设备健康检查；支持事件音频片段回放、重点标记收藏、误识别纠错反馈与离线归档。
- **复诊资料整理与中文 PDF 报告导出**
  - 支持关联每日用药与主观症状记录，一键生成排版规范的中文复诊汇总 PDF 报告。
- **本地加密与生命周期控制**
  - 音频与健康日志采用本地加密存储，支持自定义数据保留期限与一键彻底清除，保障居家音频隐私安全。

---

## 快速启动

环境要求：Node.js 22.12+。

```bash
cd app
npm ci
npm run dev
```

打开终端输出的地址（默认 `http://127.0.0.1:5188`）。

### 测试与构建

```bash
cd app
npm test               # 运行核心业务逻辑单元测试
npm run test:coverage  # 生成测试覆盖率报告
npm run build          # TypeScript 类型检查与生产环境构建
```

---

## 目录结构

```text
xijian-rk3576/
├── app/                # React + TypeScript + Vite 患者端 Web/PWA 应用源码与测试
├── 设计方案/            # 产品交互规范与 UI 视觉设计稿
├── architecture.png    # 端云/边缘协同系统架构图
└── 构建说明.md          # 本地开发环境与构建说明
```
