# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-04-13

### Fixed

- Main content area could not scroll on long pages (profile create/edit, settings, etc.)

## [0.1.2] - 2026-04-13

### Changed

- Migrated Chromium and resource download URLs from Supabase storage to Cloudflare R2
- Added MIT license
- Sanitized all personal paths and identifiers for open-source publication
- Reorganized `.gitignore` with section headers; added missing Rust/Tauri patterns

## [0.1.1] - 2026-04-06

### Added

- **AI Chat**: full chat interface with session management, Markdown rendering, tool-calling display, and copy-to-clipboard
- **AI Chat backend**: chat service, database schema (`chat_sessions`, `chat_messages`), Tauri commands, and real-time streaming events
- **Splash screen**: startup splash with bilingual progress tracking and glassmorphism UI
- **CAPTCHA solver**: pluggable CAPTCHA service with multi-provider support and configuration UI
- **Browser Control page**: standalone navigation entry for window, tab, and text control
- **Automation — AI steps**: `AiAgent` and `AiJudge` step types with agentic tool-calling loop
- **Automation — Dialog steps**: 5 new dialog step types integrated into the canvas
- **Automation — 19 `auto_*` tools**: automation script management tools callable from AI agents
- **Automation — canvas**: save button (Cmd+S), window-close auto-save, collapsible step groups with pinned favorites
- AI tool `submit_result` for clean structured output; `cdp_query_all` and `cdp_get_response_body`
- Profile duplication with auto-naming collision avoidance
- Device preset platform icon in preset list
- OpenRouter free-input model field in AI settings
- Persist resizable panel layouts across sessions
- Retain last 3 tool screenshots for before/after comparison in AI sessions
- i18n: sidebar footer status dashboard and all remaining UI components translated

### Fixed

- Startup deadlock when reloading the native window
- Tooltip overflow on proxy error messages in health column
- Automation badge stuck on "pending" due to stale `activeRunId`
- Back navigation from profile detail returned to wrong page
- `usePersistentLayout` infinite loop in React Strict Mode
- Missing `common:profile` i18n translation key
- AI screenshot payload size causing excessive context bloat
- AI returning raw text instead of calling `submit_result`

## [0.1.0] - 2026-04-06

### Added

- **Multi-profile browser manager**: create, edit, and launch isolated browser profiles backed by custom Chromium
- **Proxy management**: proxy pool with health checks, geo-lookup, reachability tests, import/export, and recycle bin
- **Profile–proxy binding**: per-profile proxy assignment with locale and timezone auto-suggestion
- **Fingerprint isolation**: custom device identity, WebRTC mode, Do Not Track, geolocation, custom resolution, and font list
- **Plugin system**: plugin package management with download proxy preference and store integration
- **Cookie management**: persist and export cookies per profile
- **Window sync**: start/stop sync manager sidecar for synchronized multi-window control
- **Automation engine**: multi-phase RPA canvas editor with Magic Controller and CDP named steps, control flow (Condition/Loop/Break/Continue), variables, human intervention, and AI Agent steps
- **Automation canvas**: `@xyflow/react`-based visual flow editor with step palette, properties panel, and debug mode
- **Settings**: AI provider configuration (multi-provider), device preset management, theme customization, and persistent tab state
- **Dashboard**: metrics grid and automation progress listener
- **Groups**: profile group management and bulk assignment
- **Recycle bin**: soft-delete and restore for profiles and groups
- **Local API server**: Axum-based HTTP/WebSocket API for external tool integration
- **CI/CD**: GitHub Actions workflows for macOS arm64 and x86_64 builds and releases
- Frontend built with React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, and Zustand
- Backend built with Tauri v2, Rust, SQLite, and SeaORM

[0.1.3]: https://github.com/jt302/multi-flow/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/jt302/multi-flow/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/jt302/multi-flow/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jt302/multi-flow/releases/tag/v0.1.0
