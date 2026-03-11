import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { Sidebar, SidebarProvider } from '@/components/ui';
import { WorkspaceSidebar } from './workspace-sidebar';

function renderSidebar(defaultOpen: boolean) {
	return renderToStaticMarkup(
		<SidebarProvider defaultOpen={defaultOpen}>
			<Sidebar variant="floating" collapsible="icon">
				<WorkspaceSidebar
					activeNav="profiles"
					onNavChange={() => {}}
					isRunning
					onToggleRunning={() => {}}
				/>
			</Sidebar>
		</SidebarProvider>,
	);
}

test('workspace sidebar 在折叠态包含专用布局类', () => {
	const html = renderSidebar(false);

	assert.doesNotMatch(html, />Workspace</);
	assert.doesNotMatch(html, />暂停执行引擎</);
	assert.doesNotMatch(html, />总览</);
	assert.match(html, /aria-label="总览"/);
	assert.match(html, /aria-label="恢复执行引擎"|aria-label="暂停执行引擎"/);
});
