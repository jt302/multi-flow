# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Default to Chinese for responses and comments. Lead with actionable conclusions, then explain reasoning.

## Commands

```bash
# Development
pnpm tauri dev                  # Run the full app (frontend + Tauri backend)

# Build & check
pnpm -s build                   # Frontend: TypeScript check + Vite build
cargo check --manifest-path src-tauri/Cargo.toml   # Backend: Rust type check
cargo test --manifest-path src-tauri/Cargo.toml    # Backend: run tests

# Run these checks after completing any feature work.
```

If Node is managed by nvm, ensure the nvm environment is loaded before running commands.

## Architecture

**Multi-Flow** is a Tauri v2 desktop app — a multi-profile browser manager with custom Chromium, proxy management, fingerprint isolation, plugin system, and window synchronization.

### Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query + Zustand
- **Backend**: Tauri v2 + Rust + SQLite + SeaORM
- **Browser engine**: Custom Chromium (macOS primary)
- **Sidecars**: proxy-daemon, sync-manager (external binaries)

### Backend Layering (src-tauri/src/)

Commands → Services → SeaORM Entities → SQLite

- `commands/` — Tauri command handlers (thin layer, delegates to services)
- `services/` — Business logic (profile, proxy, resource, plugin, sync, etc.)
- `engine_manager/` — Chromium process lifecycle, CDP connection, port management
- `db/entities/` — SeaORM entity definitions
- `db/migrator/` — Database migrations
- `state.rs` — `AppState` with `Mutex<T>` service access
- `models.rs` — Shared type definitions for Tauri commands
- `runtime_guard.rs` — Background process reconciliation on startup
- `local_api_server/` — Local HTTP/WebSocket API (Axum)

### Frontend Structure (Feature-Sliced Design)

- `src/app/` — App init, providers, router, workspace layout
- `src/pages/` — Route pages (dashboard, profiles, plugins, groups, proxy, windows, settings, recycle-bin)
- `src/widgets/` — Page-level composition blocks
- `src/features/` — Business actions, mutations, forms (per-domain modules)
- `src/entities/` — Domain types, TanStack Query hooks, read-only display components
- `src/shared/api/tauri-invoke.ts` — Typed `tauriInvoke<T>()` wrapper for all backend calls
- `src/shared/config/query-keys.ts` — Centralized TanStack Query cache keys
- `src/store/` — Zustand stores (local UI state)
- `src/components/ui/` — shadcn/ui components
- `src/components/common/` — Project-specific reusable components

### State Management Pattern

- **Server state**: TanStack Query (queries in `entities/*/model/use-*-query.ts`)
- **Local UI state**: Zustand (in `store/`)
- **Form state**: react-hook-form + zod via @hookform/resolvers

### Key Entities

profiles, profile_groups, proxies, profile_proxy_bindings, engine_sessions, device_presets, plugin_packages

## Internationalization (i18n)

All user-visible text **must** use `react-i18next`. Never hardcode Chinese or English strings in components.

**Locale files**: `src/shared/i18n/locales/{zh-CN,en-US}/<namespace>.json`

**Namespaces** (pick the closest fit, do not create new ones without reason):
- `nav` — sidebar, navigation, global UI chrome
- `common` — shared labels (status, actions, confirmations)
- `profile`, `proxy`, `automation`, `plugin`, `group`, `window`, `settings`, `dashboard`, `chat`, `canvas`, `log`, `device`, `recycle`, `platform`

**Usage pattern**:
```tsx
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('nav');
// then: t('sidebar.systemStatus')
```

**Checklist when adding any UI text**:
1. Add the key + zh-CN value to `src/shared/i18n/locales/zh-CN/<namespace>.json`
2. Add the key + en-US value to `src/shared/i18n/locales/en-US/<namespace>.json`
3. Use `t('key')` in the component — no raw strings

## Development Conventions

- Forms use react-hook-form + zod (zodResolver) exclusively.
- All clickable elements must have `cursor-pointer`.
- Pages split by route — don't pile multiple features into one page component.
- Batch operations must return success/failure counts.
- Destructive operations require a confirmation dialog before execution.
- Incremental changes on existing architecture; no unrelated refactoring.
- If implementation conflicts with docs, follow current requirements and update `docs/ai/` accordingly.
- When adding or modifying AI tools, update both `docs/ai/ai-tools-developer.md` and `docs/ai/ai-tools-agent.md`.

## AI Documentation Index

Read relevant docs before starting implementation, update them after changes:

- `docs/ai/architecture.md` — Core architectural decisions, schema, FSD guidelines
- `docs/ai/project-context.md` — Business context, roadmap, feature comparison
- `docs/ai/chromium.md` — Custom Chromium integration, Magic Controller protocol, CDP
- `docs/ai/multi-flow-sync-manager.md` — Window sync sidecar protocol
- `docs/ai/proxy-daemon.md` — Proxy daemon sidecar
- `docs/ai/current-task.md` — Active development priorities
- `docs/ai/ai-tools-developer.md` — AI tool definitions, parameters, architecture (developer reference)
- `docs/ai/ai-tools-agent.md` — AI tool usage guide, decision tree, task scenarios (agent reference)

## Environment Variables

- `MULTI_FLOW_RESOURCE_MANIFEST_URL` — Override resource manifest endpoint
- `MULTI_FLOW_CHROMIUM_EXECUTABLE` — Override Chromium binary path

## Related Projects

- Custom Chromium source: `/Users/tt/Developer/Personal/chromium`
- Sync Manager: `/Users/tt/Developer/Personal/Rust/multi-flow-sync-manager`
- Tauri logs: `/Users/tt/Library/Application Support/com.tt.multi-flow/logs/backend.log`
