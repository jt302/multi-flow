# Geolocation Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为环境高级设置新增地理位置模式与权限策略，并让启动时真正映射到 Chromium 正式地理位置参数。

**Architecture:** 在现有 `advanced.geolocation` 基础上增量扩展 `geolocationMode` 和 `autoAllowGeolocation`。前端按 `off / ip / custom` 模式驱动表单，后端在启动阶段解析代理 GEO 与本机公网 GEO，最终注入 Chromium 正式参数。

**Tech Stack:** React + TypeScript + react-hook-form + zod + Tauri v2 + Rust + SeaORM

---

### Task 1: 前端表单测试先行

**Files:**
- Modify: `src/features/profile/model/profile-form.test.ts`
- Modify: `src/features/profile/model/profile-form.ts`

**Step 1: Write the failing test**

- 为 schema 增加以下测试：
  - `custom` 模式要求合法经纬度
  - `off` / `ip` 模式不要求经纬度
  - `autoAllowGeolocation` 默认值可被消费

**Step 2: Run test to verify it fails**

Run: `pnpm -s tsx --test src/features/profile/model/profile-form.test.ts`
Expected: FAIL，提示缺少新字段或旧校验逻辑不匹配。

**Step 3: Write minimal implementation**

- 扩展 `profileFormSchema`
- 增加模式默认值与新字段
- 更新相关辅助函数

**Step 4: Run test to verify it passes**

Run: `pnpm -s tsx --test src/features/profile/model/profile-form.test.ts`
Expected: PASS

### Task 2: 前端表单状态与 UI

**Files:**
- Modify: `src/entities/profile/model/types.ts`
- Modify: `src/features/profile/model/use-profile-create-form.ts`
- Modify: `src/features/profile/ui/advanced-settings-section.tsx`
- Modify: `src/features/profile/ui/profile-create-form.tsx`

**Step 1: Write the failing test**

- 如果需要，补充 payload 生成测试，验证：
  - `off` 不提交 geolocation
  - `ip` 提交 `geolocationMode = ip`
  - `custom` 提交模式与坐标

**Step 2: Run test to verify it fails**

Run: `pnpm -s tsx --test src/features/profile/model/profile-form.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- 表单默认值兼容旧环境
- UI 改为模式选择 + 权限复选框
- 仅在 `custom` 时显示输入框

**Step 4: Run test to verify it passes**

Run: `pnpm -s tsx --test src/features/profile/model/profile-form.test.ts`
Expected: PASS

### Task 3: 后端启动参数测试先行

**Files:**
- Modify: `src-tauri/src/commands/profile_commands.rs`
- Modify: `src-tauri/src/models.rs`

**Step 1: Write the failing test**

- 为 `resolve_launch_options` 增加测试：
  - `custom` 生成 `--custom-geolocation-*`
  - `autoAllowGeolocation` 生成 `--auto-allow-geolocation`
  - `ip` 优先使用代理 GEO
  - `off` 不生成 GEO 参数

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml resolve_launch_options -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

- 扩展 Rust 模型
- 替换 `--multi-flow-geolocation`
- 增加模式解析

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml resolve_launch_options -- --nocapture`
Expected: PASS

### Task 4: 本机公网 GEO 回退

**Files:**
- Modify: `src-tauri/src/commands/profile_commands.rs`
- Modify: `src-tauri/src/services/proxy_service.rs`（若需要抽复用 helper）

**Step 1: Write the failing test**

- 为 `ip` 模式增加“代理无 GEO 时回退本机公网 GEO”的可测逻辑

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml geolocation -- --nocapture`
Expected: FAIL

**Step 3: Write minimal implementation**

- 提取本机公网 IP 查询 helper
- 复用 GeoIP 查询逻辑
- 查询失败仅记录日志并跳过覆盖

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml geolocation -- --nocapture`
Expected: PASS

### Task 5: 文档与全量验证

**Files:**
- Modify: `docs/ai/architecture.md`
- Modify: `docs/ai/current-task.md`

**Step 1: Update docs**

- 同步记录新地理位置模式与权限策略

**Step 2: Run verification**

Run: `pnpm -s build`
Expected: exit 0

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: exit 0

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: exit 0
