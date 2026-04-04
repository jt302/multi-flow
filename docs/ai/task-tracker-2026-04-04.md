# 任务追踪 2026-04-04

## 任务 1：检查工具封装和文档 ✅
- 114 个工具全部有定义 + 实现 + 文档

## 任务 2：修复 AI 配置模型名称输入框 ✅
- 改为 Input + datalist combobox

## 任务 3：修复 CAPTCHA 步骤中文错别字 ✅
- `检浌验证码` → `检测验证码`

## 任务 4：多语言 Agent prompt ✅
- ai_prompts.rs 中英文双版本 + locale 参数

## 任务 5：步骤列表 UI 优化 ✅
- 常用组置顶 + 分组折叠 + 数量 badge

## 任务 6：步骤功能介绍 ✅
- KIND_DESCRIPTIONS 60+ 步骤 + tooltip

## 任务 7：流程编辑操作指南 ✅
- CanvasHelpDialog 6 章节 + 工具栏帮助按钮

## 任务 8：窗口同步页面功能拆分 ✅
- 独立浏览器控制页面 + 完整 3-Tab 功能

## 多语言 i18n 进展

### 已完成
- canvas 命名空间（zh-CN + en-US）150+ 翻译键
- canvas-help-dialog.tsx — 100% i18n
- step-palette.tsx — 100% i18n
- canvas-toolbar.tsx — 100% i18n
- use-canvas-state.ts toast 消息 — 100% i18n
- step-node.tsx — 100% i18n（通过 getKindLabel）
- 133 步骤标签 — zh-CN + en-US automation.json
- getKindLabel() 通用 helper

### 剩余（后续迭代）
- step-properties-panel.tsx — 68 处字段标签
- step-field-registry.ts — 101 处字段定义标签
- 其他页面组件中的零散中文
