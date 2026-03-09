export const queryKeys = {
	groups: ['groups'] as const,
	profiles: ['profiles'] as const,
	proxies: ['proxies'] as const,
	resources: ['resources'] as const,
	devicePresets: ['device-presets'] as const,
	windowStates: ['window-states'] as const,
	rpaFlowsRoot: ['rpa-flows'] as const,
	rpaFlows: (includeDeleted: boolean) => ['rpa-flows', includeDeleted] as const,
	rpaRuns: ['rpa-runs'] as const,
	rpaRunDetails: (runId: string | null) => ['rpa-run-details', runId] as const,
	rpaRunSteps: (instanceId: string | null) => ['rpa-run-steps', instanceId] as const,
	profileProxyBindings: (profileIds: string[]) => ['profile-proxy-bindings', ...profileIds] as const,
};
