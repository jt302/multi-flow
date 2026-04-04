import i18next from 'i18next';
import { useTranslation } from 'react-i18next';

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
	const { t } = useTranslation('automation');
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
			return (
				<span className="text-muted-foreground">{t('steps.screenshot')}</span>
			);
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
		case 'ai_agent':
			return (
				<span className="text-muted-foreground">
					{step.prompt.slice(0, 60)}
				</span>
			);
		case 'cdp_navigate':
			return <span className="text-muted-foreground">{step.url}</span>;
		case 'cdp_reload':
			return (
				<span className="text-muted-foreground">{t('steps.reloadPage')}</span>
			);
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
					{t('steps.screenshot')}
					{step.output_path ? ` → ${step.output_path}` : t('steps.defaultDir')}
				</span>
			);
		case 'magic_set_bounds':
			return (
				<span className="text-muted-foreground">
					{step.x},{step.y} {step.width}×{step.height}
				</span>
			);
		case 'magic_get_bounds':
			return (
				<span className="text-muted-foreground">{t('steps.getBounds')}</span>
			);
		case 'magic_set_maximized':
			return (
				<span className="text-muted-foreground">{t('steps.maximize')}</span>
			);
		case 'magic_set_minimized':
			return (
				<span className="text-muted-foreground">{t('steps.minimize')}</span>
			);
		case 'magic_set_closed':
			return (
				<span className="text-muted-foreground">{t('steps.closeWindow')}</span>
			);
		case 'magic_set_restored':
			return (
				<span className="text-muted-foreground">{t('steps.restore')}</span>
			);
		case 'magic_set_fullscreen':
			return (
				<span className="text-muted-foreground">{t('steps.fullscreen')}</span>
			);
		case 'magic_set_bg_color':
			return (
				<span className="text-muted-foreground">
					rgb({step.r ?? 255},{step.g ?? 255},{step.b ?? 255})
				</span>
			);
		case 'magic_set_toolbar_text':
			return <span className="text-muted-foreground">{step.text}</span>;
		case 'magic_set_app_top_most':
			return (
				<span className="text-muted-foreground">
					{t('steps.activateWindow')}
				</span>
			);
		case 'magic_set_master_indicator_visible':
			return (
				<span className="text-muted-foreground">
					{step.visible ? t('steps.show') : t('steps.hide')}
					{t('steps.masterIndicator')}
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
			return (
				<span className="text-muted-foreground">
					{t('steps.closeInactiveTabs')}
				</span>
			);
		case 'magic_open_new_window':
			return (
				<span className="text-muted-foreground">{t('steps.newWindow')}</span>
			);
		case 'magic_type_string':
			return (
				<span className="text-muted-foreground">
					"{step.text.slice(0, 40)}"
				</span>
			);
		case 'magic_capture_app_shell':
			return (
				<span className="text-muted-foreground truncate max-w-48">
					{step.output_path || t('steps.defaultPath')}
				</span>
			);
		case 'magic_get_browsers':
			return (
				<span className="text-muted-foreground">{t('steps.allBrowsers')}</span>
			);
		case 'magic_get_active_browser':
			return (
				<span className="text-muted-foreground">
					{t('steps.activeBrowser')}
				</span>
			);
		case 'magic_get_tabs':
			return (
				<span className="text-muted-foreground">
					browser_id={step.browser_id}
				</span>
			);
		case 'magic_get_active_tabs':
			return (
				<span className="text-muted-foreground">{t('steps.activeTabs')}</span>
			);
		case 'magic_get_switches':
			return (
				<span className="text-muted-foreground font-mono">{step.key}</span>
			);
		case 'magic_get_host_name':
			return (
				<span className="text-muted-foreground">{t('steps.hostname')}</span>
			);
		case 'magic_get_mac_address':
			return (
				<span className="text-muted-foreground">{t('steps.macAddress')}</span>
			);
		case 'magic_get_bookmarks':
			return (
				<span className="text-muted-foreground">{t('steps.bookmarkTree')}</span>
			);
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
			return (
				<span className="text-muted-foreground">
					{t('steps.bookmarkCurrentTab')}
				</span>
			);
		case 'magic_unbookmark_current_tab':
			return (
				<span className="text-muted-foreground">
					{t('steps.unbookmarkCurrentTab')}
				</span>
			);
		case 'magic_is_current_tab_bookmarked':
			return (
				<span className="text-muted-foreground">{t('steps.isBookmarked')}</span>
			);
		case 'magic_export_bookmark_state':
			return (
				<span className="text-muted-foreground">
					{t('steps.exportBookmarks')}
				</span>
			);
		case 'magic_get_managed_cookies':
			return (
				<span className="text-muted-foreground">
					{t('steps.managedCookies')}
				</span>
			);
		case 'magic_export_cookie_state':
			return <span className="text-muted-foreground">{step.mode}</span>;
		case 'magic_get_managed_extensions':
			return (
				<span className="text-muted-foreground">
					{t('steps.managedExtensions')}
				</span>
			);
		case 'magic_trigger_extension_action':
			return (
				<span className="text-muted-foreground font-mono">
					{step.extension_id.slice(0, 16)}...
				</span>
			);
		case 'magic_close_extension_popup':
			return (
				<span className="text-muted-foreground">
					{t('steps.closeExtPopup')}
				</span>
			);
		case 'magic_toggle_sync_mode':
			return <span className="text-muted-foreground">{step.role}</span>;
		case 'magic_get_sync_mode':
			return (
				<span className="text-muted-foreground">{t('steps.syncStatus')}</span>
			);
		case 'magic_get_is_master':
			return (
				<span className="text-muted-foreground">{t('steps.isMaster')}</span>
			);
		case 'magic_get_sync_status':
			return (
				<span className="text-muted-foreground">
					{t('steps.fullSyncStatus')}
				</span>
			);
		case 'form_dialog':
			return (
				<span className="text-muted-foreground">
					{step.title || 'Form'}{step.fields?.length ? ` (${step.fields.length} fields)` : ''}
				</span>
			);
		case 'table_dialog':
			return (
				<span className="text-muted-foreground">
					{step.title || 'Table'}{step.rows?.length ? ` (${step.rows.length} rows)` : ''}
				</span>
			);
		case 'image_dialog':
			return (
				<span className="text-muted-foreground">{step.title || 'Image'}</span>
			);
		case 'countdown_dialog':
			return (
				<span className="text-muted-foreground">
					{step.message ? `${step.message.slice(0, 30)} (${step.seconds}s)` : `${step.seconds}s`}
				</span>
			);
		case 'markdown_dialog':
			return (
				<span className="text-muted-foreground">
					{step.title || step.content?.slice(0, 40) || 'Markdown'}
				</span>
			);
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
			return i18next.t('automation:steps.screenshot');
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
		case 'ai_agent':
			return step.prompt.slice(0, 60);
		case 'cdp_navigate':
			return step.url;
		case 'cdp_reload':
			return i18next.t('automation:steps.reloadPage');
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
			return step.output_path
				? `${i18next.t('automation:steps.screenshot')} → ${step.output_path}`
				: i18next.t('automation:steps.screenshotDefaultDir');
		case 'magic_set_bounds':
			return `${step.x},${step.y} ${step.width}×${step.height}`;
		case 'magic_get_bounds':
			return i18next.t('automation:steps.getBounds');
		case 'magic_set_maximized':
			return i18next.t('automation:steps.maximize');
		case 'magic_set_minimized':
			return i18next.t('automation:steps.minimize');
		case 'magic_set_closed':
			return i18next.t('automation:steps.closeWindow');
		case 'magic_set_restored':
			return i18next.t('automation:steps.restore');
		case 'magic_set_fullscreen':
			return i18next.t('automation:steps.fullscreen');
		case 'magic_set_bg_color':
			return `rgb(${step.r ?? 255},${step.g ?? 255},${step.b ?? 255})`;
		case 'magic_set_toolbar_text':
			return step.text;
		case 'magic_set_app_top_most':
			return i18next.t('automation:steps.activateWindow');
		case 'magic_set_master_indicator_visible':
			return step.visible
				? `${i18next.t('automation:steps.show')}${i18next.t('automation:steps.masterIndicator')}`
				: `${i18next.t('automation:steps.hide')}${i18next.t('automation:steps.masterIndicator')}`;
		case 'magic_open_new_tab':
			return step.url;
		case 'magic_close_tab':
		case 'magic_activate_tab':
			return `tab_id=${step.tab_id}`;
		case 'magic_activate_tab_by_index':
			return `index=${step.index}`;
		case 'magic_close_inactive_tabs':
			return i18next.t('automation:steps.closeInactiveTabs');
		case 'magic_open_new_window':
			return i18next.t('automation:steps.newWindow');
		case 'magic_type_string':
			return `"${step.text.slice(0, 40)}"`;
		case 'magic_capture_app_shell':
			return step.output_path || i18next.t('automation:steps.defaultPath');
		case 'magic_get_browsers':
			return i18next.t('automation:steps.allBrowsers');
		case 'magic_get_active_browser':
			return i18next.t('automation:steps.activeBrowser');
		case 'magic_get_tabs':
			return `browser_id=${step.browser_id}`;
		case 'magic_get_active_tabs':
			return i18next.t('automation:steps.activeTabs');
		case 'magic_get_switches':
			return step.key;
		case 'magic_get_host_name':
			return i18next.t('automation:steps.hostname');
		case 'magic_get_mac_address':
			return i18next.t('automation:steps.macAddress');
		case 'magic_get_bookmarks':
			return i18next.t('automation:steps.bookmarkTree');
		case 'magic_create_bookmark':
			return `${step.title} → ${step.url.slice(0, 40)}`;
		case 'magic_create_bookmark_folder':
			return step.title;
		case 'magic_update_bookmark':
		case 'magic_remove_bookmark':
		case 'magic_move_bookmark':
			return `node_id=${step.node_id}`;
		case 'magic_bookmark_current_tab':
			return i18next.t('automation:steps.bookmarkCurrentTab');
		case 'magic_unbookmark_current_tab':
			return i18next.t('automation:steps.unbookmarkCurrentTab');
		case 'magic_is_current_tab_bookmarked':
			return i18next.t('automation:steps.isBookmarked');
		case 'magic_export_bookmark_state':
			return i18next.t('automation:steps.exportBookmarks');
		case 'magic_get_managed_cookies':
			return i18next.t('automation:steps.managedCookies');
		case 'magic_export_cookie_state':
			return step.mode;
		case 'magic_get_managed_extensions':
			return i18next.t('automation:steps.managedExtensions');
		case 'magic_trigger_extension_action':
			return `${step.extension_id.slice(0, 16)}...`;
		case 'magic_close_extension_popup':
			return i18next.t('automation:steps.closeExtPopup');
		case 'magic_toggle_sync_mode':
			return step.role;
		case 'magic_get_sync_mode':
			return i18next.t('automation:steps.syncStatus');
		case 'magic_get_is_master':
			return i18next.t('automation:steps.isMaster');
		case 'magic_get_sync_status':
			return i18next.t('automation:steps.fullSyncStatus');
		default:
			return '';
	}
}
