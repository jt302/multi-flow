# Window Sync Toolbar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 合并窗口同步页面的启动/停止主按钮，按运行状态切换文案，并在按钮上展示 loading，同时保留重启同步与刷新同步状态两个次级操作。

**Architecture:** 保持现有 `WindowsPage` 的 `runAction` 异步包装模式，在页面层新增轻量级的同步操作 pending 状态，不改动 `use-window-sync-actions` 的命令边界。测试继续采用当前文件内容断言方式，锁定按钮文案、loading 态和保留动作。

**Tech Stack:** React、TypeScript、shadcn/ui、lucide-react、node:test

---

### Task 1: 调整同步工具栏按钮区

**Files:**
- Modify: `src/features/window-session/ui/windows-page.tsx`
- Test: `src/features/window-session/ui/windows-page.test.ts`

**Step 1: Write the failing test**

在 `src/features/window-session/ui/windows-page.test.ts` 新增断言，要求页面源码包含：
- 单个状态按钮的“启动同步中”“停止同步中”文案
- `disabled={syncActionPending || !startValidation.ok}` 与 `disabled={syncActionPending || !activeSyncSession}` 之类的 loading/禁用控制
- 保留“重启同步”“刷新同步状态”

**Step 2: Run test to verify it fails**

Run: `node --test src/features/window-session/ui/windows-page.test.ts`

Expected: FAIL，提示缺少新的 loading 文案或 pending 控制。

**Step 3: Write minimal implementation**

在 `src/features/window-session/ui/windows-page.tsx`：
- 新增同步主操作的 pending 状态
- 把启动/停止按钮合并为一个按钮，按 `activeSyncSession` 切换行为
- 在 pending 时切换为“启动同步中”或“停止同步中”
- 将次级操作区调整为“重启同步 + 刷新同步状态”

**Step 4: Run test to verify it passes**

Run: `node --test src/features/window-session/ui/windows-page.test.ts`

Expected: PASS

**Step 5: Verify project checks**

Run: `pnpm -s build`
Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: 全部退出码为 0。
