import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
	addEdge,
	type Connection,
	type Edge,
	type Node,
	useEdgesState,
	useNodesState,
} from '@xyflow/react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod/v3';

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
} from '@/entities/rpa/model/types';
import { useRpaActions } from '@/features/rpa/model/use-rpa-actions';
import {
	buildComparableFlowDraft,
	hasPendingFlowChanges,
	resolveRpaEditorLeaveMode,
} from '@/features/rpa/model/rpa-editor-close-guard';
import {
	buildRpaEditorRoute,
	parseRpaEditorSearch,
} from '@/features/rpa/model/rpa-editor-window';
import {
	parseNodeConfigText,
	parseVariablesText,
	resolveNodeConfigGuide,
	rpaFlowMetaSchema,
	rpaNodeConfigSchema,
	stringifyVariables,
	validateNodeConfigForKind,
} from '@/features/rpa/model/rpa-editor';
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

export function useRpaFlowEditor() {
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
	const selectedNodeConfigGuide = useMemo(
		() =>
			resolveNodeConfigGuide(
				String((selectedNode?.data as { kind?: string })?.kind ?? ''),
			),
		[selectedNode],
	);
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
			navigate('/rpa');
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
							queryClient.invalidateQueries({ queryKey: queryKeys.rpaRunsRoot }),
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
		const nodeKind = String((selectedNode.data as { kind?: string })?.kind ?? '');
		const fieldErrors = validateNodeConfigForKind(nodeKind, nextConfig);
		if (fieldErrors.length > 0) {
			nodeConfigForm.setError('configText', {
				type: 'manual',
				message: fieldErrors[0],
			});
			return;
		}
		nodeConfigForm.clearErrors('configText');
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

	return {
		actions,
		activePanel,
		setActivePanel,
		selectedFlow,
		selectedNode,
		selectedNodeConfigGuide,
		selectedRun,
		selectedInstance,
		leaveDialogOpen,
		setLeaveDialogOpen,
		leavePending,
		setLeavePending,
		profiles,
		groups,
		runs,
		nodes,
		edges,
		onNodesChange,
		onEdgesChange,
		setNodes,
		setEdges,
		flowForm,
		nodeConfigForm,
		runForm,
		defaultTargetProfileIds,
		setDefaultTargetProfileIds,
		runTargetProfileIds,
		setRunTargetProfileIds,
		runDetailsQuery,
		runStepsQuery,
		isCreateMode,
		flowMissing,
		hasUnsavedChanges,
		handleConnect,
		handleStartNewDraft,
		handleAddNode,
		handleApplyNodeConfig,
		handleRunFlow,
		saveFlowDraft,
		requestLeaveToMain,
		leaveToMain,
		setSelectedNodeId,
		setSelectedRunId,
		setSelectedInstanceId,
		nodeLibrary: NODE_LIBRARY,
		formatStatus,
		statusVariant,
	};
}

export type RpaFlowEditorModel = ReturnType<typeof useRpaFlowEditor>;
