import assert from 'node:assert/strict';
import process from 'node:process';

import {
	flattenControlFlowTree,
	resolveControlFlowGraph,
} from '../src/features/automation-canvas/model/canvas-helpers.ts';
import type { ScriptStep } from '../src/entities/automation/model/types.ts';

function assertRoundTrip(name: string, steps: ScriptStep[]) {
	const { flatSteps, edges } = flattenControlFlowTree(steps);
	const resolved = resolveControlFlowGraph(flatSteps, edges);
	assert.deepStrictEqual(
		resolved,
		steps,
		`${name} round-trip mismatch\nexpected=${JSON.stringify(steps, null, 2)}\nactual=${JSON.stringify(resolved, null, 2)}`,
	);
}

const cases: Array<{ name: string; steps: ScriptStep[] }> = [
	{
		name: 'condition dual branches with shared tail',
		steps: [
			{ kind: 'print', text: 'start' },
			{
				kind: 'condition',
				condition_expr: '{{ok}}',
				then_steps: [{ kind: 'print', text: 'then branch' }],
				else_steps: [{ kind: 'print', text: 'else branch' }],
			},
			{ kind: 'print', text: 'after condition' },
		],
	},
	{
		name: 'confirm dialog sparse button branches',
		steps: [
			{
				kind: 'confirm_dialog',
				title: 'Sparse',
				message: 'pick one',
				buttons: [
					{ text: '继续', value: 'confirm', variant: 'default' },
					{ text: '取消', value: 'cancel', variant: 'outline' },
				],
				button_branches: [
					[],
					[{ kind: 'end' }],
				],
				confirm_text: '继续',
				cancel_text: '取消',
				on_timeout: 'cancel',
			},
			{ kind: 'print', text: 'after dialog' },
		],
	},
	{
		name: 'condition + confirm dialog + shared tail',
		steps: [
			{ kind: 'magic_close_inactive_tabs' },
			{ kind: 'cdp_navigate', url: 'https://www.google.com/' },
			{ kind: 'cdp_reload', ignore_cache: false },
			{ kind: 'cdp_click', selector: 'x', selector_type: 'xpath' },
			{ kind: 'cdp_type', selector: 'x', text: 'Claude code download', selector_type: 'xpath' },
			{ kind: 'cdp_shortcut', modifiers: ['meta'], key: 'a' },
			{ kind: 'wait', ms: 3000 },
			{ kind: 'cdp_press_key', key: 'Enter' },
			{ kind: 'cdp_wait_for_page_load', timeout_ms: 30000 },
			{ kind: 'ai_judge', prompt: '是否遇到人机验证', output_mode: 'boolean', max_steps: 5, output_key: 'is_done' },
			{
				kind: 'condition',
				condition_expr: '{{is_done}}',
				then_steps: [
					{
						kind: 'confirm_dialog',
						title: '人机验证',
						message: '请进行人机验证',
						buttons: [
							{ text: '已完成', value: 'confirm', variant: 'default' },
							{ text: '取消', value: 'cancel', variant: 'default' },
						],
						button_branches: [
							[],
							[{ kind: 'end' }],
						],
						confirm_text: '确认完成',
						cancel_text: '取消',
						on_timeout: 'cancel',
					},
					{
						kind: 'cdp_screenshot',
						output_path: '/Users/tt/Documents/search.png',
						output_key_file_path: 'success_png_path',
					},
					{
						kind: 'confirm_dialog',
						title: '成功',
						message: '成功获取到搜索结果 截图已保存到{{success_png_path}}',
						buttons: [
							{ text: '确认', value: 'confirm', variant: 'default' },
							{ text: '取消', value: 'cancel', variant: 'outline' },
						],
						confirm_text: '确认',
						cancel_text: '取消',
						on_timeout: 'cancel',
					},
					{ kind: 'magic_safe_quit' },
				],
				else_steps: [
					{
						kind: 'cdp_screenshot',
						output_path: '/Users/tt/Documents/search.png',
						output_key_file_path: 'success_png_path',
					},
					{
						kind: 'confirm_dialog',
						title: '成功',
						message: '成功获取到搜索结果 截图已保存到{{success_png_path}}',
						buttons: [
							{ text: '确认', value: 'confirm', variant: 'default' },
							{ text: '取消', value: 'cancel', variant: 'outline' },
						],
						confirm_text: '确认',
						cancel_text: '取消',
						on_timeout: 'cancel',
					},
				],
			},
		],
	},
	{
		name: 'human verification flow with explicit button branches',
		steps: [
			{ kind: 'magic_close_inactive_tabs' },
			{ kind: 'cdp_navigate', url: 'https://www.google.com/' },
			{ kind: 'cdp_reload', ignore_cache: false },
			{ kind: 'cdp_click', selector: 'x', selector_type: 'xpath' },
			{
				kind: 'cdp_type',
				selector: 'x',
				text: 'github copilot subscription',
				selector_type: 'xpath',
			},
			{ kind: 'cdp_shortcut', modifiers: ['meta'], key: 'a' },
			{ kind: 'wait', ms: 3000 },
			{ kind: 'cdp_press_key', key: 'Enter' },
			{ kind: 'cdp_wait_for_page_load', timeout_ms: 30000 },
			{
				kind: 'ai_judge',
				prompt: '是否遇到人机验证',
				output_mode: 'boolean',
				max_steps: 5,
				output_key: 'is_done',
			},
			{
				kind: 'condition',
				condition_expr: '{{is_done}}',
				then_steps: [
					{
						kind: 'confirm_dialog',
						title: '人机验证',
						message: '请进行人机验证',
						buttons: [
							{ text: '已完成', value: 'confirm', variant: 'default' },
							{ text: '取消', value: 'cancel', variant: 'default' },
						],
						button_branches: [
							[
								{
									kind: 'cdp_screenshot',
									output_path: '/Users/tt/Documents/search.png',
									output_key_file_path: 'success_png_path',
								},
								{
									kind: 'confirm_dialog',
									title: '成功',
									message: '成功获取到搜索结果 截图已保存到{{success_png_path}}',
									buttons: [
										{ text: '确认', value: 'confirm', variant: 'default' },
										{ text: '取消', value: 'cancel', variant: 'outline' },
									],
									confirm_text: '确认',
									cancel_text: '取消',
									on_timeout: 'cancel',
								},
								{ kind: 'magic_safe_quit' },
							],
							[{ kind: 'end' }],
						],
						confirm_text: '确认完成',
						cancel_text: '取消',
						on_timeout: 'cancel',
					},
				],
				else_steps: [
					{
						kind: 'cdp_screenshot',
						output_path: '/Users/tt/Documents/search.png',
						output_key_file_path: 'success_png_path',
					},
					{
						kind: 'confirm_dialog',
						title: '成功',
						message: '成功获取到搜索结果 截图已保存到{{success_png_path}}',
						buttons: [
							{ text: '确认', value: 'confirm', variant: 'default' },
							{ text: '取消', value: 'cancel', variant: 'outline' },
						],
						confirm_text: '确认',
						cancel_text: '取消',
						on_timeout: 'cancel',
					},
				],
			},
		],
	},
];

let failed = false;

for (const testCase of cases) {
	try {
		assertRoundTrip(testCase.name, testCase.steps);
		console.log(`PASS ${testCase.name}`);
	} catch (error) {
		failed = true;
		console.error(`FAIL ${testCase.name}`);
		console.error(error instanceof Error ? error.message : error);
	}
}

if (failed) {
	process.exitCode = 1;
}
