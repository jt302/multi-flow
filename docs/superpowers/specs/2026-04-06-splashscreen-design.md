# Multi-Flow 启动闪屏设计规格

## 背景

App 启动时 Rust 后端需要完成数据库初始化、服务构建、sidecar 启动等重量级操作，期间用户看到白屏。需要一个闪屏窗口提供即时视觉反馈和加载进度。

## 方案概述

在 Rust `setup()` 最早期创建一个独立的小型无装饰 Tauri 窗口，加载内联静态 HTML。后端各初始化阶段通过 `emit()` 推送进度事件，HTML 页面监听并更新 UI。主窗口就绪后关闭闪屏。

## 窗口配置

| 属性 | 值 |
|------|-----|
| 标签 | `splashscreen` |
| 尺寸 | 400 × 280px，固定不可调整 |
| 装饰 | 无（`decorations: false`） |
| 位置 | 屏幕居中（`center: true`） |
| 透明 | `transparent: true` |
| 层级 | `always_on_top: true` |
| 可聚焦 | `true` |
| 跳过任务栏 | `skip_taskbar: true` |

## 视觉设计

- **风格**: 毛玻璃透明
- **背景**: `rgba(15, 23, 42, 0.85)` + `backdrop-filter: blur(20px)`
- **边框**: `1px solid rgba(255, 255, 255, 0.08)`，圆角 `16px`
- **Logo**: 使用现有 `128x128@2x.png`（256px），显示为 64px
- **App 名称**: "Multi-Flow"，使用 Chivo 字体
- **进度文案**: Noto Sans SC，14px，`rgba(255, 255, 255, 0.6)`
- **进度条**: 高度 3px，圆角，背景 `rgba(255, 255, 255, 0.1)`，填充色 `#56d3bc`（teal），带过渡动画
- **布局**: 垂直居中 — Logo → 名称 → 进度文案 → 进度条

## 进度阶段

后端在实际初始化流程的关键节点 emit 进度事件：

| 步骤 ID | 进度 | zh-CN | en-US | 对应代码位置 |
|---------|------|-------|-------|------------|
| `start` | 0% | 正在启动... | Starting... | setup() 入口 |
| `database` | 20% | 正在初始化数据库... | Initializing database... | `db::init_database()` 前 |
| `services` | 45% | 正在加载核心服务... | Loading core services... | `build_app_state()` 服务构建 |
| `proxy` | 65% | 正在启动代理服务... | Starting proxy daemon... | `start_proxy_daemon_sidecar()` 前 |
| `menu` | 80% | 正在配置界面... | Configuring interface... | `setup_native_menu()` 前 |
| `window` | 90% | 正在准备主界面... | Preparing main window... | `build_main_window()` 前 |
| `ready` | 100% | 即将进入... | Almost ready... | 主窗口创建后 |

## 事件通信

### 事件名称

`splashscreen://progress`

### Payload 格式

```json
{
  "step": "database",
  "progress": 20
}
```

进度文案由前端根据 `step` ID 和系统语言自行映射，不由后端传递。

### 前端监听

```js
window.__TAURI__.event.listen('splashscreen://progress', (event) => {
  updateProgress(event.payload.step, event.payload.progress);
});
```

## i18n 策略

闪屏为静态 HTML，不走 React i18n 体系。

- HTML 内嵌双语文案映射表
- 通过 `navigator.language` 检测系统语言
- `zh` 开头匹配中文，其余 fallback 到英文
- 后端 emit 事件只传 `step` ID，不传文案

## 启动流程时序

```
Tauri::Builder::default()
  .setup(|app| {
      // 1. 立即创建闪屏窗口
      create_splashscreen(app);       // emit: start, 0%

      // 2. 初始化日志
      logger::init();

      // 3. 数据库
      emit(progress: database, 20%);
      db::init_database();

      // 4. 构建服务
      emit(progress: services, 45%);
      build_app_state();

      // 5. 代理守护进程
      emit(progress: proxy, 65%);
      start_proxy_daemon_sidecar();

      // 6. 菜单
      emit(progress: menu, 80%);
      setup_native_menu();

      // 7. 主窗口
      emit(progress: window, 90%);
      build_main_window();

      // 8. 完成
      emit(progress: ready, 100%);
      // 短暂延迟(300ms)后关闭闪屏
      close_splashscreen();
  })
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `public/splashscreen.html` | 新增 | 静态 HTML（内联 CSS + JS），Vite 构建时复制到 dist |
| `src-tauri/src/lib.rs` | 修改 | 添加闪屏创建/关闭逻辑 + 各阶段 emit |
| `src-tauri/tauri.conf.json` | 修改 | 添加 splashscreen 窗口定义 |
| `src-tauri/capabilities/default.json` | 修改 | 添加 splashscreen 窗口事件权限 |

## 动画细节

- **进度条**: `transition: width 0.4s ease` 平滑过渡
- **进度文案**: 切换时 `opacity` 渐变（0.3s）
- **闪屏关闭**: 整体 `opacity` 从 1 → 0 过渡（300ms），然后关闭窗口
- **Logo**: 启动时轻微 `scale` 动画（从 0.95 → 1）

## 边界情况

- **启动极快时**: 各阶段可能瞬间完成，进度条通过 CSS transition 依然平滑
- **启动失败时**: 不在闪屏处理错误，Tauri 的默认错误处理会接管
- **多显示器**: `center: true` 会在主显示器居中
- **macOS 透明支持**: Tauri v2 在 macOS 原生支持 `transparent: true`
