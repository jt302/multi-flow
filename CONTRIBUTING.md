# Contributing

## Setup

Use the checked-in toolchain pins:

- Node: `.nvmrc`
- pnpm: `packageManager` in `package.json`
- Rust: `rust-toolchain.toml`

```bash
pnpm install --frozen-lockfile
```

## Required Local Checks

Run these before opening a PR:

```bash
pnpm -s release:check
pnpm -s test
pnpm -s build
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Commit Style

Use Conventional Commits in English:

- `fix: ...`
- `feat: ...`
- `perf: ...`
- `test: ...`
- `docs: ...`
- `ci: ...`
- `chore: ...`

Keep one topic per commit.

## Tauri Command Rules

- Do not run blocking I/O, process launch/stop, downloads, network calls, or batch loops inside a synchronous command.
- Prefer `pub async fn` plus `tauri::async_runtime::spawn_blocking` for blocking work.
- When moving work into a blocking closure, pass `AppHandle` and fetch `app.state::<AppState>()` inside the closure.
- Keep bulk operations serial unless resource contention has been reviewed.

## Frontend Rules

- Forms use `react-hook-form` + `@hookform/resolvers` + `zod`.
- Keep server/Rust data in query cache, and UI-only transient state in local state or Zustand.
- Event listeners must clean up `unlisten` handlers.
- Avoid runtime `console.*`; use user-visible errors or the frontend error reporting hook.

## Documentation

If implementation and docs disagree, update docs with the same change. AI-facing implementation context lives under `docs/ai`.
