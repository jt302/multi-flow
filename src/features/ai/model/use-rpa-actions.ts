import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
	cancelRpaRun,
	cancelRpaRunInstance,
	createRpaFlow,
	deleteRpaFlow,
	purgeRpaFlow,
	resumeRpaInstance,
	restoreRpaFlow,
	runRpaFlow,
	updateRpaFlow,
} from '@/entities/rpa/api/rpa-api';
import type { RunRpaFlowPayload, SaveRpaFlowPayload } from '@/entities/rpa/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useRpaActions() {
	const queryClient = useQueryClient();

	const invalidateAll = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.rpaFlowsRoot }),
			queryClient.invalidateQueries({ queryKey: queryKeys.rpaRuns }),
		]);
	};

	return {
		createFlow: async (payload: SaveRpaFlowPayload) => {
			try {
				const flow = await createRpaFlow(payload);
				await invalidateAll();
				toast.success('流程已创建');
				return flow;
			} catch (error) {
				toast.error('创建流程失败');
				throw error;
			}
		},
		updateFlow: async (flowId: string, payload: SaveRpaFlowPayload) => {
			try {
				const flow = await updateRpaFlow(flowId, payload);
				await invalidateAll();
				toast.success('流程已保存');
				return flow;
			} catch (error) {
				toast.error('保存流程失败');
				throw error;
			}
		},
		deleteFlow: async (flowId: string) => {
			try {
				await deleteRpaFlow(flowId);
				await invalidateAll();
				toast.success('流程已归档');
			} catch (error) {
				toast.error('归档流程失败');
				throw error;
			}
		},
		restoreFlow: async (flowId: string) => {
			try {
				await restoreRpaFlow(flowId);
				await invalidateAll();
				toast.success('流程已恢复');
			} catch (error) {
				toast.error('恢复流程失败');
				throw error;
			}
		},
		purgeFlow: async (flowId: string) => {
			try {
				await purgeRpaFlow(flowId);
				await invalidateAll();
				toast.success('流程已彻底删除');
			} catch (error) {
				toast.error('彻底删除流程失败');
				throw error;
			}
		},
		runFlow: async (payload: RunRpaFlowPayload) => {
			try {
				const run = await runRpaFlow(payload);
				await invalidateAll();
				toast.success('任务已启动');
				return run;
			} catch (error) {
				toast.error('启动任务失败');
				throw error;
			}
		},
		cancelRun: async (runId: string) => {
			try {
				const run = await cancelRpaRun(runId);
				await invalidateAll();
				toast.success('任务已取消');
				return run;
			} catch (error) {
				toast.error('取消任务失败');
				throw error;
			}
		},
		cancelInstance: async (instanceId: string) => {
			try {
				await cancelRpaRunInstance(instanceId);
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: queryKeys.rpaRuns }),
					queryClient.invalidateQueries({ queryKey: queryKeys.rpaRunSteps(instanceId) }),
				]);
				toast.success('实例已取消');
			} catch (error) {
				toast.error('取消实例失败');
				throw error;
			}
		},
		resumeInstance: async (instanceId: string) => {
			try {
				await resumeRpaInstance(instanceId);
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: queryKeys.rpaRuns }),
					queryClient.invalidateQueries({ queryKey: queryKeys.rpaRunDetails(null) }),
				]);
				toast.success('实例已继续执行');
			} catch (error) {
				toast.error('继续实例失败');
				throw error;
			}
		},
	};
}
