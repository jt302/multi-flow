## 关于 chromium

## Multi-Flow 当前接入约定（2026-03-08）

- 浏览器资源版本与指纹版本已统一为同一个字段：`browserVersion`
  - 该字段同时决定运行内核版本和对外暴露的浏览器版本
- 宿主资源平台与模拟平台已拆开：
  - 宿主资源平台由当前系统自动推导，仅用于匹配和下载可执行文件
  - 模拟平台由环境配置决定，可跨宿主系统模拟 `macos/windows/linux/android/ios`
- 环境保存时会持久化：
  - `fingerprintSource`
  - `fingerprintSnapshot`
- 启动时如果当前宿主系统缺少指定 `browserVersion`：
  - 自动下载并安装该版本
  - 安装完成后继续当前启动流程
  - 不切换全局 active Chromium
- 若当前宿主系统没有该版本构建，直接报错，不降级到其它版本

## Multi-Flow 当前注入的关键强关联参数

- `--fingerprint-seed`
- `--custom-platform`
- `--custom-ua-metadata`
- `--custom-gl-vendor`
- `--custom-gl-renderer`
- `--custom-cpu-cores`
- `--custom-ram-gb`
- `--custom-font-list`
- `--window-size`
- `--force-device-scale-factor`
- 移动端：
  - `--custom-touch-points`
  - `--use-mobile-user-agent`
  - `--touch-events=enabled`

## 代理与语言 / 时区联动（2026-03-10）

- 绑定代理后，Chromium 启动时语言 / 时区优先级为：
  - Profile 显式配置
  - 代理 `effectiveLanguage / effectiveTimezone`
  - 若代理未产出生效值，再回退旧的国家码默认映射
- 代理内部同时维护两类字段：
  - `suggestedLanguage / suggestedTimezone`：代理出口 IP + 本地 GeoIP 推导出的建议值
  - `effectiveLanguage / effectiveTimezone`：结合来源配置 (`ip/custom`) 后的最终生效值
- 对 Chromium 的实际注入保持不变，只切换取值来源：
  - `--lang`
  - `TZ`
  - `--custom-main-language`
  - `--custom-time-zone`
- 地理位置仍沿用最近一次代理检测得到的经纬度；本轮未新增代理级 geolocation 自定义模式

## 指纹模板目录（当前默认 seed 到数据库）

- 桌面：
  - `macos_macbook_pro_14`
  - `windows_11_desktop`
  - `linux_ubuntu_desktop`
- 移动：
  - `android_pixel_8`
  - `android_s24_ultra`
  - `ios_iphone_15_pro`
  - `ios_iphone_15_pro_max`
  - `ios_ipad_air`

这些预设负责成套生成以下字段，避免参数组合怪异：

- UserAgent
- UA metadata
- 平台参数
- GL vendor / renderer
- CPU / RAM
- touch points
- 字体列表
- 窗口尺寸 / DPR

当前实现说明：

- `fingerprint_catalog` 仍保存默认模板定义
- 应用启动后会由 `device_preset_service` 将默认模板 seed 到 `device_presets` 表
- 环境创建、环境展示、预览和启动时，统一读取数据库中的设备预设

chromium 中的 magic_controller 模块

1. magic_http_handler
   1. 通过启动参数指定的端口启动一个http服务器 监听外部指令并执行

   2. ```c++
      #pragma once

      #include "base/functional/callback.h"
      #include "base/no_destructor.h"
      #include "base/values.h"
      #include "net/server/http_server_request_info.h"


      MagicHttpHandler::RouterMap& MagicHttpHandler::GetRouter() {
        static base::NoDestructor<RouterMap> router(RouterMap({
            {"set_bg_color", &MagicHttpHandler::HandleSetBgColor},
            {"set_toolbar_text", &MagicHttpHandler::HandleSetToolbarText},
            {"set_master_indicator_visible",
             &MagicHttpHandler::HandleSetMasterIndicatorVisible},
            {"set_app_top_most", &MagicHttpHandler::HandleSetAppTopMost},
            {"get_switches", &MagicHttpHandler::HandleGetSwitches},
            {"set_bounds", &MagicHttpHandler::HandleSetBounds},
            {"get_bounds", &MagicHttpHandler::HandleGetBounds},
            {"set_maximized", &MagicHttpHandler::HandleSetMaximized},
            {"get_maximized", &MagicHttpHandler::HandleGetMaximized},
            {"set_minimized", &MagicHttpHandler::HandleSetMinimized},
            {"get_minimized", &MagicHttpHandler::HandleGetMinimized},
            {"set_closed", &MagicHttpHandler::HandleSetClosed},
            {"set_restored", &MagicHttpHandler::HandleSetRestored},
            {"set_fullscreen", &MagicHttpHandler::HandleSetFullscreen},
            {"get_fullscreen", &MagicHttpHandler::HandleGetFullscreen},
            {"get_browsers", &MagicHttpHandler::HandleGetBrowsers},
            {"get_browser", &MagicHttpHandler::HandleGetBrowser},
            {"get_tabs", &MagicHttpHandler::HandleGetTabs},
            {"get_active_browser", &MagicHttpHandler::HandleGetActiveBrowser},
            {"get_active_tabs", &MagicHttpHandler::HandleGetActiveTabs},
            {"close_inactive_tabs", &MagicHttpHandler::HandleCloseInactiveTabs},
            {"close_tab", &MagicHttpHandler::HandleCloseTab},
            {"open_new_window", &MagicHttpHandler::HandleOpenNewWindow},
            {"open_new_tab", &MagicHttpHandler::HandleOpenNewTab},
            {"activate_tab", &MagicHttpHandler::HandleActivateTab},
            {"activate_tab_by_index", &MagicHttpHandler::HandleActivateTabByIndex},
            {"type_string", &MagicHttpHandler::HandleTypeString},
            {"toggle_sync_mode", &MagicHttpHandler::HandleToggleSyncMode},
            {"get_is_master", &MagicHttpHandler::HandleGetIsMaster},
            {"get_sync_mode", &MagicHttpHandler::HandleGetSyncMode},
        }));
        return *router;
      }

      class MagicHttpHandler {
       public:
        MagicHttpHandler() = delete;
        ~MagicHttpHandler() = delete;

        using ReplyCallback = base::OnceCallback<void(base::Value::Dict)>;
        using HandlerFunc = void (*)(base::Value::Dict, ReplyCallback);

        static void ProcessCommand(std::string path,
                                   std::string method,
                                   std::string data,
                                   ReplyCallback callback);

       private:
        using RouterMap = base::flat_map<std::string_view, HandlerFunc>;
        static RouterMap& GetRouter();

        // 处理设置背景色
        static void HandleSetBgColor(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"set_bg_color",
        //  "r":255,
        //  "g":255,
        //  "b":255
        // }

        // 处理设置主控提示标签可见性
        static void HandleSetMasterIndicatorVisible(base::Value::Dict dict,
                                                    ReplyCallback callback);
        // {
        //  "cmd":"set_master_indicator_visible",
        //  "text": "username",
        //  "visible": false
        // }

        // 处理设置工具栏文本
        static void HandleSetToolbarText(base::Value::Dict dict,
                                         ReplyCallback callback);
        // {
        //  "cmd":"set_toolbar_text",
        //  "text": "username"
        // }

        // 处理设置应用置顶
        static void HandleSetAppTopMost(base::Value::Dict dict,
                                        ReplyCallback callback);
        // {
        //  "cmd":"set_app_top_most",
        // }

        // 获取应用参数
        static void HandleGetSwitches(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"get_switches",
        //  "key": "user-agent"
        // }
        // response {key:value}

        // 处理设置窗口位置和大小
        static void HandleSetBounds(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"set_bounds",
        //  "x": 800,
        //  "y": 500,
        //  "width": 800,
        //  "height": 500
        // }


        // 获取窗口位置和大小
        static void HandleGetBounds(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"get_bounds",
        // }
        // responses {status:"ok",x:x,y:y,width:width,height:height}

        // 处理设置窗口最大化
        static void HandleSetMaximized(base::Value::Dict dict,
                                       ReplyCallback callback);
        // {
        //  "cmd":"set_maximized",
        // }


        // 获取窗口最大化
        static void HandleGetMaximized(base::Value::Dict dict,
                                       ReplyCallback callback);
        // {
        //  "cmd":"get_maximized",
        // }
        // response {
        //  "data": false,
        //  "status": "ok"
      	// }

        // 处理设置窗口最小化
        static void HandleSetMinimized(base::Value::Dict dict,
                                       ReplyCallback callback);
        // {
        //  "cmd":"set_minimized",
        // }

        // 获取窗口最小化
        static void HandleGetMinimized(base::Value::Dict dict,
                                       ReplyCallback callback);
        // {
        //  "cmd":"get_minimized",
        // }
        // response {
        //  "data": true,
        //  "status": "ok"
      	// }

        // 处理设置窗口关闭
        static void HandleSetClosed(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"set_closed",
        // }

        // 处理设置窗口恢复
        static void HandleSetRestored(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"set_restored",
        // }

        // 处理设置窗口全屏
        static void HandleSetFullscreen(base::Value::Dict dict,
                                        ReplyCallback callback);
        // {
        //  "cmd":"set_fullscreen",
        // }

        // 获取窗口全屏
        static void HandleGetFullscreen(base::Value::Dict dict,
                                        ReplyCallback callback);
        // {
        //  "cmd":"get_fullscreen",
        // }
        // response {
        //  "data": true,
        //  "status": "ok"
      	// }

        // 获取所有窗口信息
        static void HandleGetBrowsers(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"get_browsers",
        // }
        // response
        // {
        // 	"data": [
        // 		{
        // 			"bounds": {
        // 				"height": 1201,
        // 				"width": 1541,
        // 				"x": -2498,
        // 				"y": 94
        // 			},
        // 			"browser_info": {
        // 				"app_name": "",
        // 				"profile_name": "",
        // 				"profile_path": "/Users/tt/Library/Application Support/Chromium/Default",
        // 				"user_title": ""
        // 			},
        // 			"fullscreen": false,
        // 			"id": 1476302119,
        // 			"isActive": false,
        // 			"maximized": false,
        // 			"minimized": false,
        // 			"tab_count": 6,
        // 			"tabs": [
        // 				{
        // 					"id": 1476302120,
        // 					"is_active": true,
        // 					"loading": false,
        // 					"title": "最佳 BrowserScan 指纹检测工具 - 提高您的在线隐私安全 | BrowserScan",
        // 					"url": "https://www.browserscan.net/zh#google_vignette"
        // 				},
        // 				{
        // 					"id": 1476302121,
        // 					"is_active": false,
        // 					"loading": false,
        // 					"title": "实用工具-IP查询,机器人检测,WebRTC泄漏测试,DNS泄漏测试,HTTP2指纹,端口扫描,Cookie转换,UserAgent解析 | BrowserScan",
        // 					"url": "https://www.browserscan.net/zh/tools"
        // 				},
        // 				{
        // 					"id": 1476302122,
        // 					"is_active": false,
        // 					"loading": false,
        // 					"title": "Canvas Fingerprinting - BrowserLeaks",
        // 					"url": "https://browserleaks.com/canvas"
        // 				},
        // 				{
        // 					"id": 1476302123,
        // 					"is_active": false,
        // 					"loading": false,
        // 					"title": "Best of Product Hunt: February 25, 2026 | Product Hunt",
        // 					"url": "https://www.producthunt.com/leaderboard/daily/2026/2/25?ref=header_nav"
        // 				},
        // 				{
        // 					"id": 1476302124,
        // 					"is_active": false,
        // 					"loading": false,
        // 					"title": "设置 - 外观",
        // 					"url": "chrome://settings/appearance"
        // 				},
        // 				{
        // 					"id": 1476302125,
        // 					"is_active": false,
        // 					"loading": false,
        // 					"title": "Google Maps",
        // 					"url": "https://www.google.com/maps/@30.2444444,119.6928109,14z?entry=ttu&g_ep=EgoyMDI2MDMwMi4wIKXMDSoASAFQAw%3D%3D"
        // 				}
        // 			],
        // 			"type": 0
        // 		},
        // 		{
        // 			"bounds": {
        // 				"height": 1201,
        // 				"width": 1541,
        // 				"x": -2476,
        // 				"y": 116
        // 			},
        // 			"browser_info": {
        // 				"app_name": "",
        // 				"profile_name": "",
        // 				"profile_path": "/Users/tt/Library/Application Support/Chromium/Default",
        // 				"user_title": ""
        // 			},
        // 			"fullscreen": false,
        // 			"id": 1476302199,
        // 			"isActive": true,
        // 			"maximized": false,
        // 			"minimized": false,
        // 			"tab_count": 1,
        // 			"tabs": [
        // 				{
        // 					"id": 1476302200,
        // 					"is_active": true,
        // 					"loading": false,
        // 					"title": "新标签页",
        // 					"url": "chrome://newtab/"
        // 				}
        // 			],
        // 			"type": 0
        // 		}
        // 	],
        // 	"status": "ok"
        // }

        // 根据browser_id获取窗口信息
        static void HandleGetBrowser(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"get_browser",
        //  "browser_id": 1476302200
        // }
        // response
        // {
        // 	"data": {
        // 		"bounds": {
        // 			"height": 1201,
        // 			"width": 1541,
        // 			"x": -2498,
        // 			"y": 94
        // 		},
        // 		"browser_info": {
        // 			"app_name": "",
        // 			"profile_name": "",
        // 			"profile_path": "/Users/tt/Library/Application Support/Chromium/Default",
        // 			"user_title": ""
        // 		},
        // 		"fullscreen": false,
        // 		"id": 1476302119,
        // 		"isActive": false,
        // 		"maximized": false,
        // 		"minimized": false,
        // 		"tab_count": 6,
        // 		"tabs": [
        // 			{
        // 				"id": 1476302120,
        // 				"is_active": true,
        // 				"loading": false,
        // 				"title": "最佳 BrowserScan 指纹检测工具 - 提高您的在线隐私安全 | BrowserScan",
        // 				"url": "https://www.browserscan.net/zh#google_vignette"
        // 			},
        // 			{
        // 				"id": 1476302121,
        // 				"is_active": false,
        // 				"loading": false,
        // 				"title": "实用工具-IP查询,机器人检测,WebRTC泄漏测试,DNS泄漏测试,HTTP2指纹,端口扫描,Cookie转换,UserAgent解析 | BrowserScan",
        // 				"url": "https://www.browserscan.net/zh/tools"
        // 			},
        // 			{
        // 				"id": 1476302122,
        // 				"is_active": false,
        // 				"loading": false,
        // 				"title": "Canvas Fingerprinting - BrowserLeaks",
        // 				"url": "https://browserleaks.com/canvas"
        // 			},
        // 			{
        // 				"id": 1476302123,
        // 				"is_active": false,
        // 				"loading": false,
        // 				"title": "Best of Product Hunt: February 25, 2026 | Product Hunt",
        // 				"url": "https://www.producthunt.com/leaderboard/daily/2026/2/25?ref=header_nav"
        // 			},
        // 			{
        // 				"id": 1476302124,
        // 				"is_active": false,
        // 				"loading": false,
        // 				"title": "设置 - 外观",
        // 				"url": "chrome://settings/appearance"
        // 			},
        // 			{
        // 				"id": 1476302125,
        // 				"is_active": false,
        // 				"loading": false,
        // 				"title": "Google Maps",
        // 				"url": "https://www.google.com/maps/@30.2444444,119.6928109,14z?entry=ttu&g_ep=EgoyMDI2MDMwMi4wIKXMDSoASAFQAw%3D%3D"
        // 			}
        // 		],
        // 		"type": 0
        // 	},
        // 	"status": "ok"
        // }

        // 根据browser_id获取窗口标签页
        static void HandleGetTabs(base::Value::Dict dict, ReplyCallback callback);
      	// {
        //  "cmd":"get_tabs",
        //  "browser_id": 1476302119
        // }
        // response
        // {
        // 	"data": [
        // 		{
        // 			"id": 1476302120,
        // 			"is_active": true,
        // 			"loading": false,
        // 			"title": "最佳 BrowserScan 指纹检测工具 - 提高您的在线隐私安全 | BrowserScan",
        // 			"url": "https://www.browserscan.net/zh#google_vignette"
        // 		},
        // 		{
        // 			"id": 1476302121,
        // 			"is_active": false,
        // 			"loading": false,
        // 			"title": "实用工具-IP查询,机器人检测,WebRTC泄漏测试,DNS泄漏测试,HTTP2指纹,端口扫描,Cookie转换,UserAgent解析 | BrowserScan",
        // 			"url": "https://www.browserscan.net/zh/tools"
        // 		}
        // 	],
        // 	"status": "ok"
        // }

        // 获取当前活动窗口信息
        static void HandleGetActiveBrowser(base::Value::Dict dict,
                                           ReplyCallback callback);
        // {
        //  "cmd":"get_active_browser",
        // }
        // response
        // {
        // 	"data": {
        // 		"bounds": {
        // 			"height": 1201,
        // 			"width": 1541,
        // 			"x": -2560,
        // 			"y": 166
        // 		},
        // 		"browser_info": {
        // 			"app_name": "",
        // 			"profile_name": "",
        // 			"profile_path": "/Users/tt/Library/Application Support/Chromium/Default",
        // 			"user_title": ""
        // 		},
        // 		"fullscreen": false,
        // 		"id": 1476302199,
        // 		"isActive": true,
        // 		"maximized": false,
        // 		"minimized": false,
        // 		"tab_count": 1,
        // 		"tabs": [
        // 			{
        // 				"id": 1476302200,
        // 				"is_active": true,
        // 				"loading": false,
        // 				"title": "新标签页",
        // 				"url": "chrome://newtab/"
        // 			}
        // 		],
        // 		"type": 0
        // 	},
        // 	"status": "ok"
        // }

        // 获取当前活动窗口标签页
        static void HandleGetActiveTabs(base::Value::Dict dict,
                                        ReplyCallback callback);
        // {
        //  "cmd":"get_active_tabs",
        // }
        // response
        // {
        // 	"data": [
        // 		{
        // 			"id": 1476302200,
        // 			"is_active": true,
        // 			"loading": false,
        // 			"title": "新标签页",
        // 			"url": "chrome://newtab/"
        // 		}
        // 	],
        // 	"status": "ok"
        // }

        // 关闭所有非活动标签页
        static void HandleCloseInactiveTabs(base::Value::Dict dict,
                                            ReplyCallback callback);
        // {
        //  "cmd":"close_inactive_tabs",
        // }

        // 根据tab_id关闭指定标签页
        static void HandleCloseTab(base::Value::Dict dict, ReplyCallback callback);
      	// {
        //  "cmd":"close_tab",
        //  "tab_id": 1476302200
        // }

        // 打开新窗口
        static void HandleOpenNewWindow(base::Value::Dict dict,
                                        ReplyCallback callback);
        // {
        //  "cmd":"open_new_window",
        // }

        // 如果传入了browser_id 则在指定id browser 打开新标签页 否则当前active browser打开
        static void HandleOpenNewTab(base::Value::Dict dict, ReplyCallback callback);
      	// {
        //  "cmd":"open_new_tab",
        //  "url": "https://google.com"
        // }
        // response
        // {
        // 	"data": {
        // 		"loading": true,
        // 		"tab_id": 1476302201,
        // 		"title": "",
        // 		"url": "https://google.com/"
        // 	},
        // 	"status": "ok"
        // }

        // 根据tab_id激活指定标签页
        static void HandleActivateTab(base::Value::Dict dict, ReplyCallback callback);
      	// {
        //  "cmd":"activate_tab",
        //  "tab_id": 1476302201
        // }

        // 根据标签页索引激活指定标签页
        static void HandleActivateTabByIndex(base::Value::Dict dict,
                                             ReplyCallback callback);
        // {
        //  "cmd":"activate_tab_by_index",
        //  "index": 0
        // }

        // 在指定标签页中输入字符串 需要有输入焦点
        static void HandleTypeString(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"type_string",
        //  "tab_id": 1476302201,
        //  "text": "search string"
        // }

        // 开启/关闭同步模式
        static void HandleToggleSyncMode(base::Value::Dict dict,
                                         ReplyCallback callback);
        // {
        //  "cmd":"toggle_sync_mode",
        //  "sync_mode": true
        // }

        // 获取同步模式
        static void HandleGetSyncMode(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"get_sync_mode",
        // }
        // response
        // {
        //  "data": false,
        //  "status": "ok"
      	// }

        // 获取是否为主控
        static void HandleGetIsMaster(base::Value::Dict dict, ReplyCallback callback);
        // {
        //  "cmd":"get_is_master",
        // }
        // response
        // {
        //  "data": false,
        //  "status": "ok"
      	// }
      };

      ```

目前正在开发中 后续还会陆续添加更多功能

### 启动参数

1. --user-agent
   1. 格式：Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36

2. --custom-ua-metadata
   1. 自定义 Sec-CH-UA 参数
   2. 格式：platform=Windows|platform_version=13.0.0|arch=x86|bitness=64|mobile=0|brands=Google Chrome:144,Chromium:144|form_factors=Desktop

3. --custom-cpu-cores
   1. 自定义cpu核心数量

4. --custom-ram-gb
   1. 自定义内存大小单位GB

5. --custom-gl-vendor
   1. 自定义 GL 供应商
   2. 格式：NVIDIA

6. --custom-gl-renderer
   1. 自定义 GL 渲染器
   2. 格式：NVIDIA GeForce RTX 4090

7. --custom-touch-points
   1. 自定义触摸点数

8. --custom-platform
   1. 自定义平台

   2. Linux armv81,MacIntel,Win32,Linux x86_64,Iphone

   3. ```c++
      String GetReducedNavigatorPlatform() {
      #if BUILDFLAG(IS_ANDROID)
        return "Linux armv81";
      #elif BUILDFLAG(IS_MAC)
        return "MacIntel";
      #elif BUILDFLAG(IS_WIN)
        return "Win32";
      #elif BUILDFLAG(IS_FUCHSIA)
        return "";
      #elif BUILDFLAG(IS_LINUX) || BUILDFLAG(IS_CHROMEOS)
        return "Linux x86_64";
      #elif BUILDFLAG(IS_IOS)
        return "iPhone";
      #else
      #error Unsupported platform
      #endif
      }
      ```

9. --webrtc-ip-override
   1. 自定义 WebRTC IP 覆盖

10. --fingerprint-seed
    1. 格式：178172

11. --custom-font-list
    1. Arial,Verdana,Tahoma,Microsoft YaHei

12. --toolbar-text
    1. 地址栏和刷新按钮中间的区域可以显示自定义文字(工具栏文本) 以标识不同浏览器实例

13. --magic-socket-server-port
    1. 浏览器内部用于接收命令的socket 和 http 服务器端口 上面的修改或获取信息的接口就是从这里进入

14. --custom-main-language
    1. 自定义主语言

15. custom-languages
    1. 自定义语言

16. --custom-accept-languages
    1. 自定义接受语言

17. --custom-time-zone
    1. 自定义时区

### 当前项目默认映射（2026-03-08）

- `android` 平台：
  - `--custom-platform=Linux armv81`
  - `--custom-touch-points=5`
  - `--custom-ua-metadata=platform=Android|platform_version=14.0.0|arch=arm|bitness=64|mobile=1|brands=Google Chrome:<major>,Chromium:<major>|form_factors=Mobile`
  - 官方 Chromium 额外附加：`--use-mobile-user-agent`
- `ios` 平台：
  - `--custom-platform=iPhone`
  - `--custom-touch-points=5`
  - `--custom-ua-metadata=platform=iOS|platform_version=17.0.0|arch=arm|bitness=64|mobile=1|brands=Google Chrome:<major>,Chromium:<major>|form_factors=Mobile`
  - 官方 Chromium 额外附加：`--use-mobile-user-agent`
- 设备预设层：
  - `android_pixel_8`
  - `android_s24_ultra`
  - `ios_iphone_15_pro`
  - `ios_iphone_15_pro_max`
  - `ios_ipad_air`
- 若选择设备预设，额外自动注入：
  - `--window-size=<width>,<height>`
  - `--force-device-scale-factor=<dpr>`
  - `--touch-events=enabled`
  - 若未自定义 UA，则使用预设 UA
  - 若未自定义字体列表，则使用对应移动平台字体集
- 字体列表：
  - `android` 默认返回 Android 风格字体集（`Roboto` / `Noto Sans` / `Noto Sans CJK` / `Noto Color Emoji` 等）
  - `ios` 默认返回 iOS 风格字体集（`Helvetica Neue` / `PingFang` / `Hiragino Sans` / `Apple Color Emoji` 等）
- 说明：
  - 平台参数负责大类行为（platform / touch points / mobile metadata）
  - 设备预设负责更细粒度的窗口尺寸、DPR、具体 UA

这些参数是强关联的 随机生成时需要查看所有参数是否匹配

**user-agent**

**custom-cpu-cores**

**custom-ram-gb**

**custom-gl-vendor**

**custom-gl-renderer**

**custom-platform**

**custom-ua-metadata** 由以上参数随机生成

**custom-touch-points** 根据 platform

比如 --user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36
metadata中也要对应

custom-platform不能是MacIntel

gl-vendor 不能是 ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)

custom-touch-points 就不用传

custom-gl-vendor和custom-gl-renderer需要匹配

等等...
