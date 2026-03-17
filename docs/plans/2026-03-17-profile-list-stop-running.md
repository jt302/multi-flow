# Profile List Stop Running Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在环境列表工具栏新增“不用勾选即可停止当前筛选结果中全部运行中环境”的一键停止按钮，并补上二次确认。

**Architecture:** 保持现有 `ProfileListPage -> ProfileListToolbar -> ProfileListFilters` 的数据流，在页面层新增确认弹窗开关并把 `filteredRunningIds` 直接传给现有 `onBatchCloseProfiles`。危险操作使用现成 `ConfirmActionDialog`，不新增后端接口。

**Tech Stack:** React、TypeScript、shadcn/ui、node:test

---

### Task 1: 接入一键停止运行中按钮

**Files:**
- Modify: `src/features/profile/ui/profile-list-page.tsx`
- Modify: `src/features/profile/ui/profile-list-toolbar.tsx`
- Modify: `src/features/profile/ui/profile-list-filters.tsx`
- Test: `src/features/profile/ui/profile-detail-and-list-item.test.ts`

**Step 1: Write the failing test**

在 `src/features/profile/ui/profile-detail-and-list-item.test.ts` 增加断言，要求源码包含：
- `一键停止运行中`
- `filteredRunningIds`
- `ConfirmActionDialog`
- 确认文案中包含停止运行中环境数量

**Step 2: Run test to verify it fails**

Run: `node --test src/features/profile/ui/profile-detail-and-list-item.test.ts`

Expected: FAIL，提示缺少一键停止按钮或确认弹窗接线。

**Step 3: Write minimal implementation**

在页面层增加确认弹窗状态，并把 `onBatchCloseProfiles(filteredRunningIds)` 作为确认动作；在工具栏和筛选组件中新增 `onStopAllRunning` 入口与按钮。

**Step 4: Run test to verify it passes**

Run: `node --test src/features/profile/ui/profile-detail-and-list-item.test.ts`

Expected: PASS

**Step 5: Verify project checks**

Run: `pnpm -s build`
Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: 两个命令退出码为 0。
