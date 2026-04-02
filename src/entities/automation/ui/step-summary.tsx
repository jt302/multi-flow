import type { AutomationScript } from '@/entities/automation/model/types';

type Step = AutomationScript['steps'][number];

function selectorDisplay(item: Step) {
  const s = item as Record<string, unknown>;
  const t = s['selector_type'] as string | undefined;
  const selector = String(s['selector'] ?? '');
  if (t && t !== 'css') {
    return (
      <>
        <span className="text-xs text-blue-500 mr-0.5">
          [{t.toUpperCase()}]
        </span>
        {selector}
      </>
    );
  }
  return <>{selector}</>;
}

export function StepSummary({ step }: { step: Step }) {
  switch (step.kind) {
    case 'navigate':
      return <span className="text-muted-foreground">{step.url}</span>;
    case 'wait':
      return <span className="text-muted-foreground">{step.ms}ms</span>;
    case 'click':
      return (
        <span className="text-muted-foreground">{selectorDisplay(step)}</span>
      );
    case 'type':
      return (
        <span className="text-muted-foreground">
          "{step.text}" → {selectorDisplay(step)}
        </span>
      );
    case 'screenshot':
      return <span className="text-muted-foreground">截图</span>;
    case 'magic':
      return <span className="text-muted-foreground">{step.command}</span>;
    case 'cdp':
      return <span className="text-muted-foreground">{step.method}</span>;
    case 'wait_for_user':
      return (
        <span className="text-muted-foreground">
          {step.message.slice(0, 60)}
        </span>
      );
    case 'condition':
      return (
        <span className="text-muted-foreground font-mono text-xs">
          {step.condition_expr.slice(0, 60)}
        </span>
      );
    case 'loop':
      return (
        <span className="text-muted-foreground">
          {step.mode === 'while'
            ? `while ${step.condition_expr ?? ''}`
            : `×${step.count ?? 1}`}
        </span>
      );
    case 'break':
      return <span className="text-muted-foreground">break</span>;
    case 'continue':
      return <span className="text-muted-foreground">continue</span>;
    case 'ai_prompt':
      return (
        <span className="text-muted-foreground">
          {step.prompt.slice(0, 60)}
        </span>
      );
    case 'ai_extract':
      return (
        <span className="text-muted-foreground">
          {step.prompt.slice(0, 60)}
        </span>
      );
    case 'ai_agent':
      return (
        <span className="text-muted-foreground">
          {step.initial_message.slice(0, 60)}
        </span>
      );
    case 'cdp_navigate':
      return <span className="text-muted-foreground">{step.url}</span>;
    case 'cdp_reload':
      return <span className="text-muted-foreground">刷新页面</span>;
    case 'cdp_click':
    case 'cdp_wait_for_selector':
    case 'cdp_get_text':
    case 'cdp_scroll_to':
      return (
        <span className="text-muted-foreground">{selectorDisplay(step)}</span>
      );
    case 'cdp_type':
      return (
        <span className="text-muted-foreground">
          "{step.text}" → {selectorDisplay(step)}
        </span>
      );
    case 'cdp_get_attribute':
      return (
        <span className="text-muted-foreground">
          {selectorDisplay(step)}[{step.attribute}]
        </span>
      );
    case 'cdp_set_input_value':
      return (
        <span className="text-muted-foreground">
          "{step.value}" → {selectorDisplay(step)}
        </span>
      );
    case 'cdp_screenshot':
      return (
        <span className="text-muted-foreground">
          截图{step.output_path ? ` → ${step.output_path}` : '（默认目录）'}
        </span>
      );
    case 'magic_set_bounds':
      return (
        <span className="text-muted-foreground">
          {step.x},{step.y} {step.width}×{step.height}
        </span>
      );
    case 'magic_get_bounds':
      return <span className="text-muted-foreground">获取窗口位置大小</span>;
    case 'magic_set_maximized':
      return <span className="text-muted-foreground">最大化</span>;
    case 'magic_set_minimized':
      return <span className="text-muted-foreground">最小化</span>;
    case 'magic_set_closed':
      return <span className="text-muted-foreground">关闭窗口</span>;
    case 'magic_set_restored':
      return <span className="text-muted-foreground">还原</span>;
    case 'magic_set_fullscreen':
      return <span className="text-muted-foreground">全屏</span>;
    case 'magic_set_bg_color':
      return (
        <span className="text-muted-foreground">
          rgb({step.r ?? 255},{step.g ?? 255},{step.b ?? 255})
        </span>
      );
    case 'magic_set_toolbar_text':
      return <span className="text-muted-foreground">{step.text}</span>;
    case 'magic_set_app_top_most':
      return <span className="text-muted-foreground">激活窗口</span>;
    case 'magic_set_master_indicator_visible':
      return (
        <span className="text-muted-foreground">
          {step.visible ? '显示' : '隐藏'}主控标记
        </span>
      );
    case 'magic_open_new_tab':
      return <span className="text-muted-foreground">{step.url}</span>;
    case 'magic_close_tab':
    case 'magic_activate_tab':
      return (
        <span className="text-muted-foreground">tab_id={step.tab_id}</span>
      );
    case 'magic_activate_tab_by_index':
      return <span className="text-muted-foreground">index={step.index}</span>;
    case 'magic_close_inactive_tabs':
      return <span className="text-muted-foreground">关闭非活动标签页</span>;
    case 'magic_open_new_window':
      return <span className="text-muted-foreground">新建窗口</span>;
    case 'magic_type_string':
      return (
        <span className="text-muted-foreground">
          "{step.text.slice(0, 40)}"
        </span>
      );
    case 'magic_capture_app_shell':
      return (
        <span className="text-muted-foreground truncate max-w-48">
          {step.output_path || '默认路径'}
        </span>
      );
    case 'magic_get_browsers':
      return <span className="text-muted-foreground">所有浏览器</span>;
    case 'magic_get_active_browser':
      return <span className="text-muted-foreground">活动浏览器</span>;
    case 'magic_get_tabs':
      return (
        <span className="text-muted-foreground">
          browser_id={step.browser_id}
        </span>
      );
    case 'magic_get_active_tabs':
      return <span className="text-muted-foreground">活动标签页</span>;
    case 'magic_get_switches':
      return (
        <span className="text-muted-foreground font-mono">{step.key}</span>
      );
    case 'magic_get_host_name':
      return <span className="text-muted-foreground">主机名</span>;
    case 'magic_get_mac_address':
      return <span className="text-muted-foreground">MAC地址</span>;
    case 'magic_get_bookmarks':
      return <span className="text-muted-foreground">书签树</span>;
    case 'magic_create_bookmark':
      return (
        <span className="text-muted-foreground">
          {step.title} → {step.url.slice(0, 40)}
        </span>
      );
    case 'magic_create_bookmark_folder':
      return <span className="text-muted-foreground">{step.title}</span>;
    case 'magic_update_bookmark':
    case 'magic_remove_bookmark':
    case 'magic_move_bookmark':
      return (
        <span className="text-muted-foreground font-mono">
          node_id={step.node_id}
        </span>
      );
    case 'magic_bookmark_current_tab':
      return <span className="text-muted-foreground">收藏当前标签</span>;
    case 'magic_unbookmark_current_tab':
      return <span className="text-muted-foreground">取消收藏当前标签</span>;
    case 'magic_is_current_tab_bookmarked':
      return <span className="text-muted-foreground">查询收藏状态</span>;
    case 'magic_export_bookmark_state':
      return <span className="text-muted-foreground">导出书签</span>;
    case 'magic_get_managed_cookies':
      return <span className="text-muted-foreground">托管Cookie</span>;
    case 'magic_export_cookie_state':
      return <span className="text-muted-foreground">{step.mode}</span>;
    case 'magic_get_managed_extensions':
      return <span className="text-muted-foreground">托管扩展</span>;
    case 'magic_trigger_extension_action':
      return (
        <span className="text-muted-foreground font-mono">
          {step.extension_id.slice(0, 16)}...
        </span>
      );
    case 'magic_close_extension_popup':
      return <span className="text-muted-foreground">关闭扩展Popup</span>;
    case 'magic_toggle_sync_mode':
      return <span className="text-muted-foreground">{step.role}</span>;
    case 'magic_get_sync_mode':
      return <span className="text-muted-foreground">同步状态</span>;
    case 'magic_get_is_master':
      return <span className="text-muted-foreground">是否主控</span>;
    case 'magic_get_sync_status':
      return <span className="text-muted-foreground">完整同步状态</span>;
    default:
      return null;
  }
}

/**
 * 返回步骤的纯文本摘要（非 React 上下文使用，如 tooltip、日志）
 */
export function getStepSummaryText(step: Step): string {
  const s = step as Record<string, unknown>;
  const selector = String(s['selector'] ?? '');

  switch (step.kind) {
    case 'navigate':
      return step.url;
    case 'wait':
      return `${step.ms}ms`;
    case 'click':
      return selector;
    case 'type':
      return `"${step.text}" → ${selector}`;
    case 'screenshot':
      return '截图';
    case 'magic':
      return step.command;
    case 'cdp':
      return step.method;
    case 'wait_for_user':
      return step.message.slice(0, 60);
    case 'condition':
      return step.condition_expr.slice(0, 60);
    case 'loop':
      return step.mode === 'while'
        ? `while ${step.condition_expr ?? ''}`
        : `×${step.count ?? 1}`;
    case 'break':
      return 'break';
    case 'continue':
      return 'continue';
    case 'ai_prompt':
      return step.prompt.slice(0, 60);
    case 'ai_extract':
      return step.prompt.slice(0, 60);
    case 'ai_agent':
      return step.initial_message.slice(0, 60);
    case 'cdp_navigate':
      return step.url;
    case 'cdp_reload':
      return '刷新页面';
    case 'cdp_click':
    case 'cdp_wait_for_selector':
    case 'cdp_get_text':
    case 'cdp_scroll_to':
      return selector;
    case 'cdp_type':
      return `"${step.text}" → ${selector}`;
    case 'cdp_get_attribute':
      return `${selector}[${step.attribute}]`;
    case 'cdp_set_input_value':
      return `"${step.value}" → ${selector}`;
    case 'cdp_screenshot':
      return step.output_path ? `截图 → ${step.output_path}` : '截图（默认目录）';
    case 'magic_set_bounds':
      return `${step.x},${step.y} ${step.width}×${step.height}`;
    case 'magic_get_bounds':
      return '获取窗口位置大小';
    case 'magic_set_maximized':
      return '最大化';
    case 'magic_set_minimized':
      return '最小化';
    case 'magic_set_closed':
      return '关闭窗口';
    case 'magic_set_restored':
      return '还原';
    case 'magic_set_fullscreen':
      return '全屏';
    case 'magic_set_bg_color':
      return `rgb(${step.r ?? 255},${step.g ?? 255},${step.b ?? 255})`;
    case 'magic_set_toolbar_text':
      return step.text;
    case 'magic_set_app_top_most':
      return '激活窗口';
    case 'magic_set_master_indicator_visible':
      return step.visible ? '显示主控标记' : '隐藏主控标记';
    case 'magic_open_new_tab':
      return step.url;
    case 'magic_close_tab':
    case 'magic_activate_tab':
      return `tab_id=${step.tab_id}`;
    case 'magic_activate_tab_by_index':
      return `index=${step.index}`;
    case 'magic_close_inactive_tabs':
      return '关闭非活动标签页';
    case 'magic_open_new_window':
      return '新建窗口';
    case 'magic_type_string':
      return `"${step.text.slice(0, 40)}"`;
    case 'magic_capture_app_shell':
      return step.output_path || '默认路径';
    case 'magic_get_browsers':
      return '所有浏览器';
    case 'magic_get_active_browser':
      return '活动浏览器';
    case 'magic_get_tabs':
      return `browser_id=${step.browser_id}`;
    case 'magic_get_active_tabs':
      return '活动标签页';
    case 'magic_get_switches':
      return step.key;
    case 'magic_get_host_name':
      return '主机名';
    case 'magic_get_mac_address':
      return 'MAC地址';
    case 'magic_get_bookmarks':
      return '书签树';
    case 'magic_create_bookmark':
      return `${step.title} → ${step.url.slice(0, 40)}`;
    case 'magic_create_bookmark_folder':
      return step.title;
    case 'magic_update_bookmark':
    case 'magic_remove_bookmark':
    case 'magic_move_bookmark':
      return `node_id=${step.node_id}`;
    case 'magic_bookmark_current_tab':
      return '收藏当前标签';
    case 'magic_unbookmark_current_tab':
      return '取消收藏当前标签';
    case 'magic_is_current_tab_bookmarked':
      return '查询收藏状态';
    case 'magic_export_bookmark_state':
      return '导出书签';
    case 'magic_get_managed_cookies':
      return '托管Cookie';
    case 'magic_export_cookie_state':
      return step.mode;
    case 'magic_get_managed_extensions':
      return '托管扩展';
    case 'magic_trigger_extension_action':
      return `${step.extension_id.slice(0, 16)}...`;
    case 'magic_close_extension_popup':
      return '关闭扩展Popup';
    case 'magic_toggle_sync_mode':
      return step.role;
    case 'magic_get_sync_mode':
      return '同步状态';
    case 'magic_get_is_master':
      return '是否主控';
    case 'magic_get_sync_status':
      return '完整同步状态';
    default:
      return '';
  }
}
