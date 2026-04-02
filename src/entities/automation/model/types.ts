export type SelectorType = 'css' | 'xpath' | 'text';
export type WaitForUserTimeout = 'continue' | 'fail';
export type LoopMode = 'count' | 'while';
export type ClipboardAction = 'copy' | 'paste' | 'select_all';
export type TextSource = 'inline' | 'file' | 'variable';

export type ScriptStep =
	| { kind: 'navigate'; url: string; output_key?: string }
	| { kind: 'wait'; ms: number }
	| { kind: 'click'; selector: string; selector_type?: SelectorType }
	| { kind: 'type'; selector: string; text: string; selector_type?: SelectorType }
	| { kind: 'screenshot'; output_key?: string }
	| { kind: 'magic'; command: string; params: Record<string, unknown>; output_key?: string }
	| { kind: 'cdp'; method: string; params?: Record<string, unknown>; output_key?: string }
	| {
			kind: 'wait_for_user';
			message: string;
			input_label?: string;
			output_key?: string;
			timeout_ms?: number;
			on_timeout?: WaitForUserTimeout;
	  }
	| {
			kind: 'condition';
			condition_expr: string;
			then_steps: ScriptStep[];
			else_steps?: ScriptStep[];
	  }
	| {
			kind: 'loop';
			mode?: LoopMode;
			count?: number;
			condition_expr?: string;
			max_iterations?: number;
			iter_var?: string;
			body_steps: ScriptStep[];
	  }
	| { kind: 'break' }
	| { kind: 'continue' }
	| { kind: 'print'; text: string; level?: 'info' | 'warn' | 'error' | 'debug' }

	// ── AI 步骤 ───────────────────────────────────────────────────────────────
	| {
			kind: 'ai_prompt';
			prompt: string;
			image_var?: string;
			model_override?: string;
			output_key?: string;
	  }
	| {
			kind: 'ai_extract';
			prompt: string;
			image_var?: string;
			output_key_map: AiOutputKeyMapping[];
			model_override?: string;
	  }
	| {
			kind: 'ai_agent';
			system_prompt: string;
			initial_message: string;
			max_steps: number;
			output_key?: string;
	  }

	// ── CDP 具名步骤 ──────────────────────────────────────────────────────────
	| { kind: 'cdp_navigate'; url: string; output_key?: string }
	| { kind: 'cdp_reload'; ignore_cache?: boolean }
	| { kind: 'cdp_click'; selector: string; selector_type?: SelectorType }
	| { kind: 'cdp_type'; selector: string; text: string; selector_type?: SelectorType }
	| { kind: 'cdp_scroll_to'; selector?: string; selector_type?: SelectorType; x?: number; y?: number }
	| { kind: 'cdp_wait_for_selector'; selector: string; selector_type?: SelectorType; timeout_ms?: number }
	| { kind: 'cdp_wait_for_page_load'; timeout_ms?: number }
	| { kind: 'cdp_get_text'; selector: string; selector_type?: SelectorType; output_key?: string }
	| { kind: 'cdp_get_attribute'; selector: string; selector_type?: SelectorType; attribute: string; output_key?: string }
	| { kind: 'cdp_set_input_value'; selector: string; selector_type?: SelectorType; value: string }
	| {
			kind: 'cdp_screenshot';
			format?: string;
			quality?: number;
			output_path?: string;
			output_key_base64?: string;
			output_key_file_path?: string;
	  }

	// ── Magic Controller 具名步骤 ─────────────────────────────────────────────

	// 窗口外观
	| { kind: 'magic_set_bounds'; x: number; y: number; width: number; height: number; output_key?: string }
	| { kind: 'magic_get_bounds'; output_key?: string }
	| { kind: 'magic_set_maximized' }
	| { kind: 'magic_set_minimized' }
	| { kind: 'magic_set_closed' }
	| { kind: 'magic_set_restored' }
	| { kind: 'magic_set_fullscreen' }
	| { kind: 'magic_set_bg_color'; r?: number; g?: number; b?: number }
	| { kind: 'magic_set_toolbar_text'; text: string }
	| { kind: 'magic_set_app_top_most' }
	| { kind: 'magic_set_master_indicator_visible'; visible?: boolean; label?: string }

	// 标签页与窗口操作
	| { kind: 'magic_open_new_tab'; url: string; browser_id?: number; output_key?: string }
	| { kind: 'magic_close_tab'; tab_id: number }
	| { kind: 'magic_activate_tab'; tab_id: number }
	| { kind: 'magic_activate_tab_by_index'; index: number; browser_id?: number }
	| { kind: 'magic_close_inactive_tabs' }
	| { kind: 'magic_open_new_window'; output_key?: string }
	| { kind: 'magic_type_string'; text: string; tab_id?: number }

	// 浏览器信息查询
	| { kind: 'magic_get_browsers'; output_key?: string }
	| { kind: 'magic_get_active_browser'; output_key?: string }
	| { kind: 'magic_get_tabs'; browser_id: number; output_key?: string }
	| { kind: 'magic_get_active_tabs'; output_key?: string }
	| { kind: 'magic_get_switches'; key: string; output_key?: string }
	| { kind: 'magic_get_host_name'; output_key?: string }
	| { kind: 'magic_get_mac_address'; output_key?: string }

	// 书签
	| { kind: 'magic_get_bookmarks'; output_key?: string }
	| { kind: 'magic_create_bookmark'; parent_id: string; title: string; url: string; output_key?: string }
	| { kind: 'magic_create_bookmark_folder'; parent_id: string; title: string; output_key?: string }
	| { kind: 'magic_update_bookmark'; node_id: string; title?: string; url?: string }
	| { kind: 'magic_move_bookmark'; node_id: string; new_parent_id: string }
	| { kind: 'magic_remove_bookmark'; node_id: string }
	| { kind: 'magic_bookmark_current_tab'; browser_id?: number; parent_id?: string }
	| { kind: 'magic_unbookmark_current_tab'; browser_id?: number }
	| { kind: 'magic_is_current_tab_bookmarked'; browser_id?: number; output_key?: string }
	| { kind: 'magic_export_bookmark_state'; environment_id?: string; output_key?: string }

	// Cookie
	| { kind: 'magic_get_managed_cookies'; output_key?: string }
	| { kind: 'magic_export_cookie_state'; mode: string; url?: string; environment_id?: string; output_key?: string }

	// 扩展
	| { kind: 'magic_get_managed_extensions'; output_key?: string }
	| { kind: 'magic_trigger_extension_action'; extension_id: string; browser_id?: number }
	| { kind: 'magic_close_extension_popup'; browser_id?: number }

	// 同步模式
	| { kind: 'magic_toggle_sync_mode'; role: string; browser_id?: number; session_id?: string; output_key?: string }
	| { kind: 'magic_get_sync_mode'; output_key?: string }
	| { kind: 'magic_get_is_master'; output_key?: string }
	| { kind: 'magic_get_sync_status'; output_key?: string }

	// 截图（app 壳）— 与 cdp_screenshot 一致，mode=file，不用 base64
	| {
			kind: 'magic_capture_app_shell';
			browser_id?: number;
			format?: string;
			output_path?: string;
			output_key_file_path?: string;
	  }

	// ── CDP 新增步骤 ─────────────────────────────────────────────────────────
	| { kind: 'cdp_open_new_tab'; url: string; output_key?: string }
	| { kind: 'cdp_get_all_tabs'; output_key?: string }
	| { kind: 'cdp_switch_tab'; target_id: string }
	| { kind: 'cdp_close_tab'; target_id: string }
	| { kind: 'cdp_go_back'; steps?: number }
	| { kind: 'cdp_go_forward'; steps?: number }
	| { kind: 'cdp_upload_file'; selector: string; selector_type?: SelectorType; files: string[] }
	| { kind: 'cdp_download_file'; download_path: string }
	| { kind: 'cdp_clipboard'; action?: ClipboardAction }
	| { kind: 'cdp_execute_js'; expression?: string; file_path?: string; output_key?: string }
	| {
			kind: 'cdp_input_text';
			selector: string;
			selector_type?: SelectorType;
			text_source?: TextSource;
			text?: string;
			file_path?: string;
			var_name?: string;
	  }
	| { kind: 'cdp_press_key'; key: string }
	| { kind: 'cdp_shortcut'; modifiers: string[]; key: string };

export type ScriptVarDef = { name: string; defaultValue: string };

export type ScriptSettings = {
	stepDelayMs?: number;
};

export type AutomationScript = {
	id: string;
	name: string;
	description: string | null;
	steps: ScriptStep[];
	canvasPositionsJson: string | null;
	variablesSchemaJson: string | null;
	associatedProfileIds: string[];
	aiConfig: AiProviderConfig | null;
	aiConfigId: string | null;
	settings?: ScriptSettings;
	createdAt: number;
	updatedAt: number;
};

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'waiting_human';

export type StepResult = {
	index: number;
	status: StepStatus;
	output: string | null;
	durationMs: number;
	varsSet?: Record<string, string>;
};

export type RunLogEntry = {
	timestamp: number;
	level: 'info' | 'warn' | 'error' | 'debug';
	category: 'flow' | 'step' | 'ai' | 'cdp' | 'magic' | 'error';
	message: string;
	details?: Record<string, unknown>;
};

export type AutomationRun = {
	id: string;
	scriptId: string;
	profileId: string;
	status: RunStatus;
	steps: ScriptStep[];
	results: StepResult[] | null;
	startedAt: number;
	finishedAt: number | null;
	error: string | null;
	logs?: RunLogEntry[];
};

export type AutomationProgressEvent = {
	runId: string;
	stepIndex: number;
	stepTotal: number;
	stepStatus: StepStatus;
	output: string | null;
	durationMs: number;
	runStatus: RunStatus;
	varsSet?: Record<string, string>;
	stepPath?: number[];
};

export type AutomationVariablesUpdatedEvent = {
	runId: string;
	vars: Record<string, string>;
};

export type AutomationHumanRequiredEvent = {
	runId: string;
	message: string;
	inputLabel: string | null;
	timeoutMs: number | null;
	stepPath: number[];
};

export type AutomationHumanDismissedEvent = {
	runId: string;
};

export type AutomationStepErrorPauseEvent = {
	runId: string;
	stepIndex: number;
	errorMessage: string;
};

export type AutomationRunCancelledEvent = {
	runId: string;
};

export type AiOutputKeyMapping = {
	jsonPath: string;
	varName: string;
};

export type AiProviderType =
	| 'openai'
	| 'openrouter'
	| 'deepseek'
	| 'groq'
	| 'together'
	| 'ollama'
	| 'anthropic'
	| 'gemini'
	| 'custom';

export type AiProviderConfig = {
	provider?: AiProviderType;
	baseUrl?: string;
	apiKey?: string;
	model?: string;
};

export type CreateAutomationScriptPayload = {
	name: string;
	description?: string;
	steps: ScriptStep[];
	associatedProfileIds?: string[];
	aiConfig?: AiProviderConfig | null;
	aiConfigId?: string | null;
	settings?: ScriptSettings;
};

export type AiConfigEntry = {
	id: string;
	name: string;
	provider?: AiProviderType;
	baseUrl?: string;
	apiKey?: string;
	model?: string;
};
