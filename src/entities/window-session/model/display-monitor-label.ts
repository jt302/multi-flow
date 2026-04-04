import type { DisplayMonitorItem } from './types';

function normalizeText(value?: string | null): string | null {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

function joinIdentity(
	manufacturer?: string | null,
	model?: string | null,
): string | null {
	const parts = [normalizeText(manufacturer), normalizeText(model)].filter(
		Boolean,
	) as string[];
	if (parts.length === 0) {
		return null;
	}
	return parts.join(' ');
}

export function formatDisplayMonitorName(
	monitor: DisplayMonitorItem,
	translate: (key: string) => string,
) {
	const resolution = `${monitor.width}×${monitor.height}`;

	if (monitor.isBuiltin) {
		const builtinLabel = translate('window:arrange.builtinDisplay');
		return monitor.hostDeviceName
			? `${monitor.hostDeviceName} ${builtinLabel}`
			: builtinLabel;
	}

	const friendlyName = normalizeText(monitor.friendlyName);
	if (friendlyName) {
		return friendlyName;
	}

	const identity = joinIdentity(monitor.manufacturer, monitor.model);
	if (identity) {
		return identity;
	}

	const legacyName = normalizeText(monitor.name);
	if (legacyName) {
		return legacyName;
	}

	return `${resolution} ${translate('window:arrange.monitorFallback')}`;
}

export function formatDisplayMonitorOptionLabel(
	monitor: DisplayMonitorItem,
	translate: (key: string) => string,
) {
	const resolution = `${monitor.width}×${monitor.height}`;
	const name = formatDisplayMonitorName(monitor, translate);
	const label = name.includes(resolution) ? name : `${name} (${resolution})`;

	return monitor.isPrimary
		? `${label} (${translate('window:arrange.primaryMonitor')})`
		: label;
}
