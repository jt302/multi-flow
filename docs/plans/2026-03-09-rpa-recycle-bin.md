# RPA Recycle Bin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `/ai` 只展示 active RPA 流程，并把 archived 流程接入现有回收站页，支持恢复与彻底删除。

**Architecture:** 保持现有 RPA 数据层与控制台壳不变，补一个后端硬删除命令注册，前端通过参数化的 RPA flows query 区分 active/all 两种读取模式。回收站页直接接 RPA hooks，不额外扩展 console state 透传。

**Tech Stack:** React, TypeScript, TanStack Query, Tauri v2, Rust, SeaORM, node:test

---

### Task 1: 写前端行为测试

**Files:**
- Create: `src/features/ai/model/rpa-flow-list.test.ts`
- Create: `src/features/recycle-bin/model/rpa-recycle-bin.test.ts`

**Step 1: Write the failing test**

- 验证 `/ai` 列表 helper 只返回 `active` 流程，且按 `updatedAt` 倒序。
- 验证回收站 helper 会把 RPA deleted 项计入总数，并只返回 deleted 流程。

**Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --test src/features/ai/model/rpa-flow-list.test.ts src/features/recycle-bin/model/rpa-recycle-bin.test.ts`

Expected: FAIL with module not found

### Task 2: 写最小 helper 实现

**Files:**
- Create: `src/features/ai/model/rpa-flow-list.ts`
- Create: `src/features/recycle-bin/model/rpa-recycle-bin.ts`

**Step 1: Write minimal implementation**

- 提供 `/ai` 列表过滤排序 helper
- 提供回收站 deleted 流程过滤与总数统计 helper

**Step 2: Run test to verify it passes**

Run: `pnpm exec tsx --test src/features/ai/model/rpa-flow-list.test.ts src/features/recycle-bin/model/rpa-recycle-bin.test.ts`

Expected: PASS

### Task 3: 接后端与前端 UI

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/entities/rpa/api/rpa-api.ts`
- Modify: `src/entities/rpa/model/use-rpa-flows-query.ts`
- Modify: `src/features/ai/model/use-rpa-actions.ts`
- Modify: `src/features/ai/ui/ai-page.tsx`
- Modify: `src/features/recycle-bin/ui/recycle-bin-page.tsx`

**Step 1: 注册与暴露硬删除 API**

- 注册 `purge_rpa_flow`
- 前端增加 `purgeRpaFlow`
- action 增加 `purgeFlow`

**Step 2: 区分 active/all 列表**

- `useRpaFlowsQuery(includeDeleted = true)`
- `/ai` 传 `false`
- 回收站传 `true`

**Step 3: 改 UI**

- `/ai` 加“归档列表”入口并隐藏 archived
- 回收站新增 `RPA 流程` 区块
- 彻底删除前弹 `AlertDialog`

### Task 4: 文档与验证

**Files:**
- Modify: `docs/ai/current-task.md`
- Modify: `docs/ai/session-summary.md`

**Step 1: 更新文档**

- 记录 RPA 归档入口与彻底删除能力

**Step 2: 运行验证**

Run:
- `pnpm exec tsx --test src/features/ai/model/rpa-flow-list.test.ts src/features/recycle-bin/model/rpa-recycle-bin.test.ts src/features/ai/model/rpa-editor-window.test.ts src/features/ai/model/rpa-editor-close-guard.test.ts`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `pnpm -s build`

Expected: PASS
