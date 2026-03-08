import {
	Bot,
	FolderKanban,
	Folders,
	Globe2,
	LayoutDashboard,
	PanelsTopLeft,
	Settings2,
} from 'lucide-react';

import type { GroupItem, NavItem, NavSection, Palette, PresetKey } from './types';

export const PRESETS: Record<PresetKey, Palette> = {
	harbor: { light: '#0F8A73', dark: '#56D3BC' },
	olive: { light: '#4C7A38', dark: '#9FDD72' },
	copper: { light: '#B05A2B', dark: '#FF9A66' },
	slate: { light: '#34607C', dark: '#7FC5ED' },
};

export const PRESET_KEYS: PresetKey[] = ['harbor', 'olive', 'copper', 'slate'];

export const NAV_ITEMS: NavItem[] = [
	{ id: 'dashboard', label: '总览', icon: LayoutDashboard },
	{ id: 'profiles', label: '环境', icon: FolderKanban },
	{ id: 'groups', label: '分组', icon: Folders },
	{ id: 'proxy', label: '代理池', icon: Globe2 },
	{ id: 'windows', label: '窗口管理', icon: PanelsTopLeft },
	{ id: 'ai', label: 'AI 执行', icon: Bot },
	{ id: 'settings', label: '设置', icon: Settings2 },
];

export const NAV_SECTIONS: Record<NavItem['id'], NavSection> = {
	dashboard: {
		title: '全局运行总览',
		desc: '聚合展示环境状态、代理健康与 AI 执行统计。',
		tableTitle: '最近活跃会话',
		rows: [
			{ name: 'AirDrop-001', group: 'AirDrop', status: '运行中', geo: 'US / New York', last: '刚刚' },
			{ name: 'AirDrop-002', group: 'AirDrop', status: '待机', geo: 'DE / Frankfurt', last: '12 分钟前' },
			{ name: 'Brand-TikTok-01', group: '品牌号', status: '告警', geo: 'GB / London', last: '3 分钟前' },
		],
	},
	profiles: {
		title: '环境工作台',
		desc: '按分组管理 Profile，执行批量启动、停用和状态巡检。',
		tableTitle: '环境会话',
		rows: [
			{ name: 'AirDrop-001', group: 'AirDrop', status: '运行中', geo: 'US / New York', last: '刚刚' },
			{ name: 'AirDrop-002', group: 'AirDrop', status: '待机', geo: 'DE / Frankfurt', last: '12 分钟前' },
			{ name: 'Brand-TikTok-01', group: '品牌号', status: '告警', geo: 'GB / London', last: '3 分钟前' },
		],
	},
	groups: {
		title: '分组管理',
		desc: '统一管理业务分组、备注与归档策略，创建环境时可直接关联。',
		tableTitle: '分组成员样例',
		rows: [
			{ name: 'AirDrop-US', group: 'AirDrop', status: '运行中', geo: 'US / New York', last: '刚刚' },
			{ name: 'Farm-DE', group: 'Farm', status: '待机', geo: 'DE / Frankfurt', last: '10 分钟前' },
			{ name: 'Brand-GB', group: 'Brand', status: '告警', geo: 'GB / London', last: '2 分钟前' },
		],
	},
	proxy: {
		title: '代理池监控',
		desc: '追踪代理可用率、地区分布与最近失败记录。',
		tableTitle: '代理关联会话',
		rows: [
			{ name: 'Proxy-US-01', group: '住宅代理', status: '运行中', geo: 'US / New York', last: '1 分钟前' },
			{ name: 'Proxy-DE-11', group: '机房代理', status: '待机', geo: 'DE / Frankfurt', last: '9 分钟前' },
			{ name: 'Proxy-GB-03', group: '住宅代理', status: '告警', geo: 'GB / London', last: '刚刚' },
		],
	},
	windows: {
		title: '窗口与标签页控制台',
		desc: '对运行中的环境执行单个或批量窗口/标签页操作，并集中查看会话结构。',
		tableTitle: '运行窗口概览',
		rows: [
			{ name: 'AirDrop-001', group: 'AirDrop', status: '运行中', geo: '1 窗口 / 3 标签', last: '刚刚' },
			{ name: 'Brand-UK-02', group: '品牌号', status: '运行中', geo: '2 窗口 / 6 标签', last: '2 分钟前' },
			{ name: 'Farm-DE-11', group: 'Farm', status: '待机', geo: '0 窗口 / 0 标签', last: '离线' },
		],
	},
	ai: {
		title: 'AI 执行中心',
		desc: '自然语言任务编排正在运行，异常节点会自动暂停等待处理。',
		tableTitle: 'AI 任务会话',
		rows: [
			{ name: 'Airdrop Batch #12', group: '自动任务', status: '运行中', geo: 'US / New York', last: '刚刚' },
			{ name: 'Farm Mission #4', group: '自动任务', status: '待机', geo: 'DE / Frankfurt', last: '18 分钟前' },
			{ name: 'Captcha Queue #2', group: '人工接管', status: '告警', geo: 'GB / London', last: '2 分钟前' },
		],
	},
	settings: {
		title: '系统设置',
		desc: '管理主题、资源版本策略和运行参数的默认行为。',
		tableTitle: '系统关键状态',
		rows: [
			{ name: 'Chromium 144.0.7559.97', group: '资源版本', status: '运行中', geo: 'AppData', last: '已安装' },
			{ name: 'GeoLite2-City', group: '地理库', status: '待机', geo: '可选启用', last: '未下载' },
			{ name: 'Local API', group: '自动化', status: '告警', geo: '127.0.0.1', last: '未启动' },
		],
	},
};

export const DEFAULT_GROUPS: GroupItem[] = [
	{
		id: 'g_airdrop',
		name: 'AirDrop',
		note: '空投批量任务',
		profileCount: 12,
		updatedAt: '刚刚',
		lifecycle: 'active',
		deletedAt: null,
	},
	{
		id: 'g_farm',
		name: 'Farm',
		note: '收益农场矩阵',
		profileCount: 8,
		updatedAt: '8 分钟前',
		lifecycle: 'active',
		deletedAt: null,
	},
	{
		id: 'g_brand',
		name: 'Brand',
		note: '品牌账号运营',
		profileCount: 5,
		updatedAt: '20 分钟前',
		lifecycle: 'active',
		deletedAt: null,
	},
];
