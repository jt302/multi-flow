import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('profile list item exposes visual dialog with translated background controls', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("field: 'visual'"), true);
	assert.equal(file.includes("t('profile:visual.backgroundColorLabel')"), true);
	assert.equal(file.includes("t('profile:visual.noBackgroundColor')"), true);
	assert.equal(file.includes("t('profile:visual.customColor')"), true);
});

test('profile list item exposes numeric id and visual inheritance controls', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('numericId'), true);
	assert.equal(file.includes('resolvedToolbarText'), true);
	assert.equal(file.includes('resolvedBrowserBgColor'), true);
	assert.equal(file.includes("t('profile:visual.inheritGroup')"), true);
	assert.equal(file.includes("t('profile:visual.groupNameAndId')"), true);
});

test('profile list table includes a dedicated group column', () => {
	const file = readFileSync(new URL('./profile-list-table.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('list.group')"), true);
});

test('profile list rows use stable parent props for memoized rendering', () => {
	const itemFile = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');
	const tableFile = readFileSync(new URL('./profile-list-table.tsx', import.meta.url), 'utf8');
	const pageFile = readFileSync(new URL('./profile-list-page.tsx', import.meta.url), 'utf8');

	assert.equal(itemFile.includes('memo(function ProfileListItem'), true);
	assert.equal(itemFile.includes('isVisualEditing: boolean;'), true);
	assert.equal(tableFile.includes('selectedProfileIdSet'), true);
	assert.equal(tableFile.includes('onSelectedChange={(checked)'), false);
	assert.equal(tableFile.includes('onQuickEditChange={(value)'), false);
	assert.equal(pageFile.includes('const onErrorReset = useCallback('), true);
	assert.equal(pageFile.includes('const runAction = useCallback('), true);
});

test('profile list item separates numeric id from chromium label display', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('profile:list.identifier')"), true);
	assert.equal(file.includes("t('profile:list.chromiumLabel')"), true);
	assert.equal(
		file.includes('<Badge variant="outline" className="max-w-[140px] truncate text-[10px]">'),
		false,
	);
});

test('profile browser version display does not treat spoof versions as host resources', () => {
	const listItemFile = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');
	const detailFile = readFileSync(new URL('./profile-detail-page.tsx', import.meta.url), 'utf8');
	const formFile = readFileSync(new URL('./basic-settings-section.tsx', import.meta.url), 'utf8');
	const formHookFile = readFileSync(
		new URL('../model/use-profile-create-form.ts', import.meta.url),
		'utf8',
	);
	const listLibFile = readFileSync(
		new URL('../../../entities/profile/lib/profile-list.ts', import.meta.url),
		'utf8',
	);
	const commandFile = readFileSync(
		new URL('../../../../src-tauri/src/commands/profile_commands.rs', import.meta.url),
		'utf8',
	);

	assert.equal(listItemFile.includes('browserVersionMeta.resourceLabel'), false);
	assert.equal(listItemFile.includes('browserVersionMeta.descriptionLabel'), false);
	assert.equal(detailFile.includes('browserVersionMeta.resourceLabel'), false);
	assert.equal(formFile.includes('resourceStatusLabel(selectedResource)'), false);
	assert.equal(
		formHookFile.includes("!getValues('browserVersion') && selectedDevicePreset.browserVersion"),
		false,
	);
	assert.equal(listLibFile.includes('versionNotAvailable'), false);
	assert.equal(commandFile.includes('preferred_chromium_version.as_deref().and_then'), false);
});

test('profile list item uses readable foreground in visual preview', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('getReadableForeground'), true);
	assert.equal(file.includes('previewForegroundColor'), true);
	assert.equal(file.includes('previewBadgeStyle'), true);
});

test('profile detail page reveals directories before falling back to openPath', () => {
	const file = readFileSync(new URL('./profile-detail-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('revealItemInDir'), true);
	assert.equal(file.includes('await openPath(path);'), true);
});

test('profile detail page disables edit config while profile is running', () => {
	const file = readFileSync(new URL('./profile-detail-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('const editConfigDisabled = profile.running;'), true);
	assert.equal(file.includes('disabled={editConfigDisabled}'), true);
	assert.equal(
		file.includes("title={editConfigDisabled ? t('detail.editConfigDisabledRunning') : undefined}"),
		true,
	);
});

test('profile list page adds one-click stop action for all filtered running profiles', () => {
	const pageFile = readFileSync(new URL('./profile-list-page.tsx', import.meta.url), 'utf8');
	const toolbarFile = readFileSync(new URL('./profile-list-toolbar.tsx', import.meta.url), 'utf8');
	const filtersFile = readFileSync(new URL('./profile-list-filters.tsx', import.meta.url), 'utf8');

	assert.equal(pageFile.includes('filteredRunningIds'), true);
	assert.equal(pageFile.includes('ConfirmActionDialog'), true);
	assert.equal(pageFile.includes("t('list.stopAllConfirmDesc'"), true);
	assert.equal(toolbarFile.includes('onStopAllRunning'), true);
	assert.equal(filtersFile.includes("t('common:stopAllRunning')"), true);
});

test('profile list batch actions share pending state and release it in finally', () => {
	const pageFile = readFileSync(new URL('./profile-list-page.tsx', import.meta.url), 'utf8');
	const toolbarFile = readFileSync(new URL('./profile-list-toolbar.tsx', import.meta.url), 'utf8');
	const filtersFile = readFileSync(new URL('./profile-list-filters.tsx', import.meta.url), 'utf8');
	const groupDialogFile = readFileSync(
		new URL('./profile-batch-group-dialog.tsx', import.meta.url),
		'utf8',
	);
	const clearGroupDialogFile = readFileSync(
		new URL('./profile-batch-clear-group-dialog.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(
		/type ProfileBatchAction =\s*\|\s*'refresh'\s*\|\s*'open'\s*\|\s*'close'\s*\|\s*'stopAll'\s*\|\s*'setGroup'\s*\|\s*'clearGroup'\s*\|\s*'retryOpen';/.test(
			pageFile,
		),
		true,
	);
	assert.equal(
		pageFile.includes(
			'const [batchAction, setBatchAction] = useState<ProfileBatchAction | null>(null);',
		),
		true,
	);
	assert.equal(
		pageFile.includes('const batchActionRef = useRef<ProfileBatchAction | null>(null);'),
		true,
	);
	assert.equal(pageFile.includes('const runBatchAction = async <T,'), true);
	assert.equal(pageFile.includes('if (batchActionRef.current) {'), true);
	assert.equal(pageFile.includes('batchActionRef.current = actionName;'), true);
	assert.equal(pageFile.includes('setBatchAction(actionName);'), true);
	assert.equal(pageFile.includes('batchActionRef.current = null;'), true);
	assert.equal(pageFile.includes('setBatchAction(null);'), true);
	assert.equal(pageFile.includes("void runBatchAction('refresh'"), true);
	assert.equal(pageFile.includes("void runBatchAction('open'"), true);
	assert.equal(pageFile.includes("void runBatchAction('close'"), true);
	assert.equal(pageFile.includes("void runBatchAction('setGroup'"), true);
	assert.equal(pageFile.includes("void runBatchAction('clearGroup'"), true);
	assert.equal(pageFile.includes("void runBatchAction('retryOpen'"), true);
	assert.equal(pageFile.includes("void runBatchAction('stopAll'"), true);
	assert.equal(pageFile.includes('busyAction={batchAction}'), true);
	assert.equal(pageFile.includes("pending={batchAction === 'stopAll'}"), true);
	assert.equal(
		pageFile.includes(
			"confirmText={batchAction === 'stopAll' ? t('list.stopping') : t('list.confirmStop')}",
		),
		true,
	);
	assert.equal(pageFile.includes('setStopAllRunningPending'), false);

	assert.equal(toolbarFile.includes('busyAction: ProfileBatchAction | null;'), true);
	assert.equal(toolbarFile.includes('pending={Boolean(busyAction)}'), true);
	assert.equal(toolbarFile.includes('busyAction={busyAction}'), true);

	assert.equal(filtersFile.includes('pending: boolean;'), true);
	assert.equal(filtersFile.includes('busyAction: ProfileBatchAction | null;'), true);
	assert.equal(filtersFile.includes('disabled={pending || stoppedSelectedCount === 0}'), true);
	assert.equal(filtersFile.includes('disabled={pending || runningSelectedCount === 0}'), true);
	assert.equal(filtersFile.includes('disabled={pending || stopAllRunningCount === 0}'), true);
	assert.equal(filtersFile.includes("busyAction === 'open'"), true);
	assert.equal(filtersFile.includes("busyAction === 'close'"), true);
	assert.equal(filtersFile.includes("busyAction === 'stopAll'"), true);

	assert.equal(groupDialogFile.includes('pending: boolean;'), true);
	assert.equal(groupDialogFile.includes('disabled={pending}'), true);
	assert.equal(groupDialogFile.includes('disabled={pending || !value}'), true);
	assert.equal(clearGroupDialogFile.includes('pending: boolean;'), true);
	assert.equal(clearGroupDialogFile.includes('disabled={pending}'), true);
});

test('profile list item exposes cookie export actions', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('profile:actions.exportCookie')"), true);
	assert.equal(file.includes("t('profile:actions.exportBySite')"), true);
	assert.equal(file.includes("t('profile:actions.exportAll')"), true);
	assert.equal(file.includes('@tauri-apps/plugin-dialog'), true);
	assert.equal(file.includes('save({'), true);
});

test('profile list item exposes profile plugin management entry', () => {
	const file = readFileSync(new URL('./profile-list-item.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('profile:actions.pluginManage')"), true);
	assert.equal(file.includes("t('profile:plugins.title')"), true);
	assert.equal(file.includes('updateProfilePlugins'), true);
});

test('advanced settings section exposes cookie json input and merge action', () => {
	const file = readFileSync(new URL('./advanced-settings-section.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('advanced.cookieJson')"), true);
	assert.equal(file.includes("t('advanced.mergeCookie')"), true);
	assert.equal(file.includes("t('advanced.cookieHelp')"), true);
	assert.equal(file.includes("t('advanced.mergeCookieDesc')"), true);
});

test('profile create form includes plugin selection section', () => {
	const file = readFileSync(new URL('./profile-create-form.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('PluginsSettingsSection'), true);
	assert.equal(file.includes('pluginPackagesQuery'), true);
});

test('group form dialog exposes visual defaults editor', () => {
	const file = readFileSync(
		new URL('../../group/ui/group-form-dialog.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(file.includes('toolbarLabelMode'), true);
	assert.equal(file.includes('browserBgColor'), true);
	assert.equal(file.includes("t('group:form.visualSectionTitle')"), true);
	assert.equal(file.includes("t('group:form.browserBgColorDefault')"), true);
});

test('basic settings section clears browser color errors when leaving custom mode', () => {
	const file = readFileSync(new URL('./basic-settings-section.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("clearErrors('browserBgColor')"), true);
	assert.equal(file.includes("shouldValidate: nextMode === 'custom'"), true);
});

test('basic settings section uses compact platform cards without hint copy', () => {
	const file = readFileSync(new URL('./basic-settings-section.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('grid-cols-[repeat(auto-fit,minmax(150px,1fr))]'), true);
	assert.equal(file.includes('<PlatformGlyph'), true);
	assert.equal(file.includes('size="xl"'), true);
	assert.equal(file.includes('value.hint'), false);
});

test('platform glyph supports extra large size for frameless platform cards', () => {
	const file = readFileSync(
		new URL('../../../entities/profile/ui/platform-mark.tsx', import.meta.url),
		'utf8',
	);

	assert.equal(file.includes("size?: 'sm' | 'md' | 'lg' | 'xl'"), true);
	assert.equal(file.includes('xl: {'), true);
	assert.equal(file.includes("image: 'h-7 w-7'"), true);
});

test('plugins page exposes proxy selector for download and update actions', () => {
	const file = readFileSync(new URL('../../plugin/ui/plugins-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('useProxiesQuery'), true);
	assert.equal(file.includes("t('downloadCrx.proxyNone')"), true);
	assert.equal(file.includes('selectedDownloadProxyId'), true);
	assert.equal(file.includes('readPluginDownloadPreference'), true);
	assert.equal(file.includes('updatePluginDownloadPreference'), true);
});

test('plugins page renders plugin icon and name in library cards', () => {
	const file = readFileSync(new URL('../../plugin/ui/plugins-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('plugin.iconPath'), true);
	assert.equal(file.includes("t('library.iconAlt', { name: plugin.name })"), true);
	assert.equal(file.includes('<img'), true);
	assert.equal(file.includes('convertFileSrc'), true);
});

test('plugins page exposes open-in-store action', () => {
	const file = readFileSync(new URL('../../plugin/ui/plugins-page.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('library.openInStore')"), true);
	assert.equal(file.includes('@tauri-apps/plugin-opener'), true);
	assert.equal(file.includes('plugin.storeUrl'), true);
});

test('tauri config enables asset protocol for app data icons', () => {
	const file = readFileSync(
		new URL('../../../../src-tauri/tauri.conf.json', import.meta.url),
		'utf8',
	);

	assert.equal(file.includes('"assetProtocol"'), true);
	assert.equal(file.includes('"enable": true'), true);
	assert.equal(file.includes('"$APPDATA/plugins/packages/**"'), true);
	assert.equal(file.includes('"$APPDATA/screenshots/**"'), true);
	assert.equal(file.includes('"$APPDATA/automation_data/**"'), true);
	assert.equal(file.includes('"$APPDATA/**"'), false);
});

test('tauri bundle includes default skills resources', () => {
	const file = readFileSync(
		new URL('../../../../src-tauri/tauri.conf.json', import.meta.url),
		'utf8',
	);

	assert.equal(file.includes('"resources"'), true);
	assert.equal(file.includes('"../docs/default-skills"'), true);
	assert.equal(file.includes('"default-skills"'), true);
});
