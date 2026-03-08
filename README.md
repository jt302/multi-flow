# Multi-Flow

基于 Tauri + React 的多环境浏览器管理台（对标 AdsPower 的核心能力面）。

## 技术栈

- Desktop：Tauri（Rust）
- Frontend：React + React Router + shadcn/ui + lucide-react + Tailwind CSS
- Form（复杂表单）：react-hook-form + @hookform/resolvers + zod
- Browser Engine：自研/魔改 Chromium 144
- Storage：SQLite
- ORM：SeaORM（含 SeaORM Migration）

## 当前架构约定（重要）

- Profile 持久化长期方案为 `SQLite + SeaORM`
- 现有 `profiles.json` 仅视为历史过渡实现，后续将迁移移除
- 相关架构细节请以 `docs/ai/architecture.md` 为准

## 本地开发

```bash
pnpm install
pnpm tauri dev
```

## 资源下载配置

- 内置资源：Chromium(dmg) 与 GeoLite2-City(mmdb)
- 可选远端清单：设置环境变量 `MULTI_FLOW_RESOURCE_MANIFEST_URL`
- 指定 Chromium 可执行路径（优先级最高）：`MULTI_FLOW_CHROMIUM_EXECUTABLE`
- Chromium 安装与版本切换：通过 Tauri 命令 `install_chromium_resource` 与 `activate_chromium_version`
