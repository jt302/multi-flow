import { z } from 'zod/v3';

export const syncTextFormSchema = z.object({
	text: z.string().trim().min(1, '请输入要同步的文本'),
});

export const windowBoundsBatchFormSchema = z.object({
	width: z.coerce.number().int().positive('宽度必须大于 0'),
	height: z.coerce.number().int().positive('高度必须大于 0'),
});

export const arrangeWindowsFormSchema = z.object({
	monitorId: z.string().trim().min(1, '请选择显示器'),
	mode: z.enum(['grid', 'cascade']),
	gap: z.coerce.number().int().min(0, '窗口间距不能小于 0'),
	width: z.coerce.number().int().positive('宽度必须大于 0'),
	height: z.coerce.number().int().positive('高度必须大于 0'),
});

export function getWindowSyncStartValidation(
	selectedProfileIds: string[],
	masterProfileId: string | null,
) {
	if (!masterProfileId) {
		return { ok: false, reason: '请选择主控环境' };
	}
	if (selectedProfileIds.length < 2) {
		return { ok: false, reason: '至少需要 1 个主控和 1 个从控' };
	}
	if (!selectedProfileIds.includes(masterProfileId)) {
		return { ok: false, reason: '主控环境必须在已选列表中' };
	}

	return { ok: true, reason: null };
}
