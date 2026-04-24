# Multi-Flow

[English](README.md) | [简体中文](README.zh-CN.md)

A desktop multi-profile browser manager built with Tauri, React, and a custom Chromium engine for isolated environments, proxy binding, fingerprint controls, plugin management, and automation workflows.

## Overview

`multi-flow` is a local-first desktop application designed to provide a browser profile management experience comparable to the core capability set of tools like AdsPower. It uses a custom Chromium 144 build as the browser engine and Tauri to separate the management UI from system-level capabilities. The current focus is on profiles, proxies, resource management, window synchronization, and plugin management.

## Core Capabilities

- Profile isolation. Each profile uses an independent user-data-dir to isolate cookies, cache, extensions, and runtime state.
- Proxy pool and bindings. Manage proxy assets, bind them to profiles, and connect health-check and GEO metadata to runtime configuration.
- Fingerprint and launch settings. Configure platform, device presets, browser version, language, timezone, WebRTC, geolocation, resolution, and more.
- Plugin management. Includes a plugin library, per-profile extension state, and plugin download, update, and uninstall workflows.
- Window synchronization. Supports runtime window management, sync sessions, and sidecar-based coordination.
- Resource management. Manages host resources such as Chromium and GeoIP through a unified manifest model with built-in entries and optional remote manifests.

## Tech Stack

- Desktop: `Tauri v2 + Rust`
- Frontend: `React + TypeScript + Vite + Tailwind CSS + shadcn/ui`
- State and data layer: `TanStack Query + Zustand`
- Forms: `react-hook-form + zod + @hookform/resolvers`
- Browser engine: `custom Chromium 144`
- Persistence: `SQLite + SeaORM + SeaORM Migration`

## Architecture Snapshot

The backend is currently organized around `commands -> services -> engine_manager -> db`, while the frontend follows an FSD-style structure with `app / pages / widgets / features / entities / shared`. At runtime, profiles manage environment configuration and data isolation, engine sessions map Chromium processes and ports, and the resource layer resolves and installs host resources such as Chromium and GeoIP.

## Current Status

- The project is under active development and currently focuses on local desktop workflows first.
- Browser resources are currently centered on macOS builds, and the installation flow primarily targets macOS.
- Automation capabilities are evolving around window synchronization, local APIs, and future MCP-facing integrations.

## Quick Start

### Prerequisites

- Node.js and `pnpm`
- Rust toolchain
- System dependencies required by Tauri v2
- macOS is recommended for the full browser resource workflow

### Install Dependencies

```bash
pnpm install
```

### Run In Development

```bash
pnpm tauri dev
```

### Build Frontend

```bash
pnpm -s build
```

### Check Tauri Backend

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## Resources And Environment Variables

- Built-in resources include Chromium packages and the GeoLite2 City database.
- The resource catalog can be extended through an optional remote manifest.
- If you need to force a specific Chromium executable, you can override the default resolution logic with an environment variable.

### Common Environment Variables

- `MULTI_FLOW_RESOURCE_MANIFEST_URL`: Optional remote resource manifest URL.
- `MULTI_FLOW_CHROMIUM_EXECUTABLE`: Explicit path to the Chromium executable with the highest priority.

## Project Structure

```text
multi-flow/
├─ src/                 # React frontend
├─ src-tauri/           # Tauri backend and Rust services
├─ docs/ai/             # AI-facing architecture and project docs
├─ public/              # Static frontend assets
└─ package.json         # Frontend scripts and dependencies
```

Frontend entry points and routes mainly live in `src/app` and `src/pages`, with business logic split across `src/features`, `src/entities`, and `src/widgets`. Tauri commands are under `src-tauri/src/commands`, services under `src-tauri/src/services`, and engine session management under `src-tauri/src/engine_manager`.

## Related Docs

- [docs/release.md](docs/release.md)
- [docs/ai/architecture.md](docs/ai/architecture.md)
- [docs/ai/chromium.md](docs/ai/chromium.md)
- [docs/ai/current-task.md](docs/ai/current-task.md)
- [docs/ai/project-context.md](docs/ai/project-context.md)
- [docs/ai/session-summary.md](docs/ai/session-summary.md)
- [docs/ai/proxy-daemon.md](docs/ai/proxy-daemon.md)
- [docs/ai/multi-flow-sync-manager.md](docs/ai/multi-flow-sync-manager.md)

## Notes

This repository is licensed under the MIT License. Confirm signing and notarization credentials before publishing release artifacts.
