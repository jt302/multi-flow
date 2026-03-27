import type { NavItem, NavSection } from './workspace-types';

export const WORKSPACE_SECTIONS: Record<NavItem['id'], NavSection> = {
	dashboard: {
		title: '全局运行总览',
		desc: '聚合展示环境状态、代理健康与窗口同步概况。',
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
	plugins: {
		title: '插件库管理',
		desc: '集中下载、更新、卸载插件，并按筛选条件批量安装到环境。',
		tableTitle: '插件安装样例',
		rows: [
			{ name: 'Proxy Helper', group: '工具类', status: '已下载', geo: '3 个环境', last: '可检查更新' },
			{ name: 'Wallet Demo', group: '钱包类', status: '已下载', geo: '12 个环境', last: '需重启生效' },
			{ name: 'Locale Switcher', group: '调试类', status: '待下载', geo: '未安装', last: '通过扩展 ID 导入' },
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
		title: '窗口同步控制台',
		desc: '管理主从同步、窗口排列、标签页批量动作与文本广播输入。',
		tableTitle: '运行窗口概览',
		rows: [
			{ name: 'AirDrop-001', group: 'AirDrop', status: '运行中', geo: '1 窗口 / 3 标签', last: '刚刚' },
			{ name: 'Brand-UK-02', group: '品牌号', status: '运行中', geo: '2 窗口 / 6 标签', last: '2 分钟前' },
			{ name: 'Farm-DE-11', group: 'Farm', status: '待机', geo: '0 窗口 / 0 标签', last: '离线' },
		],
	},
	automation: {
		title: '自动化',
		desc: '创建并运行 RPA 自动化脚本，通过 CDP 和 Magic Controller 操控浏览器环境。',
		tableTitle: '最近运行记录',
		rows: [],
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
