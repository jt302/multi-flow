import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { WorkspaceLayout } from '@/app/ui/workspace-layout';
import {
	AI_CHAT_DEFAULT_PATH,
	AI_CHAT_PATHS,
	PROFILES_DEVICE_PRESETS_PATH,
	SETTINGS_DEFAULT_PATH,
	SETTINGS_PATHS,
} from '@/app/workspace-routes';
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
const AiChatSessionsRoutePage = lazy(() =>
	import('@/pages/ai-chat/sessions').then((module) => ({
		default: module.AiChatSessionsRoutePage,
	})),
);
const AiChatSkillsRoutePage = lazy(() =>
	import('@/pages/ai-chat/skills').then((module) => ({
		default: module.AiChatSkillsRoutePage,
	})),
);
const AiChatFileSystemRoutePage = lazy(() =>
	import('@/pages/ai-chat/file-system').then((module) => ({
		default: module.AiChatFileSystemRoutePage,
	})),
);
const AiChatMcpRoutePage = lazy(() =>
	import('@/pages/ai-chat/mcp').then((module) => ({
		default: module.AiChatMcpRoutePage,
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
			<Route path="/automation/:scriptId/canvas" element={<AutomationCanvasRoutePage />} />
			<Route element={<WorkspaceLayout />}>
				<Route path="/dashboard" element={<DashboardRoutePage />} />
				<Route path="/profiles" element={<ProfilesRoutePage />} />
				<Route path={PROFILES_DEVICE_PRESETS_PATH} element={<DevicePresetsRoutePage />} />
				<Route path="/plugins" element={<PluginsRoutePage />} />
				<Route path="/groups" element={<GroupsRoutePage />} />
				<Route path="/proxy" element={<ProxyRoutePage />} />
				<Route path="/windows" element={<WindowsRoutePage />} />
				<Route path="/browser-control" element={<BrowserControlRoutePage />} />
				<Route path="/automation" element={<AutomationRoutePage />} />
				<Route path="/ai-chat" element={<Navigate to={AI_CHAT_DEFAULT_PATH} replace />} />
				<Route path={AI_CHAT_PATHS.sessions} element={<AiChatSessionsRoutePage />} />
				<Route path={AI_CHAT_PATHS.skills} element={<AiChatSkillsRoutePage />} />
				<Route path={AI_CHAT_PATHS.fileSystem} element={<AiChatFileSystemRoutePage />} />
				<Route path={AI_CHAT_PATHS.mcp} element={<AiChatMcpRoutePage />} />
				<Route path="/settings" element={<Navigate to={SETTINGS_DEFAULT_PATH} replace />} />
				<Route path={SETTINGS_PATHS.general} element={<SettingsRoutePage />} />
				<Route path={SETTINGS_PATHS.appearance} element={<SettingsRoutePage />} />
				<Route path={SETTINGS_PATHS.resources} element={<SettingsRoutePage />} />
				<Route path={SETTINGS_PATHS.ai} element={<SettingsRoutePage />} />
				<Route path={SETTINGS_PATHS['recycle-bin']} element={<SettingsRoutePage />} />
				{import.meta.env.DEV ? (
					<Route path={SETTINGS_PATHS.dev} element={<SettingsRoutePage />} />
				) : null}
			</Route>
		</Routes>
	);
}
