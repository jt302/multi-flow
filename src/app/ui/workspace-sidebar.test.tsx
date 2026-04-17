import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import { AI_CHAT_PATHS, PROFILES_DEVICE_PRESETS_PATH, SETTINGS_PATHS } from '@/app/workspace-routes';
import { Sidebar, SidebarProvider } from '@/components/ui';
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

function renderSidebar(params: {
	defaultOpen: boolean;
	activeNav?: 'profiles' | 'settings' | 'windows' | 'ai-chat';
	activePath?: string;
}) {
	const queryClient = new QueryClient();
	return renderToStaticMarkup(
		<MemoryRouter>
			<QueryClientProvider client={queryClient}>
				<SidebarProvider defaultOpen={params.defaultOpen}>
					<Sidebar variant="floating" collapsible="icon">
						<WorkspaceSidebar
							activeNav={params.activeNav ?? 'profiles'}
							activePath={params.activePath ?? '/profiles'}
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
	const html = renderSidebar({ defaultOpen: false });

	assert.doesNotMatch(html, />Workspace</);
	assert.doesNotMatch(html, />总览</);
	assert.match(html, /aria-label="总览"/);
	assert.match(html, /data-slot="dropdown-menu-trigger"/);
	assert.doesNotMatch(html, />流程管理</);
	assert.doesNotMatch(html, />任务管理</);
	assert.doesNotMatch(html, />运行记录</);
});

test('workspace sidebar 在展开态不再展示 RPA 状态或子菜单', () => {
	const html = renderSidebar({
		defaultOpen: true,
		activeNav: 'windows',
		activePath: '/windows',
	});

	assert.doesNotMatch(html, />RPA 状态</);
	assert.doesNotMatch(html, />流程管理</);
	assert.doesNotMatch(html, />任务管理</);
	assert.doesNotMatch(html, />运行记录</);
	assert.doesNotMatch(html, />机型映射</);
	assert.doesNotMatch(html, />通用</);
	assert.doesNotMatch(html, />外观</);
	assert.doesNotMatch(html, />资源</);
	assert.doesNotMatch(html, />AI 配置</);
	assert.doesNotMatch(html, />回收站</);
});

test('workspace sidebar 在展开态展示设置子菜单并高亮当前设置子路由', () => {
	const html = renderSidebar({
		defaultOpen: true,
		activeNav: 'settings',
		activePath: SETTINGS_PATHS.general,
	});

	assert.match(html, />设置</);
	assert.match(html, />通用</);
	assert.match(html, />外观</);
	assert.match(html, />资源</);
	assert.match(html, />AI 配置</);
	assert.match(html, />回收站</);
});

test('workspace sidebar 在展开态命中环境子路由时展示对应子菜单', () => {
	const html = renderSidebar({
		defaultOpen: true,
		activeNav: 'profiles',
		activePath: PROFILES_DEVICE_PRESETS_PATH,
	});

	assert.match(html, />环境</);
	assert.match(html, />机型映射</);
});

test('workspace sidebar 在展开态展示环境列表与机型映射子菜单', () => {
	const html = renderSidebar({
		defaultOpen: true,
		activeNav: 'profiles',
		activePath: '/profiles',
	});

	assert.match(html, />环境列表</);
	assert.match(html, />机型映射</);
});

test('workspace sidebar footer padding keeps vertical spacing aligned with horizontal spacing', () => {
	const file = readFileSync(new URL('./workspace-sidebar.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("SidebarFooter className={cn('p-3 pt-1', collapsed && 'p-2 pt-1')}"), false);
	assert.equal(file.includes("SidebarFooter className={cn('p-3', collapsed && 'p-2')}"), true);
});

test('workspace sidebar 在展开态展示 AI 助手子菜单', () => {
	const html = renderSidebar({
		defaultOpen: true,
		activeNav: 'ai-chat',
		activePath: AI_CHAT_PATHS.sessions,
	});

	assert.match(html, />AI 助手</);
	assert.match(html, />会话</);
	assert.match(html, />Skills</);
	assert.match(html, />文件系统</);
	assert.match(html, />MCP</);
});

test('sidebar footer status card keeps top and bottom spacing aligned with horizontal padding', () => {
	const file = readFileSync(new URL('./sidebar-footer-status.tsx', import.meta.url), 'utf8');

	assert.equal(
		file.includes('Card className="border-sidebar-border/40 bg-sidebar-accent/30 shadow-sm transition-all duration-300"'),
		false,
	);
	assert.equal(
		file.includes('Card className="gap-3 border-sidebar-border/40 bg-sidebar-accent/30 px-3 py-3 shadow-sm transition-all duration-300"'),
		true,
	);
	assert.equal(file.includes('CardHeader className="p-2 pb-1"'), false);
	assert.equal(file.includes('CardHeader className="px-0 py-0"'), true);
	assert.equal(file.includes('CardContent className="flex flex-col gap-0.5 p-2 pt-0"'), false);
	assert.equal(file.includes('CardContent className="flex flex-col gap-0.5 px-0 py-0"'), true);
});

test('workspace sidebar keeps multiple expandable sections open instead of single-open accordion state', () => {
	const file = readFileSync(new URL('./workspace-sidebar.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('const [expandedNavIds, setExpandedNavIds] ='), true);
	assert.equal(file.includes('setExpandedNavIds((current) =>'), true);
	assert.equal(file.includes('resolveNextExpandedNavIds(current, item.id)'), true);
});
