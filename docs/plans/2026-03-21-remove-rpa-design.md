# Remove RPA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely remove all RPA-related functionality, routes, commands, runtime logic, persisted data tables, and docs from `multi-flow`.

**Architecture:** Keep historical migrations only as already-applied upgrade history, but remove every runtime code path that depends on RPA and add one new migration that drops all `rpa_*` tables plus `rpa_runs` task fields. Frontend removes all `/rpa*` pages, navigation, editor window, recycle-bin integration, data hooks, and tests so the workspace no longer references RPA at all.

**Tech Stack:** React, TypeScript, Vite, TanStack Query, Zustand, Tauri v2, Rust, SeaORM, SQLite

---

### Task 1: Lock removal boundaries with failing frontend tests

**Files:**
- Modify: `src/app/workspace-routes.test.ts`
- Modify: `src/app/ui/workspace-sidebar.test.tsx`
- Modify: `src/features/recycle-bin/model/rpa-recycle-bin.test.ts`

**Step 1: Write the failing test**

- Update route/sidebar tests to assert there is no `rpa` nav id, no `/rpa*` workspace path, and no RPA submenu rendering.
- Replace recycle-bin RPA-specific assertions with new expectations that deleted-item counts exclude RPA data.

**Step 2: Run test to verify it fails**

Run: `pnpm -s vitest run src/app/workspace-routes.test.ts src/app/ui/workspace-sidebar.test.tsx src/features/recycle-bin/model/rpa-recycle-bin.test.ts`

Expected: FAIL because current app still contains RPA navigation and recycle-bin logic.

**Step 3: Write minimal implementation**

- Remove RPA navigation/routes/recycle-bin helpers and adjust the affected tests’ target modules.

**Step 4: Run test to verify it passes**

Run the same `vitest` command and confirm all targeted tests pass.

### Task 2: Remove frontend RPA modules and runtime references

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/app/model/workspace-nav-items.ts`
- Modify: `src/app/model/workspace-types.ts`
- Modify: `src/app/workspace-routes.ts`
- Modify: `src/app/ui/workspace-topbar.tsx`
- Modify: `src/app/model/workspace-sections.ts`
- Modify: `src/features/recycle-bin/ui/recycle-bin-page.tsx`
- Modify: `src/shared/config/query-keys.ts`
- Delete: `src/entities/rpa/**`
- Delete: `src/features/rpa/**`
- Delete: `src/pages/rpa/**`
- Delete: `src/pages/rpa-tasks/**`
- Delete: `src/pages/rpa-runs/**`
- Delete: `src/pages/rpa-flow-editor/**`
- Delete: `src/store/rpa-studio-store.ts`
- Delete: `scripts/tests/rpa-window-capability.test.ts`

**Step 1: Write the failing test**

- Reuse the Task 1 route/sidebar/recycle-bin failures as the red phase for this slice.

**Step 2: Run test to verify it fails**

Run the Task 1 `vitest` command if needed to reconfirm red.

**Step 3: Write minimal implementation**

- Delete RPA-specific modules and remove every import/reference from shared app shells.
- Keep query keys and recycle-bin code aligned with the new non-RPA shape.

**Step 4: Run test to verify it passes**

Run: `pnpm -s vitest run src/app/workspace-routes.test.ts src/app/ui/workspace-sidebar.test.tsx`

Expected: PASS.

### Task 3: Remove backend RPA runtime, command registration, and state wiring

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/db/entities/mod.rs`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/commands/profile_commands.rs`
- Delete: `src-tauri/src/rpa_scheduler.rs`
- Delete: `src-tauri/src/commands/rpa_commands.rs`
- Delete: `src-tauri/src/services/rpa_artifact_service.rs`
- Delete: `src-tauri/src/services/rpa_flow_service.rs`
- Delete: `src-tauri/src/services/rpa_run_service.rs`
- Delete: `src-tauri/src/services/rpa_runtime_service.rs`
- Delete: `src-tauri/src/services/rpa_task_service.rs`
- Delete: `src-tauri/src/db/entities/rpa_flow.rs`
- Delete: `src-tauri/src/db/entities/rpa_flow_target.rs`
- Delete: `src-tauri/src/db/entities/rpa_run.rs`
- Delete: `src-tauri/src/db/entities/rpa_run_instance.rs`
- Delete: `src-tauri/src/db/entities/rpa_run_step.rs`
- Delete: `src-tauri/src/db/entities/rpa_task.rs`
- Delete: `src-tauri/src/db/entities/rpa_task_target.rs`

**Step 1: Write the failing test**

- Add/adjust a focused Rust test around the new cleanup migration list or app-state startup behavior so the compiler/test suite fails while RPA modules are still referenced.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml rpa -- --nocapture`

Expected: FAIL while the old RPA modules and references still exist or old test names still expect them.

**Step 3: Write minimal implementation**

- Remove all RPA runtime wiring, command registration, service storage, startup recovery, and any dead model types only used by RPA.
- Update other tests/helpers that constructed `AppState` with RPA services.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS for the Rust suite.

### Task 4: Drop RPA data structures with a forward migration

**Files:**
- Modify: `src-tauri/src/db/migrator/mod.rs`
- Add: `src-tauri/src/db/migrator/m20260321_000014_drop_rpa_tables.rs`

**Step 1: Write the failing test**

- Add a migration test that expects the latest migrator list to include a drop-RPA migration and verifies RPA tables are absent after full migration.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml migration -- --nocapture`

Expected: FAIL because the new migration is not implemented yet.

**Step 3: Write minimal implementation**

- Append a new migration that safely drops `rpa_flow_targets`, `rpa_run_steps`, `rpa_run_instances`, `rpa_task_targets`, `rpa_tasks`, `rpa_flows`, and `rpa_runs`.
- Remove `task_id` / `task_name` columns from `rpa_runs` before dropping the table if required by SQLite sequencing.

**Step 4: Run test to verify it passes**

Run the same `cargo test` command and confirm the migration assertions pass.

### Task 5: Update AI docs and historical plan context

**Files:**
- Modify: `docs/ai/architecture.md`
- Modify: `docs/ai/current-task.md`
- Modify: `docs/ai/project-context.md`
- Modify: `docs/ai/session-summary.md`
- Add or modify: any doc note needed to explain that RPA has been removed

**Step 1: Write the failing test**

- No automated doc test. Use a manual checklist against the confirmed requirement: no docs should describe RPA as an active product capability.

**Step 2: Run verification to identify failures**

Run: `rg -n "\\bRPA\\b|\\brpa\\b|Rpa" docs/ai src src-tauri`

Expected: remaining matches point only to the historical migration files and the new drop migration context.

**Step 3: Write minimal implementation**

- Remove or rewrite RPA sections so docs match the new product scope.

**Step 4: Run verification**

Run the same `rg` command and confirm only intentional historical references remain.

### Task 6: Full verification

**Files:**
- Verify workspace after all edits

**Step 1: Run frontend build**

Run: `pnpm -s build`

Expected: exit 0.

**Step 2: Run React Doctor**

Run: `npx -y react-doctor@latest . --verbose --diff`

Expected: no blocking correctness errors.

**Step 3: Run backend checks**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: exit 0.

**Step 4: Run backend tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: exit 0.
