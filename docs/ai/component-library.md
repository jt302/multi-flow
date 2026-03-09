# 组件库规范

本项目默认使用 **shadcn/ui**。
Agent 编写 UI 时，按以下规则执行。

## 1. 使用优先级

1. 先复用现有业务组件
2. 再复用现有通用组件
3. 再直接使用 shadcn/ui
4. 最后才新建封装

---

## 2. 什么时候直接用 shadcn/ui

满足以下条件时可直接使用：

- 只在单处使用
- 结构简单
- 没有业务语义
- 不需要统一行为
- 未来复用概率低

常见可直接使用：

- Button
- Input
- Select
- Dialog
- Tabs
- Tooltip
- DropdownMenu
- Badge
- Sheet

---

## 3. 什么时候需要自己封装

出现以下情况时应封装：

- 相同 UI / 交互重复 2 次以上
- 需要统一样式或文案
- 需要统一 loading / disabled / error 等行为
- 组件已经有明确业务语义
- 希望隔离底层实现，避免页面直接依赖太多 shadcn 细节

适合封装的例子：

- AsyncButton
- ConfirmDialog
- PageHeader
- EmptyState
- SearchInput
- StatusBadge
- FormField
- DataTableToolbar

---

## 4. 什么时候不要封装

以下情况不要封装：

- 只用一次
- 只是简单包一层并透传全部 props
- 没有新增语义、行为、样式约束
- 只是为了“以后可能会用”

不推荐的低价值封装：

- AppButton
- AppInput
- AppDialog

---

## 5. 目录放置规则

- shadcn 原始基础组件：`components/ui`
- 项目通用封装组件：`components/common` 或 `components`
- 业务组件：放到对应 `features/*/components` 或 `pages/*/components`

禁止把业务组件放进 `components/ui`。

---

## 6. 决策规则

新增 UI 时按这个顺序判断：

### Q1：项目里已有同类组件吗？

- 有：直接复用
- 没有：继续

### Q2：这是基础 UI，还是业务组件？

- 基础 UI：优先直接用 shadcn/ui
- 业务组件：优先封装

### Q3：会重复出现吗？

- 会：封装
- 不会：直接使用

### Q4：是否需要统一行为？

- 需要：封装
- 不需要：直接使用

### Q5：封装后是否只是机械透传？

- 是：不要封装
- 否：可以封装

---

## 7. 禁止事项

- 不要引入新的 UI 库，除非明确要求
- 不要把每个 shadcn 组件都再包一层
- 不要在多个页面重复拼同样的 Dialog / Form / EmptyState
- 不要把复杂 UI 细节堆在 page 里
- 不要把业务组件放进 `components/ui`
- 不要为了“看起来高级”过度抽象

---

## 8. 一句话规则

**shadcn/ui 负责基础原语；项目封装组件负责重复模式、统一行为和业务语义。**
