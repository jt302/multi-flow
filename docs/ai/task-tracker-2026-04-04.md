# 任务追踪 2026-04-04

## 任务 1：检查工具封装和文档 ✅
- 114 个工具全部有定义 + 实现 + 文档，参数匹配
- agent docs 和 developer docs 已覆盖全部工具
- roadmap 30 个新工具为后续迭代

## 任务 2：修复 AI 配置模型名称输入框 ✅
- 移除 Select + Input 双控件冲突
- 改为 Input + datalist 原生 combobox，可自由输入且有建议列表

## 任务 3：修复 CAPTCHA 步骤中文错别字 ✅
- `检浌验证码` → `检测验证码`

## 任务 4：多语言支持（Agent prompt） ✅
- ai_prompts.rs 已重构为中英文双版本常量
- build_agent_system_prompt / judge_*_prompt 接受 locale 参数
- 前端 AI config 的 locale 字段（zh/en）直接传递

## 任务 5：步骤列表 UI 优化 ✅
- 新增"常用"置顶分组（8 个高频步骤）
- 所有分组默认折叠，点击展开，搜索时自动展开匹配组
- 组名旁显示步骤数量 badge

## 任务 6：步骤功能介绍和参数说明 ✅
- 新增 KIND_DESCRIPTIONS 覆盖 60+ 步骤的功能说明
- step-palette 按钮添加 title tooltip

## 任务 7：流程编辑操作指南 ✅
- 新建 canvas-help-dialog.tsx，6 个章节覆盖全部操作
- 工具栏添加帮助按钮（? 图标）

## 任务 8：窗口同步页面功能拆分 ✅
- 新增 NavId 'browser-control'，路由 /browser-control
- 新增主导航入口（浏览器控制 + AppWindow 图标）
- 创建独立页面，3 个 Tab：窗口管理/标签页管理/文本输入
- 当前显示迁移占位，完整内容提取为后续迭代
