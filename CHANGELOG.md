# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2026-04-25

### Added

- Direct Chromium proxy authentication support.
- Default full tool access for automation AI steps.
- Engineering and release governance documentation.

### Changed

- Restructured the macOS menu bar and focused-window shortcuts.
- Separated spoofed browser version from the installed Chromium resource version.
- Improved Chromium locale launch flow and refreshed profile locale after proxy changes.
- Moved blocking profile, file, and invoke-path work off the UI thread.
- Improved frontend performance with lazy settings panels, vendor chunk splitting, and reduced workspace/profile/proxy rerenders.
- Hardened Tauri runtime and release configuration.

### Fixed

- Device preset updates now sync browser version fields to linked profiles.
- Profile deletion and profile batch pending states are more reliable.
- Window arrangement validation, main/sidebar application, and grid spacing compensation now behave correctly.
- Markdown circular imports no longer break builds.
- Native workspace scrolling and settings loading states were restored.
- Dev plugin icons are allowed by asset scope.

## [0.2.2] - 2026-04-24

### Added

- Chromium launch parameter update support.
- Plugin download progress tracking.

### Changed

- Installed Chromium resources can be re-downloaded from cloud manifests.
- Built-in device presets are read-only.
- Profile close no longer leaves stale recovery state.
- Stop-all-running copy and plugin update statuses were refined.

## [0.2.1] - 2026-04-23

### Added

- Device presets now expose `browser_version`.
- Chrome UA Reduction formatting support for browser preset data.

## [0.2.0] - 2026-04-23

### Added

- Chromium lifecycle event subscription through WebSocket.
- Expanded Chromium event channels and download/offline UI.
- Bookmark management with templates and live profile sync.
- Per-platform Chromium version catalog for fingerprints.

### Fixed

- Route-level error boundary prevents a page crash from blanking the whole app.
- Gemini now uses native `systemInstruction`.
- AI session restore race condition was fixed.

## [0.1.9] - 2026-04-20

### Fixed

- Automation canvas properties panel no longer closes while typing.
- Chromium logging is disabled by default.

## [0.1.8] - 2026-04-19

### Added

- Unified language/timezone card with follow-IP and manual modes.
- Proxy selector now displays IP, geolocation, country flags, and status badges.
- Device preset saves sync changes to linked profiles.

### Fixed

- Host locale resolution uses GeoLite2-City for timezone and avoids ipapi rate limits.
- Batch profile launch reuses a short-lived host-locale cache.
- macOS preset UA and UA-CH values now follow Chrome standards.

## [0.1.7] - 2026-04-19

### Added

- New custom app icons and splash logo.
- Host IP locale auto-fill when no proxy is set.
- Tighter simulation platform cards.

### Fixed

- Dev data directory and skill visibility handling.
- First-launch sidebar navigation interaction.
- Host locale fallback now uses proxy fallback data more reliably.

## [0.1.6] - 2026-04-18

### Fixed

- Window arrangement work area is converted from physical pixels to DIP.
- Arrange preview updates when row/column values change.
- Grid/sidebar visual gap no longer includes a spurious decoration delta.

## [0.1.5] - 2026-04-18

### Added

- Expanded Magic Controller backend and automation canvas tools.
- Dev Config settings tab for custom Chromium executable override.
- Custom theme preset management.
- Settings sidebar subroutes.
- Device preset and sandboxed filesystem tools for AI agents.
- Localized native system menu.
- Multi-run automation state with profile identity in events, notifications, run list, and canvas.
- Global resource download progress persistence.
- Real-time AI chat streaming for all providers.
- Global default startup URL preference and validation.
- Profile visual identity inheritance and UI controls.
- Collapsible workspace sidebar submenus.
- AI assistant sections for sessions, skills, filesystem workspace, and MCP.
- Skill management, built-in skills, per-session skill activation, and skill install flow.
- Sandboxed AI filesystem workspace with folder descriptions.
- MCP server integration with stdio, HTTP, OAuth, token keychain storage, and resource support.
- Guarded exec command tool for AI agents.
- Agent message limits and screenshot compression.
- Enhanced AI message Markdown rendering with syntax highlighting.
- Window arrangement fill layouts, live preview, and templates.
- Responsive workspace layout updates.

### Changed

- Profile close and Chromium shutdown paths were made non-blocking.
- Settings and AI assistant layouts were reorganized around sidebar/dialog patterns.
- CDP tools duplicated by Magic Controller equivalents were disabled.
- Chat streaming and workspace rendering performance were improved.

### Fixed

- Finder reveal now opens the data directory correctly.
- Missing resource/profile toast i18n keys were added.
- Automation canvas popovers, terminal safe quit, and flow editor localization were fixed.
- AI chat Google warnings, tool modal overflow, IME enter handling, and table dialog overflow were fixed.
- Profile default startup URL and visual preview behavior were corrected.
- Chromium no longer crashes when all tabs are closed.
- Sidebar submenu toggling no longer navigates unexpectedly.
- File tools and MCP dangerous operation handling were hardened.
- MCP OAuth CSRF protection, stderr draining, shutdown behavior, and JSON validation were improved.
- AI startup failure pass-through, UTF-8 panic handling, stalled/max-round stop states, and terminal UI were fixed.

## [0.1.4] - 2026-04-13

### Fixed

- Resource install failures now show the actual error instead of a generic message.

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

[0.2.3]: https://github.com/jt302/multi-flow/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/jt302/multi-flow/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/jt302/multi-flow/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/jt302/multi-flow/compare/v0.1.9...v0.2.0
[0.1.9]: https://github.com/jt302/multi-flow/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/jt302/multi-flow/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/jt302/multi-flow/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/jt302/multi-flow/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/jt302/multi-flow/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/jt302/multi-flow/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/jt302/multi-flow/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/jt302/multi-flow/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/jt302/multi-flow/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jt302/multi-flow/releases/tag/v0.1.0
