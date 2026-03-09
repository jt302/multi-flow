import { toast } from 'sonner';

import {
	bindProfileProxy as bindProfileProxyApi,
	createProxy as createProxyApi,
	deleteProxy as deleteProxyApi,
	restoreProxy as restoreProxyApi,
	unbindProfileProxy as unbindProfileProxyApi,
} from '@/entities/proxy/api/proxy-api';
import type { CreateProxyPayload } from '@/entities/proxy/model/types';

type ProxyActionsDeps = {
	refreshProxies: () => Promise<void>;
	refreshProfilesAndBindings: () => Promise<void>;
};

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
		deleteProxy,
		restoreProxy,
		bindProfileProxy,
		unbindProfileProxy,
	};
}
