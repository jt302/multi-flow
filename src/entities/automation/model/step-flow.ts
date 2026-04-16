import type { ScriptStep } from './types';

export const TERMINAL_STEP_KINDS = ['end', 'magic_safe_quit'] as const;

const TERMINAL_STEP_KIND_SET = new Set<string>(TERMINAL_STEP_KINDS);

export function isTerminalStepKind(kind: ScriptStep['kind'] | string): boolean {
	return TERMINAL_STEP_KIND_SET.has(kind);
}
