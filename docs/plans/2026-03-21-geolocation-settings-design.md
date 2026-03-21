# 自定义地理位置与权限策略设计

## 背景

当前环境高级设置只支持“启用地理位置覆盖 + 手动填写经纬度”，但需求已经升级为：

- 支持地理位置模式：关闭、跟随 IP、自定义
- 支持地理位置权限是否始终允许
- 跟随 IP 时优先使用代理 GEO，缺失时回退本机公网 IP 的 GEO 查询结果

同时，Chromium 文档已经明确支持正式启动参数：

- `--custom-geolocation-latitude`
- `--custom-geolocation-longitude`
- `--custom-geolocation-accuracy`
- `--auto-allow-geolocation`

而当前项目启动链路仍只注入内部参数 `--multi-flow-geolocation`，还没有完整对接到正式参数。

## 目标

在不做无关重构的前提下，为环境高级设置补齐地理位置模式与权限策略，并让启动时真正映射到 Chromium 已支持的正式参数。

## 设计结论

### 1. 数据模型

在现有 `advanced.geolocation` 基础上做增量扩展：

- `advanced.geolocationMode?: 'off' | 'ip' | 'custom'`
- `advanced.autoAllowGeolocation?: boolean`
- `advanced.geolocation?: { latitude: number; longitude: number; accuracy?: number }`

兼容规则：

- 旧环境如果已有 `advanced.geolocation` 且没有 `geolocationMode`，默认视为 `custom`
- 旧环境如果没有 `advanced.geolocation` 且没有 `geolocationMode`，默认视为 `off`
- `autoAllowGeolocation` 缺失时默认 `false`

### 2. 前端交互

将现有“启用地理位置覆盖”改为更明确的模式选择：

- `关闭`
- `跟随 IP`
- `自定义`

额外提供：

- `地理位置权限始终允许` 复选框，默认关闭

交互规则：

- `关闭`：不展示经纬度输入，不清空已有自定义值
- `跟随 IP`：不展示经纬度输入，并显示说明文案
- `自定义`：展示纬度、经度、精度输入，沿用现有范围校验

### 3. 跟随 IP 解析优先级

启动时若 `geolocationMode = 'ip'`，按如下优先级解析：

1. 绑定代理最近一次检测得到的 GEO 结果
2. 本机公网 IP 对应的本地 GeoIP 查询结果
3. 若仍无法解析，则不注入地理位置覆盖，但不阻塞启动

### 4. Chromium 参数映射

- `custom` 或 `ip` 成功解析到坐标后，注入：
  - `--custom-geolocation-latitude`
  - `--custom-geolocation-longitude`
  - `--custom-geolocation-accuracy`
- `autoAllowGeolocation = true` 时注入：
  - `--auto-allow-geolocation`

同时移除旧的内部参数：

- `--multi-flow-geolocation`

## 实现范围

- 前端：
  - `ProfileAdvancedSettings` / 表单 schema / create form / 高级设置 UI
  - 测试补齐模式与 payload 生成
- 后端：
  - `ProfileAdvancedSettings` / `OpenProfileOptions`
  - 启动参数解析与本机公网 IP GEO 回退逻辑
  - 启动参数测试补齐
- 文档：
  - `docs/ai/architecture.md`
  - `docs/ai/current-task.md`

## 风险与处理

- 本机公网 IP 查询依赖外部服务：失败时只记录日志，不阻塞启动
- 旧数据兼容：通过读取默认值解决，不做数据库迁移
- 表单模式切换时避免误清空用户输入：`off` / `ip` 只隐藏字段，不立即删除自定义值
