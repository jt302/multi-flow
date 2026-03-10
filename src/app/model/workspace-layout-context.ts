import type { WorkspaceOutletContext } from './workspace-types';

type WorkspaceLayoutOutletContextInput = WorkspaceOutletContext & Record<string, unknown>;

export function buildWorkspaceLayoutOutletContext(
	input: WorkspaceLayoutOutletContextInput,
): WorkspaceOutletContext {
	return {
		activeNav: input.activeNav,
		theme: input.theme,
		navigation: input.navigation,
	};
}
