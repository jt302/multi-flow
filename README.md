# Multi-Flow

中文：基于 Tauri + React + 自研 Chromium 的桌面多环境浏览器管理器，面向环境隔离、代理绑定、指纹配置、插件治理与自动化能力扩展。
English: A desktop multi-profile browser manager built with Tauri, React, and a custom Chromium engine for isolated environments, proxy binding, fingerprint controls, plugin management, and automation workflows.

## 项目简介 | Overview

中文：`multi-flow` 是一个本地优先的桌面应用，目标是提供类似 AdsPower 核心能力面的多环境浏览器管理体验。项目以自研/魔改 Chromium 144 为浏览器引擎，通过 Tauri 将前端管理台与系统级能力解耦，当前重点覆盖环境管理、代理池、资源管理、窗口同步和插件管理等基础能力。
English: `multi-flow` is a local-first desktop application designed to provide a browser profile management experience comparable to the core capability set of tools like AdsPower. It uses a custom Chromium 144 build as the browser engine and Tauri to separate the management UI from system-level capabilities. The current focus is on profiles, proxies, resource management, window synchronization, and plugin management.

## 核心能力 | Core Capabilities

- 中文：环境隔离。每个 Profile 使用独立的 user-data-dir，隔离 cookie、缓存、扩展与运行时状态。
  English: Profile isolation. Each profile uses an independent user-data-dir to isolate cookies, cache, extensions, and runtime state.
- 中文：代理池与绑定。支持代理资产管理、环境绑定、检测结果与 GEO 相关配置联动。
  English: Proxy pool and bindings. Manage proxy assets, bind them to profiles, and connect health-check and GEO metadata to runtime configuration.
- 中文：指纹与启动配置。支持平台、设备预设、浏览器版本、语言、时区、WebRTC、地理位置、分辨率等配置。
  English: Fingerprint and launch settings. Configure platform, device presets, browser version, language, timezone, WebRTC, geolocation, resolution, and more.
- 中文：插件管理。支持插件库、环境级插件状态，以及插件下载、更新与卸载。
  English: Plugin management. Includes a plugin library, per-profile extension state, and plugin download, update, and uninstall workflows.
- 中文：窗口同步。支持运行中环境的窗口管理、同步会话与 sidecar 协同。
  English: Window synchronization. Supports runtime window management, sync sessions, and sidecar-based coordination.
- 中文：资源管理。统一管理 Chromium 与 GeoIP 等宿主资源，支持内置清单和可选远端 manifest。
  English: Resource management. Manages host resources such as Chromium and GeoIP through a unified manifest model with built-in entries and optional remote manifests.

## 技术栈 | Tech Stack

- 中文：桌面端 `Tauri v2 + Rust`
  English: Desktop `Tauri v2 + Rust`
- 中文：前端 `React + TypeScript + Vite + Tailwind CSS + shadcn/ui`
  English: Frontend `React + TypeScript + Vite + Tailwind CSS + shadcn/ui`
- 中文：状态与数据层 `TanStack Query + Zustand`
  English: State and data layer `TanStack Query + Zustand`
- 中文：表单 `react-hook-form + zod + @hookform/resolvers`
  English: Forms `react-hook-form + zod + @hookform/resolvers`
- 中文：浏览器引擎 `自研/魔改 Chromium 144`
  English: Browser engine `custom Chromium 144`
- 中文：数据存储 `SQLite + SeaORM + SeaORM Migration`
  English: Persistence `SQLite + SeaORM + SeaORM Migration`

## 架构概览 | Architecture Snapshot

中文：当前后端按 `commands -> services -> engine_manager -> db` 分层，前端按 `app / pages / widgets / features / entities / shared` 的 FSD 风格组织。运行态上，Profile 负责环境配置与数据隔离，Engine Session 负责 Chromium 进程与端口映射，资源层负责 Chromium/GeoIP 等宿主资源解析与安装。
English: The backend is currently organized around `commands -> services -> engine_manager -> db`, while the frontend follows an FSD-style structure with `app / pages / widgets / features / entities / shared`. At runtime, profiles manage environment configuration and data isolation, engine sessions map Chromium processes and ports, and the resource layer resolves and installs host resources such as Chromium and GeoIP.

## 当前状态 | Current Status

中文：

- 项目仍在积极开发中，当前以本地桌面能力闭环为主。
- 浏览器资源目前以 macOS 构建为主，相关安装链路也优先覆盖 macOS。
- 自动化能力正在逐步收口到窗口同步、Local API 与后续 MCP 方向。

English:

- The project is under active development and currently focuses on local desktop workflows first.
- Browser resources are currently centered on macOS builds, and the installation flow primarily targets macOS.
- Automation capabilities are evolving around window synchronization, local APIs, and future MCP-facing integrations.

## 快速开始 | Quick Start

### 依赖要求 | Prerequisites

中文：

- Node.js 与 `pnpm`
- Rust toolchain
- Tauri v2 所需系统依赖
- 建议在 macOS 环境下运行完整浏览器资源链路

English:

- Node.js and `pnpm`
- Rust toolchain
- System dependencies required by Tauri v2
- macOS is recommended for the full browser resource workflow

### 安装依赖 | Install Dependencies

```bash
pnpm install
```

### 启动开发环境 | Run In Development

```bash
pnpm tauri dev
```

### 构建前端 | Build Frontend

```bash
pnpm -s build
```

### 检查 Tauri 后端 | Check Tauri Backend

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## 资源与环境变量 | Resources And Environment Variables

中文：

- 内置资源包括 Chromium 与 GeoLite2 City 数据库。
- 可通过远端 manifest 扩展资源清单。
- 如需强制指定 Chromium 可执行文件，可使用环境变量覆盖默认解析逻辑。

English:

- Built-in resources include Chromium packages and the GeoLite2 City database.
- The resource catalog can be extended through an optional remote manifest.
- If you need to force a specific Chromium executable, you can override the default resolution logic with an environment variable.

### 常用环境变量 | Common Environment Variables

- `MULTI_FLOW_RESOURCE_MANIFEST_URL`
  中文：可选远端资源清单地址。
  English: Optional remote resource manifest URL.
- `MULTI_FLOW_CHROMIUM_EXECUTABLE`
  中文：显式指定 Chromium 可执行文件路径，优先级最高。
  English: Explicit path to the Chromium executable with the highest priority.

## 项目结构 | Project Structure

```text
multi-flow/
├─ src/                 # React frontend
├─ src-tauri/           # Tauri backend and Rust services
├─ docs/ai/             # AI-facing architecture and project docs
├─ public/              # Static frontend assets
└─ package.json         # Frontend scripts and dependencies
```

中文：前端入口和路由主要位于 `src/app`、`src/pages`，业务逻辑分布在 `src/features`、`src/entities`、`src/widgets`。后端 Tauri 命令位于 `src-tauri/src/commands`，服务层位于 `src-tauri/src/services`，引擎会话管理位于 `src-tauri/src/engine_manager`。
English: Frontend entry points and routes mainly live in `src/app` and `src/pages`, with business logic split across `src/features`, `src/entities`, and `src/widgets`. Tauri commands are under `src-tauri/src/commands`, services under `src-tauri/src/services`, and engine session management under `src-tauri/src/engine_manager`.

## 相关文档 | Related Docs

- [docs/ai/architecture.md](docs/ai/architecture.md)
- [docs/ai/chromium.md](docs/ai/chromium.md)
- [docs/ai/current-task.md](docs/ai/current-task.md)
- [docs/ai/project-context.md](docs/ai/project-context.md)
- [docs/ai/session-summary.md](docs/ai/session-summary.md)
- [docs/ai/proxy-daemon.md](docs/ai/proxy-daemon.md)
- [docs/ai/multi-flow-sync-manager.md](docs/ai/multi-flow-sync-manager.md)

## 说明 | Notes

中文：本项目当前没有在仓库中声明正式开源许可证，使用、分发或商用前请先确认仓库所有者意图。
English: This repository does not currently declare a formal open-source license. Confirm the repository owner's intent before redistribution or commercial use.
