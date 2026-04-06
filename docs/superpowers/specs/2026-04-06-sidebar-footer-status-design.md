# Sidebar Footer Status Dashboard — Design Spec

**Date:** 2026-04-06  
**Status:** Approved

---

## Problem

The current `SidebarFooter` shows a "Runtime Status" card with an "Execution Engine" toggle. This toggle is entirely fake — `isRunning` is a `useState(true)` local boolean with no backend connection. Clicking "Pause Engine" only flips a badge, it does nothing to the real Rust backend.

Meanwhile, the app has real, live status data (running profiles, proxy health, sync connection, automation state) that is never surfaced in the sidebar. Users must navigate to individual pages to check system health.

---

## Goal

Replace the fake engine toggle with a real **System Status Dashboard** in the `SidebarFooter`. Each row shows live data from existing hooks/stores, is color-coded by health, and navigates to the relevant page on click.

---

## Design

### Expanded Sidebar

A single semi-transparent card (matching the `SidebarHeader` card style: `bg-sidebar-accent/30 border-sidebar-border/40`) with a `SYSTEM STATUS` label and 4 rows:

| Row | Label | Data Source | Click Target |
|---|---|---|---|
| 1 | 浏览器 | `useProfilesQuery()` → count where `running === true` | `/profiles` |
| 2 | 代理 | `useProxiesQuery()` → ok/total ratio | `/proxy` |
| 3 | 同步 | `useSyncManagerStore()` → `connectionStatus` | `/windows` |
| 4 | 自动化 | `useAutomationStore()` → `activeRunId` + `liveRunStatus` | `/automation` |

Each row: `<label> ... <Badge>` — hover background highlight, `cursor-pointer`.

### Badge Color Rules

**浏览器:**
- N > 0 → green `"N 运行中"`
- N = 0 → muted gray `"无运行"`

**代理:**
- All ok → green `"全部正常"`
- Some errors → yellow `"ok/total 正常"` (e.g. `"12/15 正常"`)
- All errors → red `"全部异常"`
- No proxies → muted gray `"无代理"`

**同步:**
- `connected` → blue `"已连接"`
- `starting` → yellow `"启动中"`
- `disconnected` / `error` → red `"离线"`
- `idle` → muted gray `"未启动"`

**自动化:**
- `liveRunStatus === 'running'` → green `"运行中"`
- `liveRunStatus === 'waiting_human'` → yellow `"等待操作"`
- `activeRunId === null` → muted gray `"空闲"`

### Collapsed Sidebar

Replace the single icon button with a **2×2 dot matrix**:

```
● ●   (浏览器, 代理)
● ●   (同步, 自动化)
```

Each dot colored by the same rules above (green / yellow / red / gray). Each dot has a `title` tooltip describing the status.

---

## Removed

- `isRunning: boolean` state from `workspace-layout.tsx`
- `onToggleRunning: () => void` from `workspace-layout.tsx`
- Both props from `WorkspaceSidebarProps` type
- The fake Badge / Button in `SidebarFooter`

---

## Files to Modify

1. `src/app/ui/workspace-sidebar.tsx` — remove old props, build new status card
2. `src/app/ui/workspace-layout.tsx` — remove `isRunning` state and `onToggleRunning`

---

## New Component

`src/app/ui/sidebar-footer-status.tsx` — self-contained component that:
- Reads from `useProfilesQuery`, `useProxiesQuery`, `useSyncManagerStore`, `useAutomationStore`
- Computes derived badge values
- Renders expanded or collapsed view based on `useSidebar().state`
- Handles click navigation via `useNavigate`

---

## Verification

1. Expanded: all 4 rows visible with real data badges
2. Collapsed: 2×2 dot matrix, tooltips on hover
3. Click each row → navigates to correct page
4. With 0 running profiles → badge shows muted gray "无运行"
5. With proxy errors → badge shows yellow count
6. Sync disconnected → badge shows red "离线"
7. Automation running → badge shows green "运行中"
8. No TypeScript errors: `pnpm -s build`
