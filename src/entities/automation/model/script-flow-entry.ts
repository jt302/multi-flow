import type { AutomationScript } from './types';

export type ScriptFlowEntryState = {
	entryConnected: boolean;
	orphanedStepCount: number;
};

export function resolveScriptFlowEntryState(
	script: Pick<AutomationScript, 'steps' | 'canvasPositionsJson'>,
): ScriptFlowEntryState {
	if (script.steps.length === 0) {
		return { entryConnected: true, orphanedStepCount: 0 };
	}

	if (!script.canvasPositionsJson) {
		return { entryConnected: true, orphanedStepCount: 0 };
	}

	try {
		const parsed = JSON.parse(script.canvasPositionsJson) as {
			startEdgeTarget?: string | null;
			orphanedSteps?: unknown[];
		};
		const orphanedStepCount = Array.isArray(parsed.orphanedSteps) ? parsed.orphanedSteps.length : 0;
		if (parsed.startEdgeTarget === null) {
			return { entryConnected: false, orphanedStepCount };
		}
		return { entryConnected: true, orphanedStepCount };
	} catch {
		// Ignore invalid or legacy canvas payloads and fall back to the historical connected behavior.
	}

	return { entryConnected: true, orphanedStepCount: 0 };
}
