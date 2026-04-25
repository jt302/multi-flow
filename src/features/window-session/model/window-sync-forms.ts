import i18next from 'i18next';
import { z } from 'zod/v3';

export function createSyncTextFormSchema() {
	return z.object({
		text: z.string().trim().min(1, i18next.t('window:validation.textRequired')),
	});
}
export const syncTextFormSchema = createSyncTextFormSchema();
export type SyncTextFormValues = z.infer<ReturnType<typeof createSyncTextFormSchema>>;

export function createWindowBoundsBatchFormSchema() {
	return z.object({
		width: z.coerce.number().int().positive(i18next.t('window:validation.widthPositive')),
		height: z.coerce.number().int().positive(i18next.t('window:validation.heightPositive')),
	});
}
export const windowBoundsBatchFormSchema = createWindowBoundsBatchFormSchema();

function emptyToUndefined(value: unknown) {
	return value === '' || value === null ? undefined : value;
}

export function createArrangeWindowsFormSchema() {
	const optionalPositiveInt = z.preprocess(
		emptyToUndefined,
		z.coerce.number().int().positive().optional(),
	);
	const optionalAutoPositiveInt = z.preprocess(
		emptyToUndefined,
		z.union([z.literal('auto'), z.coerce.number().int().positive()]).optional(),
	);

	return z
		.object({
			monitorId: z.string().trim().min(1, i18next.t('window:validation.selectMonitor')),
			mode: z.enum(['grid', 'cascade', 'main_with_sidebar']),
			// grid 专用
			rows: optionalAutoPositiveInt,
			columns: optionalAutoPositiveInt,
			gapX: z.coerce.number().int().min(0).default(16),
			gapY: z.coerce.number().int().min(0).default(16),
			paddingTop: z.coerce.number().int().min(0).default(12),
			paddingRight: z.coerce.number().int().min(0).default(12),
			paddingBottom: z.coerce.number().int().min(0).default(12),
			paddingLeft: z.coerce.number().int().min(0).default(12),
			lastRowAlign: z.enum(['start', 'center', 'stretch']).default('start'),
			flow: z.enum(['row_major', 'col_major']).default('row_major'),
			// cascade 专用
			width: optionalPositiveInt,
			height: optionalPositiveInt,
			cascadeStep: z.coerce.number().int().min(8).default(32),
			// mainWithSidebar 专用
			mainRatio: z.coerce.number().min(0.2).max(0.9).default(0.66),
			mainPosition: z.enum(['left', 'right', 'top', 'bottom']).default('left'),
			// 通用
			order: z.enum(['selection', 'name']).default('selection'),
			chromeDecorationCompensation: z.enum(['auto', 'off']).default('auto'),
		})
		.superRefine((data, ctx) => {
			if (data.mode === 'cascade') {
				if (!data.width) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: i18next.t('window:validation.widthPositive'),
						path: ['width'],
					});
				}
				if (!data.height) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: i18next.t('window:validation.heightPositive'),
						path: ['height'],
					});
				}
			}
		});
}
export const arrangeWindowsFormSchema = createArrangeWindowsFormSchema();

export function getWindowSyncStartValidation(
	selectedProfileIds: string[],
	masterProfileId: string | null,
) {
	if (!masterProfileId) {
		return { ok: false, reason: i18next.t('window:validation.selectMaster') };
	}
	if (selectedProfileIds.length < 2) {
		return { ok: false, reason: i18next.t('window:validation.needMasterAndSlave') };
	}
	if (!selectedProfileIds.includes(masterProfileId)) {
		return { ok: false, reason: i18next.t('window:validation.masterInSelected') };
	}

	return { ok: true, reason: null };
}
