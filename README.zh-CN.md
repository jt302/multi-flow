# Multi-Flow

[English](README.md) | [简体中文](README.zh-CN.md)

基于 Tauri、React 和自研 Chromium 的桌面多环境浏览器管理器，面向环境隔离、代理绑定、指纹配置、插件治理与自动化工作流。

## 项目简介

`multi-flow` 是一个本地优先的桌面应用，目标是提供类似 AdsPower 核心能力面的多环境浏览器管理体验。项目以自研/魔改 Chromium 144 为浏览器引擎，通过 Tauri 将前端管理台与系统级能力解耦，当前重点覆盖环境管理、代理池、资源管理、窗口同步和插件管理。

## 核心能力

- 环境隔离。每个 Profile 使用独立的 user-data-dir，隔离 cookie、缓存、扩展与运行时状态。
- 代理池与绑定。支持代理资产管理、环境绑定，并将健康检查与 GEO 信息联动到运行配置。
- 指纹与启动配置。支持平台、设备预设、浏览器版本、语言、时区、WebRTC、地理位置、分辨率等配置。
- 插件管理。支持插件库、环境级插件状态，以及插件下载、更新与卸载。
- 窗口同步。支持运行中环境的窗口管理、同步会话与 sidecar 协同。
- 资源管理。统一管理 Chromium 和 GeoIP 等宿主资源，支持内置清单与可选远端 manifest。

## 技术栈

- 桌面端：`Tauri v2 + Rust`
- 前端：`React + TypeScript + Vite + Tailwind CSS + shadcn/ui`
- 状态与数据层：`TanStack Query + Zustand`
- 表单：`react-hook-form + zod + @hookform/resolvers`
- 浏览器引擎：`自研/魔改 Chromium 144`
- 数据存储：`SQLite + SeaORM + SeaORM Migration`

## 架构概览

当前后端按 `commands -> services -> engine_manager -> db` 分层，前端按 `app / pages / widgets / features / entities / shared` 的 FSD 风格组织。运行态上，Profile 负责环境配置与数据隔离，Engine Session 负责 Chromium 进程与端口映射，资源层负责 Chromium、GeoIP 等宿主资源的解析与安装。

## 当前状态

- 项目仍在积极开发中，当前以本地桌面能力闭环为主。
- 浏览器资源目前以 macOS 构建为主，相关安装链路也优先覆盖 macOS。
- 自动化能力正在逐步收口到窗口同步、Local API 与后续 MCP 方向。

## 快速开始

### 依赖要求

- Node.js 与 `pnpm`
- Rust toolchain
- Tauri v2 所需系统依赖
- 建议在 macOS 环境下运行完整浏览器资源链路

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
pnpm tauri dev
```

### 构建前端

```bash
pnpm -s build
```

### 检查 Tauri 后端

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## 资源与环境变量

- 内置资源包括 Chromium 安装包与 GeoLite2 City 数据库。
- 可通过远端 manifest 扩展资源清单。
- 如需强制指定 Chromium 可执行文件，可使用环境变量覆盖默认解析逻辑。

### 常用环境变量

- `MULTI_FLOW_RESOURCE_MANIFEST_URL`：可选远端资源清单地址。
- `MULTI_FLOW_CHROMIUM_EXECUTABLE`：显式指定 Chromium 可执行文件路径，优先级最高。

## 项目结构

```text
multi-flow/
├─ src/                 # React frontend
├─ src-tauri/           # Tauri backend and Rust services
├─ docs/ai/             # AI-facing architecture and project docs
├─ public/              # Static frontend assets
└─ package.json         # Frontend scripts and dependencies
```

前端入口和路由主要位于 `src/app` 与 `src/pages`，业务逻辑分布在 `src/features`、`src/entities` 与 `src/widgets`。后端 Tauri 命令位于 `src-tauri/src/commands`，服务层位于 `src-tauri/src/services`，引擎会话管理位于 `src-tauri/src/engine_manager`。

## 相关文档

- [docs/release.md](docs/release.md)
- [docs/ai/architecture.md](docs/ai/architecture.md)
- [docs/ai/chromium.md](docs/ai/chromium.md)
- [docs/ai/current-task.md](docs/ai/current-task.md)
- [docs/ai/project-context.md](docs/ai/project-context.md)
- [docs/ai/session-summary.md](docs/ai/session-summary.md)
- [docs/ai/multi-flow-sync-manager.md](docs/ai/multi-flow-sync-manager.md)

## 说明

本项目使用 MIT License。发布产物前需确认签名与公证凭据已经配置完成。
