import '@xyflow/react/dist/style.css';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
	addEdge,
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	type Connection,
	type Edge,
	type Node,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from '@xyflow/react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ArrowLeft, Bot, Play, Plus, Save, Square, Trash2, Workflow } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod/v3';

import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	Card,
	Checkbox,
	Input,
	Textarea,
	Toaster,
} from '@/components/ui';
import { useGroupsQuery } from '@/entities/group/model/use-groups-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { closeRpaFlowEditorWindow } from '@/entities/rpa/api/rpa-window-api';
import { useRpaFlowsQuery } from '@/entities/rpa/model/use-rpa-flows-query';
import { useRpaRunDetailsQuery } from '@/entities/rpa/model/use-rpa-run-details-query';
import { useRpaRunStepsQuery } from '@/entities/rpa/model/use-rpa-run-steps-query';
import { useRpaRunsQuery } from '@/entities/rpa/model/use-rpa-runs-query';
import type {
	RpaFlowDefinitionItem,
	RpaFlowEdgeItem,
	RpaFlowNodeItem,
	RpaRunInstanceItem,
} from '@/entities/rpa/model/types';
import { useRpaActions } from '@/features/ai/model/use-rpa-actions';
import {
	buildComparableFlowDraft,
	hasPendingFlowChanges,
	resolveRpaEditorLeaveMode,
} from '@/features/ai/model/rpa-editor-close-guard';
import {
	buildRpaEditorRoute,
	parseRpaEditorSearch,
} from '@/features/ai/model/rpa-editor-window';
import {
	parseNodeConfigText,
	parseVariablesText,
	rpaFlowMetaSchema,
	rpaNodeConfigSchema,
	stringifyVariables,
} from '@/features/ai/model/rpa-editor';
import { queryKeys } from '@/shared/config/query-keys';

const NODE_LIBRARY = [
	{ kind: 'open_profile', label: '打开环境' },
	{ kind: 'goto_url', label: '访问页面' },
	{ kind: 'wait_for_selector', label: '等待元素' },
	{ kind: 'click_element', label: '点击元素' },
	{ kind: 'input_text', label: '输入文本' },
	{ kind: 'extract_text', label: '提取文本' },
	{ kind: 'branch', label: '条件分支' },
	{ kind: 'manual_gate', label: '人工接管' },
	{ kind: 'success_end', label: '成功结束' },
	{ kind: 'failure_end', label: '失败结束' },
];

type FlowMetaValues = z.infer<typeof rpaFlowMetaSchema>;
type NodeConfigValues = z.infer<typeof rpaNodeConfigSchema>;
type RunFormValues = {
	concurrencyLimit: number;
	runtimeInputText: string;
};

function createDefaultDefinition(): RpaFlowDefinitionItem {
	return {
		entryNodeId: 'node_open',
		defaults: {
			concurrencyLimit: 3,
		},
		variables: [],
		nodes: [
			{
				id: 'node_open',
				kind: 'open_profile',
				position: { x: 40, y: 120 },
				config: {},
			},
			{
				id: 'node_end',
				kind: 'success_end',
				position: { x: 360, y: 120 },
				config: {},
			},
		],
		edges: [
			{
				id: 'edge_open_end',
				source: 'node_open',
				target: 'node_end',
				sourceHandle: 'success',
				targetHandle: null,
			},
		],
	};
}

function toFlowNodes(definition: RpaFlowDefinitionItem): Node[] {
	return definition.nodes.map((node) => ({
		id: node.id,
		position: node.position,
		data: {
			label: NODE_LIBRARY.find((item) => item.kind === node.kind)?.label ?? node.kind,
			kind: node.kind,
			config: node.config,
		},
	}));
}

function toFlowEdges(definition: RpaFlowDefinitionItem): Edge[] {
	return definition.edges.map((edge) => ({
		id: edge.id,
		source: edge.source,
		target: edge.target,
		sourceHandle: edge.sourceHandle ?? undefined,
		targetHandle: edge.targetHandle ?? undefined,
		animated: edge.sourceHandle === 'true' || edge.sourceHandle === 'false',
	}));
}

function fromFlowNodes(nodes: Node[]): RpaFlowNodeItem[] {
	return nodes.map((node) => ({
		id: node.id,
		kind: String((node.data as { kind?: string })?.kind ?? 'custom'),
		position: {
			x: node.position.x,
			y: node.position.y,
		},
		config: ((node.data as { config?: Record<string, unknown> })?.config ?? {}) as Record<
			string,
			unknown
		>,
	}));
}

function fromFlowEdges(edges: Edge[]): RpaFlowEdgeItem[] {
	return edges.map((edge) => ({
		id: edge.id,
		source: edge.source,
		target: edge.target,
		sourceHandle: edge.sourceHandle ?? null,
		targetHandle: edge.targetHandle ?? null,
	}));
}

function formatStatus(status: string) {
	return status.split('_').join(' ');
}

function statusVariant(status: string) {
	if (status === 'success') {
		return 'default' as const;
	}
	if (status === 'failed' || status === 'cancelled') {
		return 'destructive' as const;
	}
	return 'secondary' as const;
}

export function RpaFlowEditorPage() {
	const location = useLocation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const editorSearch = parseRpaEditorSearch(location.search);
	const currentWindow = useMemo(() => getCurrentWindow(), []);
	const requestedFlowId = editorSearch.flowId;
	const profilesQuery = useProfilesQuery();
	const groupsQuery = useGroupsQuery();
	const flowsQuery = useRpaFlowsQuery();
	const runsQuery = useRpaRunsQuery();
	const actions = useRpaActions();

	const [activePanel, setActivePanel] = useState<'design' | 'runs'>('design');
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
	const [defaultTargetProfileIds, setDefaultTargetProfileIds] = useState<string[]>([]);
	const [runTargetProfileIds, setRunTargetProfileIds] = useState<string[]>([]);
	const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
	const [leavePending, setLeavePending] = useState(false);
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
	const allowCloseRef = useRef(false);

	const runDetailsQuery = useRpaRunDetailsQuery(selectedRunId);
	const runStepsQuery = useRpaRunStepsQuery(selectedInstanceId);

	const flowForm = useForm<FlowMetaValues>({
		resolver: zodResolver(rpaFlowMetaSchema),
		defaultValues: {
			name: '',
			note: '',
			concurrencyLimit: 3,
			variablesText: '',
		},
	});
	const nodeConfigForm = useForm<NodeConfigValues>({
		resolver: zodResolver(rpaNodeConfigSchema),
		defaultValues: {
			configText: '{}',
		},
	});
	const runForm = useForm<RunFormValues>({
		defaultValues: {
			concurrencyLimit: 3,
			runtimeInputText: '{}',
		},
	});

	const profiles = useMemo(
		() => (profilesQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[profilesQuery.data],
	);
	const groups = useMemo(
		() => (groupsQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[groupsQuery.data],
	);
	const flows = flowsQuery.data ?? [];
	const runs = runsQuery.data ?? [];
	const selectedFlow = requestedFlowId ? flows.find((item) => item.id === requestedFlowId) ?? null : null;
	const selectedNode = nodes.find((item) => item.id === selectedNodeId) ?? null;
	const selectedRun = runDetailsQuery.data?.run ?? runs.find((item) => item.id === selectedRunId) ?? null;
	const selectedInstance =
		runDetailsQuery.data?.instances.find((item) => item.id === selectedInstanceId) ?? null;
	const isCreateMode = editorSearch.createMode || !requestedFlowId;
	const flowMissing = Boolean(requestedFlowId) && flowsQuery.isSuccess && !selectedFlow;
	const leaveMode = resolveRpaEditorLeaveMode(currentWindow.label);
	const baselineDefinition = useMemo(
		() => selectedFlow?.definition ?? createDefaultDefinition(),
		[selectedFlow],
	);
	const flowName = flowForm.watch('name');
	const flowNote = flowForm.watch('note');
	const flowConcurrencyLimit = flowForm.watch('concurrencyLimit');
	const flowVariablesText = flowForm.watch('variablesText');
	const baselineComparableDraft = useMemo(
		() =>
			buildComparableFlowDraft(
				{
					name: selectedFlow?.name ?? '',
					note: selectedFlow?.note ?? '',
					concurrencyLimit: selectedFlow?.definition.defaults.concurrencyLimit ?? 3,
					variablesText: selectedFlow ? stringifyVariables(selectedFlow.definition) : '',
					defaultTargetProfileIds: selectedFlow?.defaultTargetProfileIds ?? [],
				},
				toFlowNodes(baselineDefinition),
				toFlowEdges(baselineDefinition),
			),
		[baselineDefinition, selectedFlow],
	);
	const currentComparableDraft = useMemo(
		() =>
			buildComparableFlowDraft(
				{
					name: flowName ?? '',
					note: flowNote ?? '',
					concurrencyLimit: flowConcurrencyLimit ?? 3,
					variablesText: flowVariablesText ?? '',
					defaultTargetProfileIds,
				},
				nodes,
				edges,
			),
		[defaultTargetProfileIds, edges, flowConcurrencyLimit, flowName, flowNote, flowVariablesText, nodes],
	);
	const hasUnsavedChanges = hasPendingFlowChanges(currentComparableDraft, baselineComparableDraft);

	const leaveToMain = async () => {
		try {
			if (leaveMode === 'close-window') {
				allowCloseRef.current = true;
				await closeRpaFlowEditorWindow();
				return;
			}
			navigate('/ai');
		} catch (error) {
			allowCloseRef.current = false;
			toast.error(error instanceof Error ? error.message : '关闭编辑窗口失败');
		}
	};

	const saveFlowDraft = async () => {
		const valid = await flowForm.trigger();
		if (!valid) {
			setActivePanel('design');
			return null;
		}
		const values = flowForm.getValues();
		const definition: RpaFlowDefinitionItem = {
			entryNodeId: nodes[0]?.id ?? 'node_open',
			defaults: {
				concurrencyLimit: values.concurrencyLimit,
			},
			variables: parseVariablesText(values.variablesText),
			nodes: fromFlowNodes(nodes),
			edges: fromFlowEdges(edges),
		};
		const payload = {
			name: values.name,
			note: values.note,
			definition,
			defaultTargetProfileIds,
		};
		const saved = selectedFlow
			? await actions.updateFlow(selectedFlow.id, payload)
			: await actions.createFlow(payload);
		navigate(buildRpaEditorRoute(saved.id), { replace: true });
		return saved;
	};

	const requestLeaveToMain = async () => {
		if (!hasUnsavedChanges) {
			await leaveToMain();
			return;
		}
		setLeaveDialogOpen(true);
	};

	useEffect(() => {
		const flow = selectedFlow;
		if (!flow) {
			const definition = createDefaultDefinition();
			setNodes(toFlowNodes(definition));
			setEdges(toFlowEdges(definition));
			setDefaultTargetProfileIds([]);
			setRunTargetProfileIds([]);
			setSelectedNodeId(null);
			flowForm.reset({
				name: '',
				note: '',
				concurrencyLimit: definition.defaults.concurrencyLimit,
				variablesText: '',
			});
			runForm.reset({
				concurrencyLimit: definition.defaults.concurrencyLimit,
				runtimeInputText: JSON.stringify({}, null, 2),
			});
			return;
		}
		setNodes(toFlowNodes(flow.definition));
		setEdges(toFlowEdges(flow.definition));
		setDefaultTargetProfileIds(flow.defaultTargetProfileIds);
		setRunTargetProfileIds(flow.defaultTargetProfileIds);
		setSelectedNodeId(null);
		flowForm.reset({
			name: flow.name,
			note: flow.note ?? '',
			concurrencyLimit: flow.definition.defaults.concurrencyLimit,
			variablesText: stringifyVariables(flow.definition),
		});
		runForm.reset({
			concurrencyLimit: flow.definition.defaults.concurrencyLimit,
			runtimeInputText: JSON.stringify({}, null, 2),
		});
	}, [flowForm, runForm, selectedFlow, setEdges, setNodes]);

	useEffect(() => {
		if (!selectedNode) {
			nodeConfigForm.reset({ configText: '{}' });
			return;
		}
		nodeConfigForm.reset({
			configText: JSON.stringify(
				((selectedNode.data as { config?: Record<string, unknown> })?.config ?? {}) as Record<
					string,
					unknown
				>,
				null,
				2,
			),
		});
	}, [nodeConfigForm, selectedNode]);

	useEffect(() => {
		if (!selectedRunId && runs.length > 0) {
			setSelectedRunId(runs[0].id);
		}
	}, [runs, selectedRunId]);

	useEffect(() => {
		const details = runDetailsQuery.data;
		if (details?.run.id !== selectedRunId) {
			setSelectedInstanceId(null);
			return;
		}
		if (!selectedInstanceId && details.instances.length > 0) {
			setSelectedInstanceId(details.instances[0].id);
		}
	}, [runDetailsQuery.data, selectedInstanceId, selectedRunId]);

	useEffect(() => {
		let disposed = false;
		const unlisteners: Array<() => void> = [];
		void (async () => {
			for (const eventName of ['rpa:run-updated', 'rpa:instance-updated', 'rpa:step-appended']) {
				const unlisten = await listen(eventName, async () => {
					await Promise.all([
						queryClient.invalidateQueries({ queryKey: queryKeys.rpaRuns }),
						selectedRunId
							? queryClient.invalidateQueries({
									queryKey: queryKeys.rpaRunDetails(selectedRunId),
							  })
							: Promise.resolve(),
						selectedInstanceId
							? queryClient.invalidateQueries({
									queryKey: queryKeys.rpaRunSteps(selectedInstanceId),
							  })
							: Promise.resolve(),
						queryClient.invalidateQueries({ queryKey: queryKeys.rpaFlowsRoot }),
					]);
				});
				if (disposed) {
					unlisten();
					continue;
				}
				unlisteners.push(unlisten);
			}
		})();
		return () => {
			disposed = true;
			unlisteners.forEach((unlisten) => unlisten());
		};
	}, [queryClient, selectedInstanceId, selectedRunId]);

	useEffect(() => {
		if (leaveMode !== 'close-window') {
			return;
		}
		let unlisten: (() => void) | null = null;
		void (async () => {
			unlisten = await currentWindow.onCloseRequested(async (event) => {
				if (allowCloseRef.current) {
					return;
				}
				event.preventDefault();
				await requestLeaveToMain();
			});
		})();
		return () => {
			unlisten?.();
		};
	}, [currentWindow, hasUnsavedChanges, leaveMode]);

	const handleConnect = (connection: Connection) => {
		setEdges((current) => addEdge({ ...connection, id: `edge_${Date.now()}` }, current));
	};

	const handleStartNewDraft = () => {
		setSelectedRunId(null);
		setSelectedInstanceId(null);
		setActivePanel('design');
		navigate(buildRpaEditorRoute(), { replace: true });
	};

	const handleAddNode = (kind: string) => {
		const id = `node_${Date.now()}`;
		setNodes((current) => [
			...current,
			{
				id,
				position: { x: 120 + current.length * 30, y: 220 + current.length * 16 },
				data: { label: NODE_LIBRARY.find((item) => item.kind === kind)?.label ?? kind, kind, config: {} },
			},
		]);
		setSelectedNodeId(id);
	};

	const handleApplyNodeConfig = nodeConfigForm.handleSubmit(async (values) => {
		if (!selectedNode) {
			return;
		}
		const nextConfig = parseNodeConfigText(values.configText);
		setNodes((current) =>
			current.map((item) =>
				item.id === selectedNode.id
					? {
							...item,
							data: {
								...(item.data as Record<string, unknown>),
								config: nextConfig,
							},
					  }
					: item,
			),
		);
	});

	const handleRunFlow = runForm.handleSubmit(async (values) => {
		if (!selectedFlow || selectedFlow.lifecycle !== 'active') {
			return;
		}
		const runtimeInput = JSON.parse(values.runtimeInputText || '{}') as Record<string, unknown>;
		const run = await actions.runFlow({
			flowId: selectedFlow.id,
			targetProfileIds: runTargetProfileIds.length > 0 ? runTargetProfileIds : defaultTargetProfileIds,
			concurrencyLimit: values.concurrencyLimit,
			runtimeInput,
		});
		setSelectedRunId(run.id);
		setSelectedInstanceId(null);
		setActivePanel('runs');
	});

	if (flowMissing && !isCreateMode) {
		return (
			<div className="h-dvh overflow-hidden bg-background p-4 md:p-6">
				<Card className="mx-auto flex h-full max-w-3xl items-center justify-center border-border/60 bg-card/90 p-8 text-center backdrop-blur">
					<div className="space-y-4">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<Bot className="h-6 w-6" />
						</div>
						<div className="space-y-2">
							<h1 className="text-2xl font-semibold">流程不存在</h1>
							<p className="text-sm text-muted-foreground">
								当前窗口指定的流程已被删除或不存在。你可以返回主界面，或者直接开始一个新流程草稿。
							</p>
						</div>
						<div className="flex justify-center gap-3">
							<Button
								variant="outline"
								className="cursor-pointer"
								onClick={() => void requestLeaveToMain()}
							>
								<ArrowLeft className="h-4 w-4" />
								返回主界面
							</Button>
							<Button className="cursor-pointer" onClick={handleStartNewDraft}>
								<Plus className="h-4 w-4" />
								新建流程
							</Button>
						</div>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className="h-dvh overflow-hidden bg-background p-4 md:p-6">
			<div className="mx-auto flex h-full max-w-[1680px] flex-col gap-4">
				<Card className="shrink-0 border-border/60 bg-card/90 p-4 backdrop-blur">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">RPA Editor</p>
							<h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
								<Bot className="h-5 w-5 text-primary" />
								{selectedFlow?.name ?? '新流程草稿'}
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">
								流程设计、运行调试和任务追踪都集中在这个独立窗口里。
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								className="cursor-pointer"
								onClick={() => void requestLeaveToMain()}
							>
								<ArrowLeft className="h-4 w-4" />
								返回主界面
							</Button>
							<Button variant="outline" className="cursor-pointer" onClick={handleStartNewDraft}>
								<Plus className="h-4 w-4" />
								新流程
							</Button>
							{selectedFlow ? (
								<Button
									variant="outline"
									className="cursor-pointer"
									onClick={() =>
										selectedFlow.lifecycle === 'active'
											? void actions.deleteFlow(selectedFlow.id)
											: void actions.restoreFlow(selectedFlow.id)
									}
								>
									{selectedFlow.lifecycle === 'active' ? '归档流程' : '恢复流程'}
								</Button>
							) : null}
							<Button className="cursor-pointer" onClick={() => void saveFlowDraft()}>
								<Save className="h-4 w-4" />
								保存流程
							</Button>
						</div>
					</div>
				</Card>

				<div className="flex shrink-0 gap-2">
					<Button
						variant={activePanel === 'design' ? 'default' : 'outline'}
						className="cursor-pointer"
						onClick={() => setActivePanel('design')}
					>
						流程设计
					</Button>
					<Button
						variant={activePanel === 'runs' ? 'default' : 'outline'}
						className="cursor-pointer"
						onClick={() => setActivePanel('runs')}
					>
						运行中心
					</Button>
				</div>

				<div className="min-h-0 flex-1 overflow-auto">
					{activePanel === 'design' ? (
						<div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
							<Card className="space-y-4 border-border/60 bg-card/88 p-4">
								<div>
									<h2 className="text-sm font-semibold">流程元信息</h2>
									<p className="text-xs text-muted-foreground">
										这里维护名称、备注、并发和默认目标。
									</p>
								</div>
								<form
									className="space-y-4"
									onSubmit={(event) => {
										event.preventDefault();
										void saveFlowDraft();
									}}
								>
									<div className="space-y-2">
										<label htmlFor="rpa-flow-name" className="text-xs font-medium text-muted-foreground">
											流程名称
										</label>
										<Input id="rpa-flow-name" className="cursor-pointer" {...flowForm.register('name')} />
										{flowForm.formState.errors.name ? (
											<p className="text-xs text-destructive">
												{flowForm.formState.errors.name.message}
											</p>
										) : null}
									</div>
									<div className="space-y-2">
										<label htmlFor="rpa-flow-note" className="text-xs font-medium text-muted-foreground">
											备注
										</label>
										<Textarea id="rpa-flow-note" rows={3} {...flowForm.register('note')} />
									</div>
									<div className="space-y-2">
										<label
											htmlFor="rpa-flow-concurrency"
											className="text-xs font-medium text-muted-foreground"
										>
											默认并发
										</label>
										<Input
											id="rpa-flow-concurrency"
											type="number"
											min={1}
											max={5}
											{...flowForm.register('concurrencyLimit', { valueAsNumber: true })}
										/>
									</div>
									<div className="space-y-2">
										<label
											htmlFor="rpa-flow-variables"
											className="text-xs font-medium text-muted-foreground"
										>
											变量定义（`key|label|required|default`）
										</label>
										<Textarea id="rpa-flow-variables" rows={6} {...flowForm.register('variablesText')} />
									</div>
									<div className="space-y-2">
										<div className="text-xs font-medium text-muted-foreground">默认目标 Profile</div>
										<div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
											{profiles.map((profile) => (
												<label
													key={profile.id}
													htmlFor={`rpa-default-target-${profile.id}`}
													className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/60"
												>
													<Checkbox
														id={`rpa-default-target-${profile.id}`}
														checked={defaultTargetProfileIds.includes(profile.id)}
														onCheckedChange={(checked) =>
															setDefaultTargetProfileIds((current) =>
																checked
																	? [...new Set([...current, profile.id])]
																	: current.filter((item) => item !== profile.id),
															)
														}
													/>
													<span>{profile.name}</span>
												</label>
											))}
										</div>
									</div>
									<Button type="submit" className="w-full cursor-pointer">
										保存当前流程
									</Button>
								</form>
							</Card>

							<div className="space-y-4">
								<Card className="space-y-3 border-border/60 bg-card/88 p-4">
									<div className="flex items-center justify-between">
										<div>
											<h2 className="text-sm font-semibold">节点画布</h2>
											<p className="text-xs text-muted-foreground">
												先拖动和连线，再在下方编辑当前节点的 JSON 配置。
											</p>
										</div>
										<Badge variant="secondary">{nodes.length} 个节点</Badge>
									</div>
									<div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-background/70 p-3">
										{NODE_LIBRARY.map((item) => (
											<Button
												key={item.kind}
												type="button"
												variant="outline"
												size="sm"
												className="cursor-pointer"
												onClick={() => handleAddNode(item.kind)}
											>
												{item.label}
											</Button>
										))}
									</div>
									<div className="h-[520px] overflow-hidden rounded-2xl border border-border/60 bg-background/80">
										<ReactFlow
											nodes={nodes}
											edges={edges}
											onNodesChange={onNodesChange}
											onEdgesChange={onEdgesChange}
											onConnect={handleConnect}
											onNodeClick={(_, node) => setSelectedNodeId(node.id)}
											fitView
										>
											<Controls />
											<MiniMap />
											<Background variant={BackgroundVariant.Dots} gap={16} size={1} />
										</ReactFlow>
									</div>
								</Card>

								<Card className="border-border/60 bg-card/88 p-4">
									<div className="mb-3 flex items-center justify-between">
										<div>
											<h3 className="text-sm font-semibold">节点配置</h3>
											<p className="text-xs text-muted-foreground">
												首版继续使用 JSON 面板，保持节点能力接入速度。
											</p>
										</div>
										{selectedNode ? (
											<Button
												type="button"
												variant="outline"
												size="icon"
												className="cursor-pointer"
												onClick={() => {
													setNodes((current) => current.filter((item) => item.id !== selectedNode.id));
													setEdges((current) =>
														current.filter(
															(item) =>
																item.source !== selectedNode.id && item.target !== selectedNode.id,
														),
													);
													setSelectedNodeId(null);
												}}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										) : null}
									</div>
									{selectedNode ? (
										<form className="space-y-3" onSubmit={handleApplyNodeConfig}>
											<div className="rounded-xl border border-border/60 bg-card/70 p-3">
												<p className="text-sm font-medium">
													{(selectedNode.data as { label?: string })?.label ?? selectedNode.id}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													类型：{(selectedNode.data as { kind?: string })?.kind}
												</p>
											</div>
											<Textarea rows={14} {...nodeConfigForm.register('configText')} />
											{nodeConfigForm.formState.errors.configText ? (
												<p className="text-xs text-destructive">
													{nodeConfigForm.formState.errors.configText.message}
												</p>
											) : null}
											<Button type="submit" className="w-full cursor-pointer">
												应用节点配置
											</Button>
										</form>
									) : (
										<div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
											点击画布中的任意节点后，在这里编辑它的 JSON 配置。
										</div>
									)}
								</Card>
							</div>
						</div>
					) : (
						<div className="grid gap-4 2xl:grid-cols-[360px_minmax(0,1fr)]">
							<Card className="space-y-4 border-border/60 bg-card/88 p-4">
								<div className="flex items-center gap-2">
									<Play className="h-4 w-4 text-primary" />
									<div>
										<h2 className="text-sm font-semibold">运行面板</h2>
										<p className="text-xs text-muted-foreground">
											选择分组或 Profile，手动启动当前流程。
										</p>
									</div>
								</div>
								<form className="space-y-4" onSubmit={handleRunFlow}>
									<div className="space-y-2">
										<div className="text-xs font-medium text-muted-foreground">目标分组</div>
										<div className="rounded-xl border border-border/60 p-2">
											{groups.map((group) => {
												const memberIds = profiles
													.filter((profile) => profile.group === group.name)
													.map((profile) => profile.id);
												const checked =
													memberIds.length > 0 &&
													memberIds.every((id) => runTargetProfileIds.includes(id));
												return (
													<label
														htmlFor={`rpa-group-target-${group.id}`}
														key={group.id}
														className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/60"
													>
														<Checkbox
															id={`rpa-group-target-${group.id}`}
															checked={checked}
															onCheckedChange={(nextChecked) =>
																setRunTargetProfileIds((current) =>
																	nextChecked
																		? [...new Set([...current, ...memberIds])]
																		: current.filter((item) => !memberIds.includes(item)),
																)
															}
														/>
														<span>{group.name}</span>
													</label>
												);
											})}
										</div>
									</div>
									<div className="space-y-2">
										<div className="text-xs font-medium text-muted-foreground">目标 Profile</div>
										<div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
											{profiles.map((profile) => (
												<label
													htmlFor={`rpa-run-target-${profile.id}`}
													key={profile.id}
													className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/60"
												>
													<Checkbox
														id={`rpa-run-target-${profile.id}`}
														checked={runTargetProfileIds.includes(profile.id)}
														onCheckedChange={(checked) =>
															setRunTargetProfileIds((current) =>
																checked
																	? [...new Set([...current, profile.id])]
																	: current.filter((item) => item !== profile.id),
															)
														}
													/>
													<span>{profile.name}</span>
												</label>
											))}
										</div>
									</div>
									<div className="space-y-2">
										<label
											htmlFor="rpa-run-concurrency"
											className="text-xs font-medium text-muted-foreground"
										>
											运行并发
										</label>
										<Input
											id="rpa-run-concurrency"
											type="number"
											min={1}
											max={5}
											{...runForm.register('concurrencyLimit', { valueAsNumber: true })}
										/>
									</div>
									<div className="space-y-2">
										<label
											htmlFor="rpa-runtime-input"
											className="text-xs font-medium text-muted-foreground"
										>
											运行时输入 JSON
										</label>
										<Textarea id="rpa-runtime-input" rows={6} {...runForm.register('runtimeInputText')} />
									</div>
									<Button
										type="submit"
										className="w-full cursor-pointer gap-2"
										disabled={!selectedFlow || selectedFlow.lifecycle !== 'active'}
									>
										<Workflow className="h-4 w-4" />
										启动任务
									</Button>
								</form>
							</Card>

							<Card className="border-border/60 bg-card/88 p-4">
								<div className="mb-4 flex items-center justify-between">
									<div>
										<h2 className="text-sm font-semibold">任务中心</h2>
										<p className="text-xs text-muted-foreground">
											任务列表 / 实例状态 / 步骤与调试产物
										</p>
									</div>
									{selectedRun ? (
										<Button
											variant="outline"
											className="cursor-pointer gap-2"
											onClick={() => void actions.cancelRun(selectedRun.id)}
										>
											<Square className="h-4 w-4" />
											取消任务
										</Button>
									) : null}
								</div>

								<div className="grid gap-4 xl:grid-cols-[280px_280px_minmax(0,1fr)]">
									<div className="space-y-2">
										{runs.map((run) => (
											<button
												key={run.id}
												type="button"
												className={`w-full cursor-pointer rounded-xl border px-3 py-3 text-left ${
													selectedRun?.id === run.id
														? 'border-primary bg-primary/10'
														: 'border-border/60 hover:border-primary/40'
												}`}
												onClick={() => {
													setSelectedRunId(run.id);
													setSelectedInstanceId(null);
												}}
											>
												<div className="flex items-center justify-between">
													<p className="text-sm font-medium">{run.flowName}</p>
													<Badge variant={statusVariant(run.status)}>{formatStatus(run.status)}</Badge>
												</div>
												<p className="mt-1 text-xs text-muted-foreground">
													成功 {run.successCount} / 失败 {run.failedCount} / 取消 {run.cancelledCount}
												</p>
											</button>
										))}
									</div>

									<div className="space-y-2">
										{runDetailsQuery.data?.instances.map((instance: RpaRunInstanceItem) => (
											<div
												key={instance.id}
												className={`rounded-xl border px-3 py-3 ${
													selectedInstance?.id === instance.id
														? 'border-primary bg-primary/10'
														: 'border-border/60'
												}`}
											>
												<button
													type="button"
													className="w-full cursor-pointer text-left"
													onClick={() => setSelectedInstanceId(instance.id)}
												>
													<div className="flex items-center justify-between">
														<p className="text-sm font-medium">{instance.profileId}</p>
														<Badge variant={statusVariant(instance.status)}>
															{formatStatus(instance.status)}
														</Badge>
													</div>
													<p className="mt-1 text-xs text-muted-foreground">
														当前节点：{instance.currentNodeId ?? '已完成'}
													</p>
													{instance.errorMessage ? (
														<p className="mt-1 text-xs text-destructive">{instance.errorMessage}</p>
													) : null}
												</button>
												<div className="mt-3 flex gap-2">
													<Button
														variant="outline"
														size="sm"
														className="flex-1 cursor-pointer"
														onClick={() => void actions.cancelInstance(instance.id)}
													>
														取消
													</Button>
													{instance.status === 'needs_manual' ? (
														<Button
															size="sm"
															className="flex-1 cursor-pointer"
															onClick={() => void actions.resumeInstance(instance.id)}
														>
															继续
														</Button>
													) : null}
												</div>
											</div>
										))}
									</div>

									<div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
										{selectedInstance ? (
											<>
												<div className="grid gap-3 md:grid-cols-2">
													<div className="rounded-xl border border-border/60 p-3">
														<p className="text-xs text-muted-foreground">上下文</p>
														<pre className="mt-2 overflow-x-auto text-xs">
															{JSON.stringify(selectedInstance.context, null, 2)}
														</pre>
													</div>
													<div className="rounded-xl border border-border/60 p-3">
														<p className="text-xs text-muted-foreground">调试产物</p>
														<pre className="mt-2 overflow-x-auto text-xs">
															{JSON.stringify(selectedInstance.artifactIndex, null, 2)}
														</pre>
													</div>
												</div>
												<div className="space-y-2">
													{runStepsQuery.data?.map((step) => (
														<div key={step.id} className="rounded-xl border border-border/60 p-3">
															<div className="flex items-center justify-between gap-3">
																<div>
																	<p className="text-sm font-medium">
																		{step.nodeKind} · {step.nodeId}
																	</p>
																	<p className="text-xs text-muted-foreground">
																		尝试 {step.attempt}
																	</p>
																</div>
																<Badge variant={statusVariant(step.status)}>
																	{formatStatus(step.status)}
																</Badge>
															</div>
															{step.errorMessage ? (
																<p className="mt-2 text-xs text-destructive">{step.errorMessage}</p>
															) : null}
															<div className="mt-3 grid gap-3 md:grid-cols-2">
																<pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 text-xs">
																	{JSON.stringify(step.inputSnapshot, null, 2)}
																</pre>
																<pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 text-xs">
																	{JSON.stringify(step.outputSnapshot, null, 2)}
																</pre>
															</div>
														</div>
													))}
												</div>
											</>
										) : (
											<div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
												从左侧任务和实例列表选择一条记录，查看步骤日志、变量上下文和调试产物。
											</div>
										)}
									</div>
								</div>
							</Card>
						</div>
					)}
				</div>
			</div>

			<AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>关闭编辑窗口前先处理草稿</AlertDialogTitle>
						<AlertDialogDescription>
							当前流程还有未保存修改。你可以先保存，再关闭编辑窗口回到主界面；也可以直接放弃修改。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<Button
							type="button"
							variant="ghost"
							className="cursor-pointer"
							disabled={leavePending}
							onClick={() => setLeaveDialogOpen(false)}
						>
							继续编辑
						</Button>
						<Button
							type="button"
							variant="outline"
							className="cursor-pointer"
							disabled={leavePending}
							onClick={() => {
								setLeaveDialogOpen(false);
								void leaveToMain();
							}}
						>
							放弃修改并关闭
						</Button>
						<Button
							type="button"
							className="cursor-pointer"
							disabled={leavePending}
							onClick={() => {
								void (async () => {
									setLeavePending(true);
									try {
										const saved = await saveFlowDraft();
										if (!saved) {
											setLeaveDialogOpen(false);
											return;
										}
										setLeaveDialogOpen(false);
										await leaveToMain();
									} finally {
										setLeavePending(false);
									}
								})();
							}}
						>
							保存并关闭
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<Toaster />
		</div>
	);
}
