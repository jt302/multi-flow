import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('tools menu exposes devtools and reload entries for the focused window', () => {
	const source = readFileSync(new URL('./lib.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('const MENU_ID_OPEN_DEVTOOLS: &str = "open_devtools";'), true);
	assert.equal(
		source.includes('const MENU_ID_RELOAD_WINDOW: &str = "reload_window";'),
		true,
	);
	assert.equal(source.includes('native_menu_translations_for_locale'), true);
	assert.equal(source.includes('translations.open_devtools'), true);
	assert.equal(source.includes('translations.reload'), true);
	assert.equal(source.includes('MenuItemBuilder::with_id(MENU_ID_OPEN_DEVTOOLS'), true);
	assert.equal(source.includes('MenuItemBuilder::with_id(MENU_ID_RELOAD_WINDOW'), true);
	assert.equal(source.includes('MenuItemBuilder::with_id(MENU_ID_OPEN_DEVTOOLS, "打开开发者调试工具")'), false);
	assert.equal(source.includes('MenuItemBuilder::with_id(MENU_ID_RELOAD_WINDOW, "刷新")'), false);
});

test('tools menu events route to focused window devtools and reload handlers', () => {
	const source = readFileSync(new URL('./lib.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('if event.id().as_ref() == MENU_ID_OPEN_DEVTOOLS {'), true);
	assert.equal(source.includes('if event.id().as_ref() == MENU_ID_RELOAD_WINDOW {'), true);
	assert.equal(source.includes('open_focused_window_devtools(app);'), true);
	assert.equal(source.includes('reload_focused_window(app);'), true);
	assert.equal(source.includes('open_main_window_devtools(app);'), false);
	assert.equal(source.includes('reload_main_window(app);'), false);
	assert.equal(source.includes('focused_webview_window(app)'), true);
	assert.equal(source.includes('app.webview_windows()'), true);
	assert.equal(source.includes('window.is_focused().unwrap_or(false)'), true);
	assert.equal(source.includes('window.open_devtools();'), true);
	assert.equal(source.includes('window.reload()'), true);
});

test('cmd+w monitor minimizes main and closes other focused windows', () => {
	const source = readFileSync(new URL('./lib.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('focused_webview_window(&app_handle)'), true);
	assert.equal(source.includes('app_handle.get_webview_window(MAIN_WINDOW_LABEL)'), false);
	assert.equal(source.includes('handle_cmd_w_window(w);'), true);
	assert.equal(source.includes('if window.label() == MAIN_WINDOW_LABEL {'), true);
	assert.equal(source.includes('let _ = window.minimize();'), true);
	assert.equal(source.includes('let _ = window.close();'), true);
});

test('app language update command rebuilds native menu immediately', () => {
	const source = readFileSync(new URL('./commands/automation_commands.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('pub fn read_app_language('), true);
	assert.equal(source.includes('pub fn update_app_language('), true);
	assert.equal(source.includes('crate::setup_native_menu(&app, Some(&locale))'), true);
});
