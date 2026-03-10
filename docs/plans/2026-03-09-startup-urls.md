# Startup URLs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将创建环境中的默认打开 URL 从单值升级为多值列表，并在启动时把所有 URL 依次作为 Chromium 启动参数传入。

**Architecture:** 前端表单把 `startupUrl` 改为 `startupUrls` 多行文本输入，校验为每行一个 `http/https` URL；后端模型与服务层升级为 `startup_urls: Vec<String>` 并兼容旧 `startup_url`；启动链路将 URL 列表顺序拼接到 Chromium 启动参数末尾。

**Tech Stack:** React + TypeScript + RHF + Zod + Tauri v2 + Rust + SQLite + SeaORM

---

### Task 1: 后端模型与启动参数测试

**Files:**

- Modify: `src-tauri/src/commands/profile_commands.rs`
- Modify: `src-tauri/src/services/profile_service.rs`

**Step 1: Write the failing test**

- 为 `resolve_launch_options` 增加测试，验证传入多个 startup URLs 时，顺序保留且都通过校验。
- 为 `profile_service` 增加测试，验证旧 `startup_url` 会兼容迁移到新列表模型。

**Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path src-tauri/Cargo.toml startup_url -- --nocapture`
Expected: FAIL，字段或行为与新模型不匹配。

**Step 3: Write minimal implementation**

- 将 `ProfileBasicSettings.startup_url` 升级为 `startup_urls`
- 保留兼容读取旧 `startup_url`
- 更新启动参数拼装逻辑为依次追加多个 URL

**Step 4: Run test to verify it passes**
Run: `cargo test --manifest-path src-tauri/Cargo.toml startup_url -- --nocapture`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/models.rs src-tauri/src/services/profile_service.rs src-tauri/src/commands/profile_commands.rs
git commit -m "feat(profile): support multiple startup urls"
```

### Task 2: 前端表单与详情展示

**Files:**

- Modify: `src/entities/profile/model/types.ts`
- Modify: `src/features/profile/create-profile/model/profile-form.ts`
- Modify: `src/features/profile/create-profile/model/use-profile-create-form.ts`
- Modify: `src/features/profile/create-profile/ui/basic-settings-section.tsx`
- Modify: `src/features/profile/detail/ui/profile-detail-page.tsx`

**Step 1: Write the failing test**

- 为表单 schema 增加测试，验证多行 URL 仅接受 http/https。

**Step 2: Run test to verify it fails**
Run: `node --test src/features/profile/create-profile/model/profile-form.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

- 将表单字段改为 `startupUrls`
- 使用 `Textarea` 一行一个 URL
- 默认值保留为一行 `https://www.browserscan.net/`
- 详情页按多行列表展示

**Step 4: Run test to verify it passes**
Run: `node --test src/features/profile/create-profile/model/profile-form.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/entities/profile/model/types.ts src/features/profile/create-profile/model/profile-form.ts src/features/profile/create-profile/model/use-profile-create-form.ts src/features/profile/create-profile/ui/basic-settings-section.tsx src/features/profile/detail/ui/profile-detail-page.tsx
```

### Task 3: 全量验证与文档同步

**Files:**

- Modify: `AGENTS.md`
- Modify: `docs/ai/architecture.md`
- Modify: `docs/ai/current-task.md`

**Step 1: Update docs**

- 记录默认打开 URL 已支持多条且按顺序传给 Chromium。

**Step 2: Run verification**
Run:

- `pnpm -s build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: all pass
