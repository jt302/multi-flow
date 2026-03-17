# Sync Protocol Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `multi-flow` 的窗口同步模块更新到当前 Chromium 与 `multi-flow-sync-manager` 协议，并顺手收敛最相关的类型、诊断展示、适配层与文档。

**Architecture:** 以“协议对齐优先、局部收口”为原则推进。先统一 `docs/ai` 与上游协议差异，再补 Rust adapter / 前端类型与 store 解析，最后把新增绑定状态接入窗口同步诊断 UI，并用最小测试覆盖关键字段解析与页面展示。

**Tech Stack:** React 19、TypeScript、Zustand、TanStack Query、Tauri v2、Rust、Axum、tokio-tungstenite

---

### Task 1: 明确协议差异并固化文档基线

**Files:**
- Modify: `docs/ai/chromium.md`
- Modify: `docs/ai/multi-flow-sync-manager.md`
- Modify: `docs/ai/current-task.md`
- Modify: `docs/ai/session-summary.md`

**Step 1: 核对上游协议字段**

检查：
- `/Users/tt/Developer/Personal/chromium/chromium.md`
- `/Users/tt/Developer/Personal/chromium/sidecar-integration.md`
- `/Users/tt/Developer/Personal/Rust/multi-flow-sync-manager/AGENTS.md`

重点确认：
- `bound_browser_id`
- `bound_window_token`
- `coordinate_mode`
- `window_x`
- `window_y`
- `window_relative` 坐标语义

**Step 2: 更新项目内 AI 文档**

把 `docs/ai/*` 中同步协议说明更新到当前口径，明确：
- `get_sync_status` 新增绑定字段
- 事件 envelope 新增 `window_x / window_y`
- 当前同步定位与坐标模型的约束

**Step 3: 记录当前任务/阶段**

在 `docs/ai/current-task.md` 与 `docs/ai/session-summary.md` 里补本轮“协议对齐 + 模块收口”说明。

### Task 2: 先写失败测试锁定新增实例字段解析

**Files:**
- Modify: `src/store/sync-manager-store.test.ts`
- Modify: `src/entities/window-session/model/types.ts`

**Step 1: 写失败测试**

为 `instances.updated` 新增断言，要求前端实例状态能正确解析：
- `bound_browser_id`
- `bound_window_token`
- `coordinate_mode`

**Step 2: 跑单测验证失败**

Run:

```bash
node --test src/store/sync-manager-store.test.ts
```

Expected: 失败在新增字段断言上。

### Task 3: 最小实现前端类型与 store 解析

**Files:**
- Modify: `src/entities/window-session/model/types.ts`
- Modify: `src/store/sync-manager-store.ts`

**Step 1: 扩展类型**

在 `SyncManagerInstanceInfo` 中新增：
- `boundBrowserId?: number | null`
- `boundWindowToken?: string | null`
- `coordinateMode?: string | null`

**Step 2: 扩展 normalize 逻辑**

在 `normalizeInstance` 里解析并映射：
- `record.bound_browser_id`
- `record.bound_window_token`
- `record.coordinate_mode`

**Step 3: 跑单测转绿**

Run:

```bash
node --test src/store/sync-manager-store.test.ts
```

Expected: 通过。

### Task 4: 对齐窗口同步目标与诊断展示

**Files:**
- Modify: `src/pages/windows/index.tsx`
- Modify: `src/features/window-session/model/page-types.ts`
- Modify: `src/features/window-session/ui/windows-page.tsx`
- Modify: `src/features/window-session/ui/windows-page.test.ts`

**Step 1: 写失败测试**

为窗口同步页补源码级测试，要求源码中包含新增诊断字段展示入口，例如：
- 绑定浏览器窗口 ID
- 绑定窗口 token
- 坐标模式

**Step 2: 跑测试确认失败**

Run:

```bash
node --test src/features/window-session/ui/windows-page.test.ts
```

Expected: 因缺少新字段展示而失败。

**Step 3: 最小实现**

只在“同步诊断”区域接入新增字段，避免扩大页面复杂度。
建议展示：
- 当前会话 master/slave 的绑定窗口状态
- 若存在 `coordinateMode`，显示其值
- 若存在 `boundBrowserId / boundWindowToken`，显示简短诊断信息

**Step 4: 跑测试转绿**

Run:

```bash
node --test src/features/window-session/ui/windows-page.test.ts
```

Expected: 通过。

### Task 5: 评估并收敛 Rust adapter 兼容层

**Files:**
- Modify: `src-tauri/src/services/chromium_magic_adapter_service.rs`

**Step 1: 比较当前 Chromium 返回与 adapter 重写逻辑**

确认现有逻辑是否仍需要：
- `bounds x/y -> left/top`
- `magic-socket-server-port` 重写
- 整数化修正

并检查新字段是否应直接透传，不做破坏性改写。

**Step 2: 如需兼容补测试**

优先为 adapter 新增最小测试，确认：
- 新字段不会被 adapter 丢失
- 现有字段重写不影响新协议字段

**Step 3: 实现最小变更**

只改兼容层，不改业务命令层语义。

### Task 6: 更新页面与 store 的无效旧假设

**Files:**
- Modify: `src/features/window-session/model/window-sync-forms.ts`
- Modify: `src/features/window-session/model/window-sync-forms.test.ts`

**Step 1: 检查是否还有过时启动假设**

确保当前代码不再强依赖已废弃或已下沉到 sidecar/Chromium 的旧前置校验语义。

**Step 2: 让测试和当前产品口径一致**

保持“只要 `sync-manager` 已连接即可允许启动同步”的页面层判断。

### Task 7: 全量校验

**Files:**
- Test: `src/store/sync-manager-store.test.ts`
- Test: `src/features/window-session/ui/windows-page.test.ts`
- Test: `src/features/window-session/model/window-sync-forms.test.ts`

**Step 1: 跑前端相关 node 测试**

```bash
node --test src/store/sync-manager-store.test.ts src/features/window-session/ui/windows-page.test.ts src/features/window-session/model/window-sync-forms.test.ts
```

**Step 2: 跑前端构建**

```bash
pnpm -s build
```

**Step 3: 跑后端检查**

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

**Step 4: 跑后端测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

**Step 5: 跑 React Doctor**

```bash
npx -y react-doctor@latest . --verbose --diff
```
