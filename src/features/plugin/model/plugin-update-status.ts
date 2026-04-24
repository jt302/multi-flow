import type { PluginUpdateStatus } from '@/entities/plugin/model/types';

const STATUS_LABEL_KEYS: Record<PluginUpdateStatus, string> = {
	unknown: 'library.updateStatuses.unknown',
	up_to_date: 'library.updateStatuses.upToDate',
	update_available: 'library.updateStatuses.updateAvailable',
	error: 'library.updateStatuses.error',
};

const STATUS_TOAST_KEYS: Record<PluginUpdateStatus, string> = {
	unknown: 'library.updateCheckToast.unknown',
	up_to_date: 'library.updateCheckToast.upToDate',
	update_available: 'library.updateCheckToast.updateAvailable',
	error: 'library.updateCheckToast.error',
};

const UPDATE_PACKAGE_TOAST_KEYS: Record<PluginUpdateStatus, string> = {
	unknown: 'library.updatePackageToast.statusUnknown',
	up_to_date: 'library.updatePackageToast.updated',
	update_available: 'library.updatePackageToast.stillUpdateAvailable',
	error: 'library.updatePackageToast.statusCheckFailed',
};

const UPDATE_ACTION_LABEL_KEYS: Record<PluginUpdateStatus, string> = {
	unknown: 'library.updatePluginActions.checkAndUpdate',
	up_to_date: 'library.updatePluginActions.redownload',
	update_available: 'library.updatePluginActions.update',
	error: 'library.updatePluginActions.checkAndUpdate',
};

function normalizePluginUpdateStatus(status?: PluginUpdateStatus | null): PluginUpdateStatus {
	return status && status in STATUS_LABEL_KEYS ? status : 'unknown';
}

export function getPluginUpdateStatusLabelKey(status?: PluginUpdateStatus | null) {
	return STATUS_LABEL_KEYS[normalizePluginUpdateStatus(status)];
}

export function getPluginUpdateCheckToastKey(status?: PluginUpdateStatus | null) {
	return STATUS_TOAST_KEYS[normalizePluginUpdateStatus(status)];
}

export function getPluginUpdatePackageToastKey(status?: PluginUpdateStatus | null) {
	return UPDATE_PACKAGE_TOAST_KEYS[normalizePluginUpdateStatus(status)];
}

export function getPluginUpdateActionLabelKey(status?: PluginUpdateStatus | null) {
	return UPDATE_ACTION_LABEL_KEYS[normalizePluginUpdateStatus(status)];
}
