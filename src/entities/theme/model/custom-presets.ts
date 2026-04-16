import { hexToRgb } from '@/shared/lib/color';

import type { CustomThemePreset } from './types';

function expandShortHex(value: string): string {
	if (value.length !== 3) {
		return value;
	}

	return value
		.split('')
		.map((char) => `${char}${char}`)
		.join('');
}

export function normalizeCustomThemePreset(
	value: string,
): CustomThemePreset | null {
	const pure = value.trim().replace(/^#/, '');
	const normalized = expandShortHex(pure);

	if (!hexToRgb(`#${normalized}`)) {
		return null;
	}

	return `#${normalized.toUpperCase()}`;
}

export function readCustomThemePresets(
	value: string | null,
): CustomThemePreset[] {
	if (!value) {
		return [];
	}

	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) {
			return [];
		}

		const result: CustomThemePreset[] = [];
		const seen = new Set<string>();

		for (const item of parsed) {
			if (typeof item !== 'string') {
				continue;
			}

			const normalized = normalizeCustomThemePreset(item);
			if (!normalized || seen.has(normalized)) {
				continue;
			}

			seen.add(normalized);
			result.push(normalized);
		}

		return result;
	} catch {
		return [];
	}
}

export function addCustomThemePreset(
	current: CustomThemePreset[],
	value: string,
): CustomThemePreset[] {
	const normalized = normalizeCustomThemePreset(value);
	if (!normalized) {
		return current;
	}

	return [normalized, ...current.filter((item) => item !== normalized)];
}

export function removeCustomThemePreset(
	current: CustomThemePreset[],
	value: string,
): CustomThemePreset[] {
	const normalized = normalizeCustomThemePreset(value);
	if (!normalized) {
		return current;
	}

	return current.filter((item) => item !== normalized);
}
