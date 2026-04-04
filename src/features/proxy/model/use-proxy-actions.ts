import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
	batchCheckProxies as batchCheckProxiesApi,
	batchDeleteProxies as batchDeleteProxiesApi,
	batchUpdateProxies as batchUpdateProxiesApi,
	bindProfileProxy as bindProfileProxyApi,
	checkProxy as checkProxyApi,
	createProxy as createProxyApi,
	deleteProxy as deleteProxyApi,
	importProxies as importProxiesApi,
	purgeProxy as purgeProxyApi,
	restoreProxy as restoreProxyApi,
	unbindProfileProxy as unbindProfileProxyApi,
	updateProxy as updateProxyApi,
} from '@/entities/proxy/api/proxy-api';
import type {
	CreateProxyPayload,
	ImportProxiesPayload,
	UpdateProxyPayload,
} from '@/entities/proxy/model/types';

type ProxyActionsDeps = {
	refreshProxies: () => Promise<void>;
	refreshProfilesAndBindings: () => Promise<void>;
};

export function useProxyActions({
	refreshProxies,
	refreshProfilesAndBindings,
}: ProxyActionsDeps) {
	const { t } = useTranslation(['proxy', 'common']);
	const createProxy = async (payload: CreateProxyPayload) => {
		try {
			await createProxyApi(payload);
			await refreshProxies();
			toast.success(t('proxy:actions.created'));
		} catch (error) {
			toast.error(t('proxy:actions.createFailed'));
			throw error;
		}
	};

	const updateProxy = async (proxyId: string, payload: UpdateProxyPayload) => {
		try {
			await updateProxyApi(proxyId, payload);
			await refreshProxies();
			toast.success(t('proxy:actions.updated'));
		} catch (error) {
			toast.error(t('proxy:actions.updateFailed'));
			throw error;
		}
	};

	const deleteProxy = async (proxyId: string) => {
		try {
			await deleteProxyApi(proxyId);
			await Promise.all([refreshProxies(), refreshProfilesAndBindings()]);
			toast.success(t('proxy:actions.deleted'));
		} catch (error) {
			toast.error(t('proxy:actions.deleteFailed'));
			throw error;
		}
	};

	const batchDeleteProxies = async (proxyIds: string[]) => {
		try {
			const result = await batchDeleteProxiesApi(proxyIds);
			await Promise.all([refreshProxies(), refreshProfilesAndBindings()]);
			toast.success(t('common:batchResult', { action: t('proxy:actions.batchDelete'), success: result.successCount, fail: result.failedCount }));
			return result;
		} catch (error) {
			toast.error(t('proxy:actions.batchDeleteFailed'));
			throw error;
		}
	};

	const restoreProxy = async (proxyId: string) => {
		try {
			await restoreProxyApi(proxyId);
			await refreshProxies();
			toast.success(t('proxy:actions.restored'));
		} catch (error) {
			toast.error(t('proxy:actions.restoreFailed'));
			throw error;
		}
	};

	const purgeProxy = async (proxyId: string) => {
		try {
			await purgeProxyApi(proxyId);
			await Promise.all([refreshProxies(), refreshProfilesAndBindings()]);
			toast.success(t('proxy:actions.permanentlyDeleted'));
		} catch (error) {
			toast.error(t('proxy:actions.permanentDeleteFailed'));
			throw error;
		}
	};

	const batchUpdateProxies = async (proxyIds: string[], payload: UpdateProxyPayload) => {
		try {
			const result = await batchUpdateProxiesApi(proxyIds, payload);
			await refreshProxies();
			toast.success(t('common:batchResult', { action: t('proxy:actions.batchEdit'), success: result.successCount, fail: result.failedCount }));
			return result;
		} catch (error) {
			toast.error(t('proxy:actions.batchEditFailed'));
			throw error;
		}
	};


	const importProxies = async (payload: ImportProxiesPayload) => {
		try {
			const result = await importProxiesApi(payload);
			await refreshProxies();
			toast.success(t('common:batchResult', { action: t('proxy:actions.batchImport'), success: result.successCount, fail: result.failedCount }));
			return result;
		} catch (error) {
			toast.error(t('proxy:actions.batchImportFailed'));
			throw error;
		}
	};

	const checkProxy = async (
		proxyId: string,
		options?: { silent?: boolean },
	) => {
		try {
			await checkProxyApi(proxyId);
			await refreshProxies();
			if (!options?.silent) {
				toast.success(t('proxy:actions.checkCompleted'));
			}
		} catch (error) {
			if (!options?.silent) {
				toast.error(t('proxy:actions.checkFailed'));
			}
			throw error;
		}
	};

	const batchCheckProxies = async (proxyIds: string[]) => {
		try {
			const result = await batchCheckProxiesApi(proxyIds);
			await refreshProxies();
			toast.success(t('common:batchResult', { action: t('proxy:actions.batchCheck'), success: result.successCount, fail: result.failedCount }));
			return result;
		} catch (error) {
			toast.error(t('proxy:actions.batchCheckFailed'));
			throw error;
		}
	};
	const bindProfileProxy = async (profileId: string, proxyId: string) => {
		try {
			await bindProfileProxyApi(profileId, proxyId);
			await refreshProfilesAndBindings();
			toast.success(t('proxy:actions.bindingUpdated'));
		} catch (error) {
			toast.error(t('proxy:actions.bindFailed'));
			throw error;
		}
	};

	const unbindProfileProxy = async (profileId: string) => {
		try {
			await unbindProfileProxyApi(profileId);
			await refreshProfilesAndBindings();
			toast.success(t('proxy:actions.unbound'));
		} catch (error) {
			toast.error(t('proxy:actions.unbindFailed'));
			throw error;
		}
	};

	return {
		createProxy,
		updateProxy,
		deleteProxy,
		batchDeleteProxies,
		restoreProxy,
		purgeProxy,
		batchUpdateProxies,
		importProxies,
		checkProxy,
		batchCheckProxies,
		bindProfileProxy,
		unbindProfileProxy,
	};
}
