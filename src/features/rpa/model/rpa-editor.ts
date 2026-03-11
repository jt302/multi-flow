import { z } from 'zod/v3';

import type { RpaFlowDefinitionItem } from '@/entities/rpa/model/types';

export const rpaFlowMetaSchema = z.object({
	name: z.string().trim().min(1, '请输入流程名称'),
	note: z.string().optional(),
	concurrencyLimit: z.coerce.number().int().min(1).max(5),
	variablesText: z.string(),
});

export const rpaNodeConfigSchema = z.object({
	configText: z
		.string()
		.trim()
		.min(2, '请输入 JSON 配置')
		.superRefine((value, ctx) => {
			try {
				const parsed = JSON.parse(value);
				if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: '节点配置必须是 JSON 对象',
					});
				}
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: '节点配置不是合法 JSON',
				});
			}
		}),
});

export type RpaNodeConfigFieldType = 'string' | 'number' | 'boolean' | 'enum';

export type RpaNodeConfigFieldGuide = {
	key: string;
	label: string;
	type: RpaNodeConfigFieldType;
	required: boolean;
	description: string;
	options?: string[];
	example?: string | number | boolean;
};

export type RpaNodeConfigGuide = {
	kind: string;
	label: string;
	summary: string;
	fields: RpaNodeConfigFieldGuide[];
	template: Record<string, unknown>;
};

const NODE_CONFIG_GUIDES: Record<string, RpaNodeConfigGuide> = {
	open_profile: {
		kind: 'open_profile',
		label: '打开环境',
		summary: '使用当前实例 profile 启动浏览器环境，无需额外字段。',
		fields: [],
		template: {},
	},
	goto_url: {
		kind: 'goto_url',
		label: '访问页面',
		summary: '访问指定 URL，支持使用 {{变量名}} 模板语法。',
		fields: [
			{
				key: 'url',
				label: '页面 URL',
				type: 'string',
				required: true,
				description: '完整地址，支持 http/https 和模板变量。',
				example: 'https://example.com/search?q={{keyword}}',
			},
		],
		template: {
			url: 'https://example.com',
		},
	},
	wait_for_selector: {
		kind: 'wait_for_selector',
		label: '等待元素',
		summary: '轮询等待元素出现，超时会使节点失败。',
		fields: [
			{
				key: 'selector',
				label: 'CSS 选择器',
				type: 'string',
				required: true,
				description: '如 #submit、.login-form button。',
				example: '#submit',
			},
			{
				key: 'timeoutMs',
				label: '超时毫秒',
				type: 'number',
				required: false,
				description: '默认 5000。',
				example: 8000,
			},
		],
		template: {
			selector: '#submit',
			timeoutMs: 5000,
		},
	},
	click_element: {
		kind: 'click_element',
		label: '点击元素',
		summary: '定位元素并触发点击。',
		fields: [
			{
				key: 'selector',
				label: 'CSS 选择器',
				type: 'string',
				required: true,
				description: '目标元素选择器。',
				example: 'button[type="submit"]',
			},
		],
		template: {
			selector: 'button[type="submit"]',
		},
	},
	input_text: {
		kind: 'input_text',
		label: '输入文本',
		summary: '点击输入框并输入文本，支持 {{变量名}}。',
		fields: [
			{
				key: 'selector',
				label: 'CSS 选择器',
				type: 'string',
				required: true,
				description: '输入框选择器。',
				example: 'input[name="email"]',
			},
			{
				key: 'text',
				label: '输入文本',
				type: 'string',
				required: true,
				description: '可包含模板变量。',
				example: '{{email}}',
			},
		],
		template: {
			selector: 'input[name="email"]',
			text: '{{email}}',
		},
	},
	extract_text: {
		kind: 'extract_text',
		label: '提取文本',
		summary: '读取元素文本并写入上下文变量。',
		fields: [
			{
				key: 'selector',
				label: 'CSS 选择器',
				type: 'string',
				required: true,
				description: '文本来源元素。',
				example: '.price',
			},
			{
				key: 'variableKey',
				label: '变量名',
				type: 'string',
				required: true,
				description: '提取结果写入该变量。',
				example: 'price',
			},
		],
		template: {
			selector: '.price',
			variableKey: 'price',
		},
	},
	branch: {
		kind: 'branch',
		label: '条件分支',
		summary: '比较上下文变量，输出 true/false 连线。',
		fields: [
			{
				key: 'variableKey',
				label: '变量名',
				type: 'string',
				required: true,
				description: '待比较的上下文变量键。',
				example: 'status',
			},
			{
				key: 'operator',
				label: '比较运算符',
				type: 'enum',
				required: false,
				description: '默认 equals。',
				options: ['equals', 'not_equals', 'contains', 'exists'],
				example: 'equals',
			},
			{
				key: 'value',
				label: '比较值',
				type: 'string',
				required: false,
				description: 'operator=exists 时可省略。',
				example: 'success',
			},
		],
		template: {
			variableKey: 'status',
			operator: 'equals',
			value: 'success',
		},
	},
	manual_gate: {
		kind: 'manual_gate',
		label: '人工接管',
		summary: '运行到此会进入人工处理态，等待继续。',
		fields: [],
		template: {},
	},
	success_end: {
		kind: 'success_end',
		label: '成功结束',
		summary: '流程成功结束节点，无需额外字段。',
		fields: [],
		template: {},
	},
	failure_end: {
		kind: 'failure_end',
		label: '失败结束',
		summary: '流程失败结束，可设置错误消息。',
		fields: [
			{
				key: 'message',
				label: '失败消息',
				type: 'string',
				required: false,
				description: '运行记录中的失败说明。',
				example: '页面校验失败',
			},
		],
		template: {
			message: '流程执行失败',
		},
	},
};

export function resolveNodeConfigGuide(kind: string) {
	return (
		NODE_CONFIG_GUIDES[kind] ?? {
			kind,
			label: kind,
			summary: '当前节点暂未内置字段提示，请参考节点执行文档填写 JSON 对象。',
			fields: [],
			template: {},
		}
	);
}

export function validateNodeConfigForKind(
	kind: string,
	config: Record<string, unknown>,
) {
	const guide = resolveNodeConfigGuide(kind);
	const errors: string[] = [];

	for (const field of guide.fields) {
		const value = config[field.key];
		const empty =
			value === undefined ||
			value === null ||
			(typeof value === 'string' && value.trim().length === 0);
		if (field.required && empty) {
			errors.push(`缺少必填字段：${field.label}（${field.key}）`);
			continue;
		}
		if (empty) {
			continue;
		}
		if (field.type === 'string' && typeof value !== 'string') {
			errors.push(`字段 ${field.key} 需要 string`);
			continue;
		}
		if (field.type === 'number' && (typeof value !== 'number' || Number.isNaN(value))) {
			errors.push(`字段 ${field.key} 需要 number`);
			continue;
		}
		if (field.type === 'boolean' && typeof value !== 'boolean') {
			errors.push(`字段 ${field.key} 需要 boolean`);
			continue;
		}
		if (
			field.type === 'enum' &&
			(typeof value !== 'string' ||
				(field.options && !field.options.includes(value)))
		) {
			errors.push(
				`字段 ${field.key} 可选值：${field.options?.join(' / ') ?? '无'}`,
			);
		}
	}

	return errors;
}

export function parseVariablesText(value: string) {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [key, label = key, required = 'false', defaultValue = ''] = line
				.split('|')
				.map((item) => item.trim());
			return {
				key,
				label,
				required: required === 'true',
				defaultValue: defaultValue || null,
			};
		});
}

export function stringifyVariables(definition: RpaFlowDefinitionItem) {
	return definition.variables
		.map((item) => [item.key, item.label, String(item.required), item.defaultValue ?? ''].join('|'))
		.join('\n');
}

export function parseNodeConfigText(value: string) {
	return JSON.parse(value) as Record<string, unknown>;
}
