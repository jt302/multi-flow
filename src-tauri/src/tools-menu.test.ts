import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('tools menu exposes devtools and reload entries for the main window', () => {
	const source = readFileSync(new URL('./lib.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('const MENU_ID_OPEN_DEVTOOLS: &str = "open_devtools";'), true);
	assert.equal(
		source.includes('const MENU_ID_RELOAD_MAIN_WINDOW: &str = "reload_main_window";'),
		true,
	);
	assert.equal(source.includes('native_menu_translations_for_locale'), true);
	assert.equal(source.includes('translations.open_devtools'), true);
	assert.equal(source.includes('translations.reload'), true);
	assert.equal(source.includes('MenuItemBuilder::with_id(MENU_ID_OPEN_DEVTOOLS'), true);
	assert.equal(source.includes('MenuItemBuilder::with_id(MENU_ID_RELOAD_MAIN_WINDOW'), true);
	assert.equal(source.includes('MenuItemBuilder::with_id(MENU_ID_OPEN_DEVTOOLS, "打开开发者调试工具")'), false);
	assert.equal(source.includes('MenuItemBuilder::with_id(MENU_ID_RELOAD_MAIN_WINDOW, "刷新")'), false);
});

test('tools menu events route to main window devtools and reload handlers', () => {
	const source = readFileSync(new URL('./lib.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('if event.id().as_ref() == MENU_ID_OPEN_DEVTOOLS {'), true);
	assert.equal(source.includes('if event.id().as_ref() == MENU_ID_RELOAD_MAIN_WINDOW {'), true);
	assert.equal(source.includes('open_main_window_devtools(app);'), true);
	assert.equal(source.includes('reload_main_window(app);'), true);
	assert.equal(source.includes('window.open_devtools();'), true);
	assert.equal(source.includes('window.reload()'), true);
});

test('app language update command rebuilds native menu immediately', () => {
	const source = readFileSync(new URL('./commands/automation_commands.rs', import.meta.url), 'utf8');

	assert.equal(source.includes('pub fn read_app_language('), true);
	assert.equal(source.includes('pub fn update_app_language('), true);
	assert.equal(source.includes('crate::setup_native_menu(&app, Some(&locale))'), true);
});
