const RPA_EDITOR_STANDALONE = 'rpa-editor';
export const RPA_FLOWS_UPDATED_EVENT = 'rpa:flows-updated';

export type RpaEditorSearchState = {
	createMode: boolean;
	flowId: string | null;
};

export function buildRpaEditorStandaloneSearch(flowId?: string | null) {
	const params = new URLSearchParams({
		standalone: RPA_EDITOR_STANDALONE,
	});
	if (flowId?.trim()) {
		params.set('flowId', flowId.trim());
	} else {
		params.set('mode', 'create');
	}
	return `?${params.toString()}`;
}

export function buildRpaEditorRoute(flowId?: string | null) {
	const params = new URLSearchParams();
	if (flowId?.trim()) {
		params.set('flowId', flowId.trim());
	} else {
		params.set('mode', 'create');
	}
	return `/rpa-editor?${params.toString()}`;
}

export function parseRpaEditorSearch(search: string): RpaEditorSearchState {
	const params = new URLSearchParams(search);
	const flowId = params.get('flowId')?.trim() || null;
	return {
		createMode: params.get('mode') === 'create',
		flowId,
	};
}
