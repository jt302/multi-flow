import { Archive, Bot, PencilLine, Plus, Workflow } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge, Button, Card } from '@/components/ui';
import { openRpaFlowEditorWindow } from '@/entities/rpa/api/rpa-window-api';
import { useRpaFlowsQuery } from '@/entities/rpa/model/use-rpa-flows-query';
import { getVisibleRpaFlows } from '@/features/ai/model/rpa-flow-list';
import { useRpaActions } from '@/features/ai/model/use-rpa-actions';
import {
	buildRpaEditorRoute,
	RPA_FLOWS_UPDATED_EVENT,
} from '@/features/ai/model/rpa-editor-window';
import { SETTINGS_RECYCLE_BIN_PATH } from '@/features/console/routes';

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

export function AiPage() {
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
		<div className="space-y-4">
			<Card className="border-border/60 bg-card/88 p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">RPA Center</p>
						<h2 className="mt-1 flex items-center gap-2 text-xl font-semibold">
							<Bot className="h-5 w-5 text-primary" />
							RPA 流程列表
						</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							这里仅保留流程列表入口。新建和编辑都在独立窗口完成，避免主工作台继续拥挤。
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button className="cursor-pointer gap-2" onClick={() => void handleOpenEditor()}>
							<Plus className="h-4 w-4" />
							新建流程
						</Button>
						<Button
							variant="outline"
							className="cursor-pointer gap-2"
							onClick={() => navigate(SETTINGS_RECYCLE_BIN_PATH)}
						>
							<Archive className="h-4 w-4" />
							归档列表
						</Button>
					</div>
				</div>
			</Card>

			<Card className="border-border/60 bg-card/88 p-4">
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h3 className="text-sm font-semibold">流程清单</h3>
						<p className="text-xs text-muted-foreground">
							点击“继续编辑”会拉起独立窗口，任务运行与节点编排都在窗口内完成。
						</p>
					</div>
					<Badge variant="secondary">{flows.length}</Badge>
				</div>

				{flows.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-6 py-12 text-center">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<Workflow className="h-5 w-5" />
						</div>
						<p className="mt-4 text-sm font-medium">还没有流程</p>
						<p className="mt-1 text-sm text-muted-foreground">
							从这里创建第一条 RPA 流程，编辑器会在单独窗口打开。
						</p>
						<Button className="mt-4 cursor-pointer gap-2" onClick={() => void handleOpenEditor()}>
							<Plus className="h-4 w-4" />
							新建流程
						</Button>
					</div>
				) : (
					<div className="grid gap-3">
						{flows.map((flow) => (
							<div
								key={flow.id}
								className="rounded-2xl border border-border/60 bg-background/60 p-4 transition hover:border-primary/40"
							>
								<div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
									<div className="space-y-3">
										<div className="flex flex-wrap items-center gap-2">
											<h4 className="text-sm font-semibold">{flow.name}</h4>
											<Badge variant="default">active</Badge>
										</div>
										<p className="text-sm text-muted-foreground">
											{flow.note?.trim() || '未填写备注'}
										</p>
										<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
											<span>节点 {flow.definition.nodes.length}</span>
											<span>默认目标 {flow.defaultTargetProfileIds.length}</span>
											<span>上次运行 {formatTs(flow.lastRunAt)}</span>
											<span>最近更新 {formatTs(flow.updatedAt)}</span>
										</div>
									</div>

									<div className="flex flex-wrap gap-2">
										<Button
											variant="outline"
											className="cursor-pointer gap-2"
											onClick={() => void handleOpenEditor(flow.id)}
										>
											<PencilLine className="h-4 w-4" />
											继续编辑
										</Button>
										<Button
											variant="outline"
											className="cursor-pointer gap-2"
											onClick={() => void actions.deleteFlow(flow.id)}
										>
											<Archive className="h-4 w-4" />
											归档
										</Button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</Card>
		</div>
	);
}
