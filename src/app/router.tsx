import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import { WorkspaceLayout } from '@/app/ui/workspace-layout';
import { PROFILES_DEVICE_PRESETS_PATH } from '@/app/workspace-routes';
import { LogPanelPage } from '@/pages/log-panel';
import { RootRedirectPage } from '@/pages/root-redirect';

const DashboardRoutePage = lazy(() =>
	import('@/pages/dashboard').then((module) => ({
		default: module.DashboardRoutePage,
	})),
);
const ProfilesRoutePage = lazy(() =>
	import('@/pages/profiles').then((module) => ({
		default: module.ProfilesRoutePage,
	})),
);
const PluginsRoutePage = lazy(() =>
	import('@/pages/plugins').then((module) => ({
		default: module.PluginsRoutePage,
	})),
);
const GroupsRoutePage = lazy(() =>
	import('@/pages/groups').then((module) => ({
		default: module.GroupsRoutePage,
	})),
);
const ProxyRoutePage = lazy(() =>
	import('@/pages/proxy').then((module) => ({
		default: module.ProxyRoutePage,
	})),
);
const WindowsRoutePage = lazy(() =>
	import('@/pages/windows').then((module) => ({
		default: module.WindowsRoutePage,
	})),
);
const BrowserControlRoutePage = lazy(() =>
	import('@/pages/browser-control').then((module) => ({
		default: module.BrowserControlRoutePage,
	})),
);
const SettingsRoutePage = lazy(() =>
	import('@/pages/settings').then((module) => ({
		default: module.SettingsRoutePage,
	})),
);
const AutomationRoutePage = lazy(() =>
	import('@/pages/automation').then((module) => ({
		default: module.AutomationRoutePage,
	})),
);
const AiChatRoutePage = lazy(() =>
	import('@/pages/ai-chat').then((module) => ({
		default: module.AiChatRoutePage,
	})),
);
const AutomationCanvasRoutePage = lazy(() =>
	import('@/pages/automation-canvas').then((module) => ({
		default: module.AutomationCanvasRoutePage,
	})),
);
const DevicePresetsRoutePage = lazy(() =>
	import('@/pages/device-presets').then((module) => ({
		default: module.DevicePresetsRoutePage,
	})),
);

export function AppRouter() {
	return (
		<Routes>
			<Route path="/" element={<RootRedirectPage />} />
			<Route path="/logs" element={<LogPanelPage />} />
			<Route
				path="/automation/:scriptId/canvas"
				element={<AutomationCanvasRoutePage />}
			/>
			<Route element={<WorkspaceLayout />}>
				<Route path="/dashboard" element={<DashboardRoutePage />} />
				<Route path="/profiles" element={<ProfilesRoutePage />} />
				<Route
					path={PROFILES_DEVICE_PRESETS_PATH}
					element={<DevicePresetsRoutePage />}
				/>
				<Route path="/plugins" element={<PluginsRoutePage />} />
				<Route path="/groups" element={<GroupsRoutePage />} />
				<Route path="/proxy" element={<ProxyRoutePage />} />
				<Route path="/windows" element={<WindowsRoutePage />} />
				<Route path="/browser-control" element={<BrowserControlRoutePage />} />
				<Route path="/automation" element={<AutomationRoutePage />} />
				<Route path="/ai-chat" element={<AiChatRoutePage />} />
				<Route path="/settings" element={<SettingsRoutePage />} />
			</Route>
		</Routes>
	);
}
