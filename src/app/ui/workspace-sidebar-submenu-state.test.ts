import assert from 'node:assert/strict';
import test from 'node:test';

import { getWorkspaceNavItems } from '@/app/model/workspace-nav-items';
import { PROFILES_DEVICE_PRESETS_PATH, SETTINGS_PATHS } from '@/app/workspace-routes';

import {
	findAutoExpandedNavId,
	mergeExpandedNavIds,
	resolveNextExpandedNavIds,
} from './workspace-sidebar-submenu-state.ts';

test('findAutoExpandedNavId 在设置子路由下默认展开 settings', () => {
	assert.equal(
		findAutoExpandedNavId(getWorkspaceNavItems(), SETTINGS_PATHS.general),
		'settings',
	);
});

test('findAutoExpandedNavId 在环境子路由下默认展开 profiles', () => {
	assert.equal(
		findAutoExpandedNavId(getWorkspaceNavItems(), PROFILES_DEVICE_PRESETS_PATH),
		'profiles',
	);
});

test('findAutoExpandedNavId 在普通顶级路由下按子入口定义自动展开父级', () => {
	assert.equal(findAutoExpandedNavId(getWorkspaceNavItems(), '/profiles'), 'profiles');
	assert.equal(findAutoExpandedNavId(getWorkspaceNavItems(), '/windows'), null);
});

test('resolveNextExpandedNavIds 重复点击同一个父级时执行展开再收起', () => {
	assert.deepEqual(resolveNextExpandedNavIds([], 'settings'), ['settings']);
	assert.deepEqual(resolveNextExpandedNavIds(['settings'], 'settings'), []);
});

test('resolveNextExpandedNavIds 切换不同父级时保留已展开父级', () => {
	assert.deepEqual(resolveNextExpandedNavIds(['profiles'], 'settings'), ['profiles', 'settings']);
	assert.deepEqual(resolveNextExpandedNavIds(['settings', 'profiles'], 'profiles'), ['settings']);
});

test('mergeExpandedNavIds 自动展开当前父级时不会清空其他已展开父级', () => {
	assert.deepEqual(mergeExpandedNavIds(['profiles'], 'settings'), ['profiles', 'settings']);
	assert.deepEqual(mergeExpandedNavIds(['profiles'], null), ['profiles']);
});
