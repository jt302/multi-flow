import type { Edge, Node } from '@xyflow/react';

import { START_NODE_ID } from './canvas-helpers';

export type CanvasDeleteTargets = {
	nodeIds: string[];
	edgeIds: string[];
};

export function resolveCanvasDeleteTargets(
	nodes: Node[],
	edges: Edge[],
	lastClickedEdgeId: string | null,
): CanvasDeleteTargets {
	const selectedNodeIds = nodes
		.filter((node) => node.selected && node.id !== START_NODE_ID)
		.map((node) => node.id);

	if (selectedNodeIds.length > 0) {
		return { nodeIds: selectedNodeIds, edgeIds: [] };
	}

	const selectedEdgeIds = edges.filter((edge) => edge.selected).map((edge) => edge.id);
	if (selectedEdgeIds.length > 0) {
		return { nodeIds: [], edgeIds: selectedEdgeIds };
	}

	if (lastClickedEdgeId) {
		return { nodeIds: [], edgeIds: [lastClickedEdgeId] };
	}

	return { nodeIds: [], edgeIds: [] };
}
