import { Archive, Bot, PencilLine, Plus } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { DataSection, EmptyState, PageHeader } from '@/components/common';
import { openRpaFlowEditorWindow } from '@/entities/rpa/api/rpa-window-api';
import { useRpaFlowsQuery } from '@/entities/rpa/model/use-rpa-flows-query';
import { getVisibleRpaFlows } from '@/features/rpa/model/rpa-flow-list';
import { useRpaActions } from '@/features/rpa/model/use-rpa-actions';
import {
	buildRpaEditorRoute,
	RPA_FLOWS_UPDATED_EVENT,
} from '@/features/rpa/model/rpa-editor-window';
import { SETTINGS_RECYCLE_BIN_PATH } from '@/app/workspace-routes';

function formatTs(ts?: number | null) {
	if (!ts) {
		return '暂无';
	}
	return new Intl.DateTimeFormat('zh-CN', {
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(ts * 1000));
}

export function RpaPage() {
	const navigate = useNavigate();
	const flowsQuery = useRpaFlowsQuery(false);
	const actions = useRpaActions();
	const flows = getVisibleRpaFlows(flowsQuery.data ?? []);

	const handleOpenEditor = async (flowId?: string | null) => {
		try {
			await openRpaFlowEditorWindow(flowId);
		} catch {
			toast.error('打开独立编辑器失败，已切换到内嵌页面');
			navigate(buildRpaEditorRoute(flowId));
		}
	};

	useEffect(() => {
		let unlisten: (() => void) | null = null;
		void (async () => {
			unlisten = await listen(RPA_FLOWS_UPDATED_EVENT, async () => {
				await flowsQuery.refetch();
			});
		})();
		return () => {
			unlisten?.();
		};
	}, [flowsQuery]);

	return (
		<div className="flex flex-col gap-3">
			<PageHeader
				label="rpa"
				title="RPA 流程列表"
				description="流程编辑与运行调试在独立窗口进行"
				actions={(
					<>
						<Button type="button" onClick={() => void handleOpenEditor()}>
							<Plus data-icon="inline-start" />
							新建流程
						</Button>
						<Button type="button" variant="outline" onClick={() => navigate(SETTINGS_RECYCLE_BIN_PATH)}>
							<Archive data-icon="inline-start" />
							归档列表
						</Button>
					</>
				)}
			/>

			<DataSection
				title="流程清单"
				description="点击“继续编辑”会拉起独立窗口，任务运行与节点编排都在窗口内完成"
				actions={<Badge variant="secondary">{flows.length}</Badge>}
			>
				{flows.length === 0 ? (
					<EmptyState
						title="还没有流程"
						description="从这里创建第一条 RPA 流程，编辑器会在单独窗口打开。"
						icon={Bot}
						actionLabel="新建流程"
						onAction={() => {
							void handleOpenEditor();
						}}
					/>
				) : (
					<div className="overflow-hidden rounded-xl border border-border/70">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/20 hover:bg-muted/20">
									<TableHead>流程</TableHead>
									<TableHead className="w-[340px]">统计</TableHead>
									<TableHead className="w-[180px]">最近更新</TableHead>
									<TableHead className="w-[180px] text-right">操作</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{flows.map((flow) => (
									<TableRow key={flow.id}>
										<TableCell>
											<div className="flex items-center gap-2">
												<p className="font-medium">{flow.name}</p>
												<Badge>active</Badge>
											</div>
											<p className="mt-1 text-sm text-muted-foreground">
												{flow.note?.trim() || '未填写备注'}
											</p>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											<div className="flex flex-wrap gap-2">
												<span>节点 {flow.definition.nodes.length}</span>
												<span>默认目标 {flow.defaultTargetProfileIds.length}</span>
												<span>上次运行 {formatTs(flow.lastRunAt)}</span>
											</div>
										</TableCell>
										<TableCell className="text-muted-foreground">{formatTs(flow.updatedAt)}</TableCell>
										<TableCell>
											<div className="flex justify-end gap-2">
												<Button type="button" variant="outline" size="sm" onClick={() => void handleOpenEditor(flow.id)}>
													<PencilLine data-icon="inline-start" />
													继续编辑
												</Button>
												<Button type="button" variant="outline" size="sm" onClick={() => void actions.deleteFlow(flow.id)}>
													<Archive data-icon="inline-start" />
													归档
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</DataSection>
		</div>
	);
}
