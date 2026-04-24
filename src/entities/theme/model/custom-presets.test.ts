import assert from 'node:assert/strict';
import test from 'node:test';

import {
	addCustomThemePreset,
	normalizeCustomThemePreset,
	removeCustomThemePreset,
} from './custom-presets';

test('normalizeCustomThemePreset 统一输出大写 #RRGGBB 并过滤非法值', () => {
	assert.equal(normalizeCustomThemePreset('#0f8a73'), '#0F8A73');
	assert.equal(normalizeCustomThemePreset('0f8a73'), '#0F8A73');
	assert.equal(normalizeCustomThemePreset('#abc'), '#AABBCC');
	assert.equal(normalizeCustomThemePreset('bad-value'), null);
});

test('addCustomThemePreset 会把新颜色放到最前面并按规范去重', () => {
	assert.deepEqual(addCustomThemePreset(['#AABBCC', '#112233'], '#aabbcc'), ['#AABBCC', '#112233']);

	assert.deepEqual(addCustomThemePreset(['#AABBCC', '#112233'], '#445566'), [
		'#445566',
		'#AABBCC',
		'#112233',
	]);
});

test('removeCustomThemePreset 只移除目标颜色，不影响未删除项', () => {
	assert.deepEqual(removeCustomThemePreset(['#AABBCC', '#112233', '#445566'], '#112233'), [
		'#AABBCC',
		'#445566',
	]);
});
