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
	restoreProxy as restoreProxyApi,
	unbindProfileProxy as unbindProfileProxyApi,
	updateProxy as updateProxyApi,
} from '@/entities/proxy/api/proxy-api';
import type {
	BatchProxyActionResponse,
	CreateProxyPayload,
	ImportProxiesPayload,
	UpdateProxyPayload,
} from '@/entities/proxy/model/types';

type ProxyActionsDeps = {
	refreshProxies: () => Promise<void>;
	refreshProfilesAndBindings: () => Promise<void>;
};

function formatBatchResultMessage(action: string, result: BatchProxyActionResponse) {
	return `${action}完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`;
}

export function useProxyActions({
	refreshProxies,
	refreshProfilesAndBindings,
}: ProxyActionsDeps) {
	const createProxy = async (payload: CreateProxyPayload) => {
		try {
			await createProxyApi(payload);
			await refreshProxies();
			toast.success('代理已创建');
		} catch (error) {
			toast.error('创建代理失败');
			throw error;
		}
	};

	const updateProxy = async (proxyId: string, payload: UpdateProxyPayload) => {
		try {
			await updateProxyApi(proxyId, payload);
			await refreshProxies();
			toast.success('代理已更新');
		} catch (error) {
			toast.error('更新代理失败');
			throw error;
		}
	};

	const deleteProxy = async (proxyId: string) => {
		try {
			await deleteProxyApi(proxyId);
			await Promise.all([refreshProxies(), refreshProfilesAndBindings()]);
			toast.success('代理已删除');
		} catch (error) {
			toast.error('删除代理失败');
			throw error;
		}
	};

	const batchDeleteProxies = async (proxyIds: string[]) => {
		try {
			const result = await batchDeleteProxiesApi(proxyIds);
			await Promise.all([refreshProxies(), refreshProfilesAndBindings()]);
			toast.success(formatBatchResultMessage('批量删除', result));
			return result;
		} catch (error) {
			toast.error('批量删除代理失败');
			throw error;
		}
	};

	const restoreProxy = async (proxyId: string) => {
		try {
			await restoreProxyApi(proxyId);
			await refreshProxies();
			toast.success('代理已恢复');
		} catch (error) {
			toast.error('恢复代理失败');
			throw error;
		}
	};

	const batchUpdateProxies = async (proxyIds: string[], payload: UpdateProxyPayload) => {
		try {
			const result = await batchUpdateProxiesApi(proxyIds, payload);
			await refreshProxies();
			toast.success(formatBatchResultMessage('批量修改', result));
			return result;
		} catch (error) {
			toast.error('批量修改代理失败');
			throw error;
		}
	};


	const importProxies = async (payload: ImportProxiesPayload) => {
		try {
			const result = await importProxiesApi(payload);
			await refreshProxies();
			toast.success(formatBatchResultMessage('批量导入', result));
			return result;
		} catch (error) {
			toast.error('批量导入代理失败');
			throw error;
		}
	};

	const checkProxy = async (proxyId: string) => {
		try {
			await checkProxyApi(proxyId);
			await refreshProxies();
			toast.success('代理检测已完成');
		} catch (error) {
			toast.error('代理检测失败');
			throw error;
		}
	};

	const batchCheckProxies = async (proxyIds: string[]) => {
		try {
			const result = await batchCheckProxiesApi(proxyIds);
			await refreshProxies();
			toast.success(formatBatchResultMessage('批量检测', result));
			return result;
		} catch (error) {
			toast.error('批量检测代理失败');
			throw error;
		}
	};
	const bindProfileProxy = async (profileId: string, proxyId: string) => {
		try {
			await bindProfileProxyApi(profileId, proxyId);
			await refreshProfilesAndBindings();
			toast.success('绑定已更新');
		} catch (error) {
			toast.error('绑定代理失败');
			throw error;
		}
	};

	const unbindProfileProxy = async (profileId: string) => {
		try {
			await unbindProfileProxyApi(profileId);
			await refreshProfilesAndBindings();
			toast.success('已解除绑定');
		} catch (error) {
			toast.error('解绑代理失败');
			throw error;
		}
	};

	return {
		createProxy,
		updateProxy,
		deleteProxy,
		batchDeleteProxies,
		restoreProxy,
		batchUpdateProxies,
		importProxies,
		checkProxy,
		batchCheckProxies,
		bindProfileProxy,
		unbindProfileProxy,
	};
}
