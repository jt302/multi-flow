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
