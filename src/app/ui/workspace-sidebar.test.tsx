import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { initReactI18next } from 'react-i18next';

import { Sidebar, SidebarProvider } from '@/components/ui';
import { SETTINGS_PATHS } from '@/app/workspace-routes';
import zhCommon from '@/shared/i18n/locales/zh-CN/common.json';
import zhNav from '@/shared/i18n/locales/zh-CN/nav.json';
import zhSettings from '@/shared/i18n/locales/zh-CN/settings.json';
import { WorkspaceSidebar } from './workspace-sidebar';

await i18n.use(initReactI18next).init({
	lng: 'zh-CN',
	fallbackLng: 'zh-CN',
	defaultNS: 'common',
	resources: {
		'zh-CN': {
			common: zhCommon,
			nav: zhNav,
			settings: zhSettings,
		},
	},
	interpolation: {
		escapeValue: false,
	},
});

function renderSidebar(defaultOpen: boolean) {
	const queryClient = new QueryClient();
	return renderToStaticMarkup(
		<MemoryRouter>
			<QueryClientProvider client={queryClient}>
				<SidebarProvider defaultOpen={defaultOpen}>
					<Sidebar variant="floating" collapsible="icon">
						<WorkspaceSidebar
							activeNav="profiles"
							activePath="/profiles"
							onNavChange={() => {}}
							onNavigate={() => {}}
						/>
					</Sidebar>
				</SidebarProvider>
			</QueryClientProvider>
		</MemoryRouter>,
	);
}

test('workspace sidebar 在折叠态包含专用布局类', () => {
	const html = renderSidebar(false);

	assert.doesNotMatch(html, />Workspace</);
	assert.doesNotMatch(html, />总览</);
	assert.match(html, /aria-label="总览"/);
	assert.doesNotMatch(html, />流程管理</);
	assert.doesNotMatch(html, />任务管理</);
	assert.doesNotMatch(html, />运行记录</);
});

test('workspace sidebar 在展开态不再展示 RPA 状态或子菜单', () => {
	const queryClient = new QueryClient();
	const html = renderToStaticMarkup(
		<MemoryRouter>
			<QueryClientProvider client={queryClient}>
				<SidebarProvider defaultOpen>
					<Sidebar variant="floating" collapsible="icon">
						<WorkspaceSidebar
							activeNav="windows"
							activePath="/windows"
							onNavChange={() => {}}
							onNavigate={() => {}}
						/>
					</Sidebar>
				</SidebarProvider>
			</QueryClientProvider>
		</MemoryRouter>,
	);

	assert.doesNotMatch(html, />RPA 状态</);
	assert.doesNotMatch(html, />流程管理</);
	assert.doesNotMatch(html, />任务管理</);
	assert.doesNotMatch(html, />运行记录</);
});

test('workspace sidebar 在展开态展示设置子菜单并高亮当前设置子路由', () => {
	const queryClient = new QueryClient();
	const html = renderToStaticMarkup(
		<MemoryRouter>
			<QueryClientProvider client={queryClient}>
				<SidebarProvider defaultOpen>
					<Sidebar variant="floating" collapsible="icon">
						<WorkspaceSidebar
							activeNav="settings"
							activePath={SETTINGS_PATHS.general}
							onNavChange={() => {}}
							onNavigate={() => {}}
						/>
					</Sidebar>
				</SidebarProvider>
			</QueryClientProvider>
		</MemoryRouter>,
	);

	assert.match(html, />设置</);
	assert.match(html, />通用</);
	assert.match(html, />外观</);
	assert.match(html, />资源</);
	assert.match(html, />AI 配置</);
	assert.match(html, />回收站</);
});
