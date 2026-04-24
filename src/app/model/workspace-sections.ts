import i18next from 'i18next';

import type { NavItem, NavSection } from './workspace-types';

type WorkspaceSectionBuilder = () => NavSection;

function t(key: string, options?: Record<string, unknown>) {
	return i18next.t(key, options);
}

const WORKSPACE_SECTION_BUILDERS: Record<NavItem['id'], WorkspaceSectionBuilder> = {
	dashboard: () => ({
		title: t('nav:dashboardSection.title'),
		desc: t('nav:dashboardSection.desc'),
		tableTitle: '',
		rows: [],
	}),
	profiles: () => ({
		title: t('nav:profilesSection.title'),
		desc: t('nav:profilesSection.desc'),
		tableTitle: t('nav:profilesSection.tableTitle'),
		rows: [
			{
				name: 'AirDrop-001',
				group: 'AirDrop',
				status: t('nav:sampleStatus.running'),
				geo: 'US / New York',
				last: t('common:justNow'),
			},
			{
				name: 'AirDrop-002',
				group: 'AirDrop',
				status: t('nav:sampleStatus.standby'),
				geo: 'DE / Frankfurt',
				last: t('common:minutesAgo', { count: 12 }),
			},
			{
				name: 'Brand-TikTok-01',
				group: t('nav:sampleRows.brandAccount'),
				status: t('nav:sampleStatus.alert'),
				geo: 'GB / London',
				last: t('common:minutesAgo', { count: 3 }),
			},
		],
	}),
	plugins: () => ({
		title: t('nav:pluginsSection.title'),
		desc: t('nav:pluginsSection.desc'),
		tableTitle: t('nav:pluginsSection.tableTitle'),
		rows: [
			{
				name: 'Proxy Helper',
				group: t('nav:sampleRows.tools'),
				status: t('nav:sampleRows.downloaded'),
				geo: t('nav:sampleRows.profileCount', { count: 3 }),
				last: t('nav:sampleRows.checkUpdate'),
			},
			{
				name: 'Wallet Demo',
				group: t('nav:sampleRows.wallet'),
				status: t('nav:sampleRows.downloaded'),
				geo: t('nav:sampleRows.profileCount', { count: 12 }),
				last: t('nav:sampleRows.needRestart'),
			},
			{
				name: 'Locale Switcher',
				group: t('nav:sampleRows.debug'),
				status: t('nav:sampleRows.pendingDownload'),
				geo: t('nav:sampleRows.notInstalled'),
				last: t('nav:sampleRows.importById'),
			},
		],
	}),
	groups: () => ({
		title: t('nav:groupsSection.title'),
		desc: t('nav:groupsSection.desc'),
		tableTitle: t('nav:groupsSection.tableTitle'),
		rows: [
			{
				name: 'AirDrop-US',
				group: 'AirDrop',
				status: t('nav:sampleStatus.running'),
				geo: 'US / New York',
				last: t('common:justNow'),
			},
			{
				name: 'Farm-DE',
				group: 'Farm',
				status: t('nav:sampleStatus.standby'),
				geo: 'DE / Frankfurt',
				last: t('common:minutesAgo', { count: 10 }),
			},
			{
				name: 'Brand-GB',
				group: 'Brand',
				status: t('nav:sampleStatus.alert'),
				geo: 'GB / London',
				last: t('common:minutesAgo', { count: 2 }),
			},
		],
	}),
	proxy: () => ({
		title: t('nav:proxySection.title'),
		desc: t('nav:proxySection.desc'),
		tableTitle: t('nav:proxySection.tableTitle'),
		rows: [
			{
				name: 'Proxy-US-01',
				group: t('nav:sampleRows.residential'),
				status: t('nav:sampleStatus.running'),
				geo: 'US / New York',
				last: t('common:minutesAgo', { count: 1 }),
			},
			{
				name: 'Proxy-DE-11',
				group: t('nav:sampleRows.datacenter'),
				status: t('nav:sampleStatus.standby'),
				geo: 'DE / Frankfurt',
				last: t('common:minutesAgo', { count: 9 }),
			},
			{
				name: 'Proxy-GB-03',
				group: t('nav:sampleRows.residential'),
				status: t('nav:sampleStatus.alert'),
				geo: 'GB / London',
				last: t('common:justNow'),
			},
		],
	}),
	windows: () => ({
		title: t('nav:windowsSection.title'),
		desc: t('nav:windowsSection.desc'),
		tableTitle: t('nav:windowsSection.tableTitle'),
		rows: [
			{
				name: 'AirDrop-001',
				group: 'AirDrop',
				status: t('nav:sampleStatus.running'),
				geo: t('nav:sampleRows.windowTab', { windows: 1, tabs: 3 }),
				last: t('common:justNow'),
			},
			{
				name: 'Brand-UK-02',
				group: t('nav:sampleRows.brandAccount'),
				status: t('nav:sampleStatus.running'),
				geo: t('nav:sampleRows.windowTab', { windows: 2, tabs: 6 }),
				last: t('common:minutesAgo', { count: 2 }),
			},
			{
				name: 'Farm-DE-11',
				group: 'Farm',
				status: t('nav:sampleStatus.standby'),
				geo: t('nav:sampleRows.windowTab', { windows: 0, tabs: 0 }),
				last: t('nav:sampleRows.offline'),
			},
		],
	}),
	'browser-control': () => ({
		title: t('nav:browserControlSection.title'),
		desc: t('nav:browserControlSection.desc'),
		tableTitle: '',
		rows: [],
	}),
	automation: () => ({
		title: t('nav:automationSection.title'),
		desc: t('nav:automationSection.desc'),
		tableTitle: t('nav:automationSection.tableTitle'),
		rows: [],
	}),
	'ai-chat': () => ({
		title: t('nav:aiChatSection.title'),
		desc: t('nav:aiChatSection.desc'),
		tableTitle: '',
		rows: [],
	}),
	settings: () => ({
		title: t('nav:settingsSection.title'),
		desc: t('nav:settingsSection.desc'),
		tableTitle: t('nav:settingsSection.tableTitle'),
		rows: [
			{
				name: 'Chromium 144.0.7559.97',
				group: t('nav:sampleRows.resourceVersion'),
				status: t('nav:sampleStatus.running'),
				geo: 'AppData',
				last: t('common:installed'),
			},
			{
				name: 'GeoLite2-City',
				group: t('nav:sampleRows.geoDb'),
				status: t('nav:sampleStatus.standby'),
				geo: t('nav:sampleRows.optionalEnable'),
				last: t('common:notDownloaded'),
			},
			{
				name: 'Local API',
				group: t('nav:sampleRows.automate'),
				status: t('nav:sampleStatus.alert'),
				geo: '127.0.0.1',
				last: t('nav:sampleRows.notStarted'),
			},
		],
	}),
};

export function getWorkspaceSection(id: NavItem['id']): NavSection {
	return WORKSPACE_SECTION_BUILDERS[id]();
}

export function getWorkspaceSections(): Record<NavItem['id'], NavSection> {
	return {
		dashboard: getWorkspaceSection('dashboard'),
		profiles: getWorkspaceSection('profiles'),
		plugins: getWorkspaceSection('plugins'),
		groups: getWorkspaceSection('groups'),
		proxy: getWorkspaceSection('proxy'),
		windows: getWorkspaceSection('windows'),
		'browser-control': getWorkspaceSection('browser-control'),
		automation: getWorkspaceSection('automation'),
		'ai-chat': getWorkspaceSection('ai-chat'),
		settings: getWorkspaceSection('settings'),
	};
}
