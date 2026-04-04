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

export function createArrangeWindowsFormSchema() {
	return z.object({
		monitorId: z.string().trim().min(1, i18next.t('window:validation.selectMonitor')),
		mode: z.enum(['grid', 'cascade']),
		gap: z.coerce.number().int().min(0, i18next.t('window:validation.gapNonNegative')),
		width: z.coerce.number().int().positive(i18next.t('window:validation.widthPositive')),
		height: z.coerce.number().int().positive(i18next.t('window:validation.heightPositive')),
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
