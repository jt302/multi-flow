import assert from 'node:assert/strict';
import test from 'node:test';

import {
	parseSidebarOpenFromCookie,
	resolveInitialSidebarOpen,
} from './workspace-sidebar-state.ts';

test('parseSidebarOpenFromCookie 解析 true/false', () => {
	assert.equal(parseSidebarOpenFromCookie('sidebar_state=true; theme=light'), true);
	assert.equal(parseSidebarOpenFromCookie('foo=bar; sidebar_state=false'), false);
});

test('resolveInitialSidebarOpen 优先使用 cookie，再回退 localStorage', () => {
	assert.equal(
		resolveInitialSidebarOpen({
			cookieText: 'sidebar_state=false',
			storageValue: 'true',
		}),
		false,
	);
	assert.equal(
		resolveInitialSidebarOpen({
			cookieText: '',
			storageValue: 'false',
		}),
		false,
	);
	assert.equal(
		resolveInitialSidebarOpen({
			cookieText: '',
			storageValue: null,
		}),
		true,
	);
});
