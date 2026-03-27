export const queryKeys = {
	groups: ['groups'] as const,
	profiles: ['profiles'] as const,
	profileRuntimeDetails: (profileId: string | null) => ['profile-runtime-details', profileId] as const,
	proxies: ['proxies'] as const,
	resources: ['resources'] as const,
	devicePresets: ['device-presets'] as const,
	windowStates: ['window-states'] as const,
	syncTargets: ['sync-targets'] as const,
	displayMonitors: ['display-monitors'] as const,
	profileProxyBindings: (profileIds: string[]) => ['profile-proxy-bindings', ...profileIds] as const,
	automationScripts: ['automation-scripts'] as const,
	automationRuns: (scriptId: string) => ['automation-runs', scriptId] as const,
};
