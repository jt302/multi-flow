import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('theme customizer card 区分预设主题和自定义主题并暴露自定义预设操作', () => {
	const file = readFileSync(new URL('./theme-customizer-card.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes("t('theme.presetSection')"), true);
	assert.equal(file.includes("t('theme.customSection')"), true);
	assert.equal(file.includes("t('theme.switchToPresetTheme')"), true);
	assert.equal(file.includes("t('theme.switchToCustomTheme')"), true);
	assert.equal(file.includes("t('theme.addToCustomPresets')"), true);
	assert.equal(file.includes("t('theme.customPresets')"), true);
	assert.equal(file.includes("t('theme.noCustomPresets')"), true);
	assert.equal(file.includes('onAddCustomPreset'), true);
	assert.equal(file.includes('onApplyCustomPreset'), true);
	assert.equal(file.includes('onDeleteCustomPreset'), true);
	assert.equal(file.includes('customPresets.map'), true);
});

test('theme customizer card 将自定义预设置顶并让自定义主题卡片不再占满宽度', () => {
	const file = readFileSync(new URL('./theme-customizer-card.tsx', import.meta.url), 'utf8');

	assert.equal(file.includes('self-start w-fit max-w-full'), true);
	assert.equal(file.includes('flex flex-nowrap items-center gap-2'), true);
	assert.equal(
		file.indexOf("t('theme.customPresets')") < file.indexOf('id={customColorPickerId}'),
		true,
	);
});

test('theme customizer card 将自定义主色操作行统一为 sm 高度', () => {
	const file = readFileSync(new URL('./theme-customizer-card.tsx', import.meta.url), 'utf8');

	assert.equal(
		file.includes(
			'className="h-8 w-12 shrink-0 cursor-pointer rounded-xl border-border/70 bg-background p-1"',
		),
		true,
	);
	assert.equal(
		file.includes(
			'className="h-8 w-[8.5rem] shrink-0 rounded-xl border-border/70 bg-background uppercase tracking-[0.16em]"',
		),
		true,
	);
	assert.equal(file.includes('size="sm"'), true);
});
