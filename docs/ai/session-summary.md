# AI 会话摘要

## 2026-04-17 原生系统菜单国际化修复进度

### 已完成

- Tauri 原生系统菜单改为按 `appLanguage` 构建，支持 `zh-CN / en-US`
- 应用偏好新增 `appLanguage`，后端持久化后作为原生菜单与退出确认弹窗的语言真相源
- 首次启动按“已保存语言 > 系统语言 > 中文回退”解析原生菜单语言
- 设置页切换界面语言时，前端改为调用 Tauri `update_app_language`，实时重建系统菜单，无需重启
- 主窗口关闭时的原生退出确认弹窗已同步中英文文案

## 2026-04-04 中文国际化修复进度

### 已完成

#### 阶段1：核心UI界面（已完成）
- **workspace-sidebar.tsx** - 侧边栏导航国际化
- **human-intervention-modal.tsx** - 人工干预弹窗
- **step-error-pause-modal.tsx** - 步骤错误暂停弹窗
- **workspace-layout.tsx** - 工作区布局

更新翻译文件：
- `nav.json` - 新增 sidebar.* 键（navigation, devicePresets, runtimeStatus, executionEngine等），侧边栏文案已统一为“机型预设”
- `common.json` - 新增 40+ 翻译键（processing, confirm, cancel, stepErrorTitle等）

#### 阶段2：关键功能组件（已完成）
- **window-batch-actions-card.tsx** - 批量操作卡片（批量新标签、批量新窗口等）
- **window-states-card.tsx** - 窗口状态卡片（运行环境窗口、状态徽章等）
- **groups-page.tsx** - 分组页面（列表、搜索、统计）
- **group-delete-alert-dialog.tsx** - 删除分组确认弹窗

更新翻译文件：
- `window.json` - 新增 batch.* 和 states.* 命名空间
  - batch: title, batchNewTab, batchNewWindow, batchCloseCurrentTab, batchCloseBgTab, batchFocus, refreshWindowState, selectedRunning
  - states: title, noRunningWindows, windows, tabs, running, stopped, operating, syncing, profileDetail, newTab, newWindow, closeCurrentTab, closeBgTabs, windowNumber, current, background, activateFirstTab, runningWithoutWindows
- `group.json` - 新增 page.* 和 delete.* 命名空间
  - page: title, searchPlaceholder, newGroup, currentGroups, coveredProfiles, noMatchingGroups, table.*, profileCountBadge
  - delete: title, description, currentGroup, cancel, confirmDelete

#### 阶段3：自动化步骤标签（已评估）
- `step-registry.ts` - ✅ 已实现 i18n 支持（getKindLabel 函数优先使用 i18n，回退中文常量）
- `automation.json` - ✅ 已有完整 stepLabels 翻译（100+ 步骤类型）
- `step-field-registry.ts` - ⚠️ 字段标签仍有中文硬编码（100+ 字段），但已有基础设施支持

### 构建验证
- `pnpm -s build` - ✅ 成功

### 修复统计
- **翻译文件更新**: 4 个（nav.json, common.json, window.json, group.json）
- **组件国际化**: 8 个文件
  - 阶段1: 4 个（workspace-sidebar, human-intervention-modal, step-error-pause-modal, workspace-layout）
  - 阶段2: 4 个（window-batch-actions-card, window-states-card, groups-page, group-delete-alert-dialog）
- **新增翻译键**: 约 120 个

### 2026-04-04 续：全面国际化修复（已完成）

#### 阶段4：创建缺失的 en-US 翻译文件
创建了以下英文翻译文件，与 zh-CN 保持结构一致：
- `en-US/nav.json` - 导航栏、侧边栏标签
- `en-US/canvas.json` - 画布/流程编辑器
- `en-US/profile.json` - 环境管理（含新增 list.* 键）
- `en-US/settings.json` - 设置页面（含新增 maintenance.*, aiDialog.*, variables.* 键）
- `en-US/automation.json` - 自动化脚本
- `en-US/group.json` - 分组管理
- `en-US/window.json` - 窗口同步
- `en-US/device.json` - 机型预设
- `en-US/plugin.json` - 插件管理
- `en-US/recycle.json` - 回收站
- `en-US/dashboard.json` - 仪表盘
- `en-US/log.json` - 日志面板

#### 阶段5：修复硬编码中文组件
修复了以下文件中的硬编码中文：
- **profile-list-filters.tsx** - 筛选器标签
- **profile-list-page.tsx** - 环境列表页（标题、空状态、停止确认弹窗等）
- **advanced-maintenance-card.tsx** - 高级维护卡片
- **variables-schema-dialog.tsx** - 脚本变量对话框

新增翻译键：
- `profile.json` - list.*（title, emptyNoProfiles, emptyNoMatch, stopAllConfirmTitle, stopAllConfirmDesc, stopping, confirmStop）
- `profile.json` - errors.*（operationFailed, refreshFailed）
- `settings.json` - maintenance.*（title, recycleBin, recycleBinDesc, openRecycleBin）
- `settings.json` - aiDialog.*（编辑/创建AI配置的完整键集）
- `settings.json` - variables.*（脚本变量对话框完整键集）

#### 阶段6：构建验证
- `pnpm -s build` - ✅ 成功
- `cargo check --manifest-path src-tauri/Cargo.toml` - ✅ 成功（17 warnings，无错误）

### 修复统计汇总
- **翻译文件**: 13 个（zh-CN 5 个更新 + en-US 13 个创建/更新）
- **组件国际化**: 12 个文件
- **新增翻译键**: 约 200+ 个
- **构建状态**: ✅ 通过

### 待进行（低优先级）

#### 字段标签国际化
- `step-field-registry.ts` 字段标签硬编码（约100+字段，供canvas属性面板使用）
- 需新增 `automation.stepFields.*` 翻译键并更新注册表使用翻译函数

#### 阶段4：英文翻译同步
- 将本次新增的所有中文翻译键同步到 `en-US/*.json`

---

## 历史会话
