import { Suspense, useState, type CSSProperties } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useThemeSettings } from '@/entities/theme/model/use-theme-settings';
import { resolveSonnerTheme } from '@/entities/theme/model/sonner-theme';
import { openLogPanelWindow } from '@/entities/log-entry/api/logs-api';
import {
	Card,
	ScrollArea,
	Sidebar,
	SidebarProvider,
	Toaster,
} from '@/components/ui';
import { resolveNavFromPath, resolvePathFromNav } from '@/app/workspace-routes';
import { buildWorkspaceLayoutOutletContext } from '@/app/model/workspace-layout-context';
import type {
	NavId,
	WorkspaceOutletContext,
} from '@/app/model/workspace-types';
import { useWorkspaceNavigationStore } from '@/store/workspace-navigation-store';
import {
	persistSidebarOpen,
	resolveInitialSidebarOpen,
	SIDEBAR_STORAGE_KEY,
} from './workspace-sidebar-state';
import { WorkspaceSidebar } from './workspace-sidebar';
import { WorkspaceTopbar } from './workspace-topbar';

function resolveActiveNav(pathname: string): NavId {
	return resolveNavFromPath(pathname) ?? 'dashboard';
}

export function WorkspaceLayout() {
	const navigate = useNavigate();
	const location = useLocation();
	const activeNav = resolveActiveNav(location.pathname);
	const themeState = useThemeSettings();
	const [isRunning, setIsRunning] = useState(true);
	const [sidebarOpen, setSidebarOpen] = useState(() =>
		resolveInitialSidebarOpen({
			cookieText: typeof document === 'undefined' ? '' : document.cookie,
			storageValue:
				typeof window === 'undefined'
					? null
					: window.localStorage.getItem(SIDEBAR_STORAGE_KEY),
		}),
	);
	const profileNavigationIntent = useWorkspaceNavigationStore(
		(state) => state.profileNavigationIntent,
	);
	const setProfileNavigationIntent = useWorkspaceNavigationStore(
		(state) => state.setProfileNavigationIntent,
	);
	const clearProfileNavigationIntent = useWorkspaceNavigationStore(
		(state) => state.clearProfileNavigationIntent,
	);

	const toasterTheme = resolveSonnerTheme(themeState.resolvedMode);
	const handleOpenLogPanel = () => {
		void (async () => {
			try {
				await openLogPanelWindow();
			} catch {
				toast.error('打开日志面板失败，已切换到内嵌页面');
				navigate('/logs');
			}
		})();
	};

	const outletContext: WorkspaceOutletContext =
		buildWorkspaceLayoutOutletContext({
			activeNav,
			theme: {
				resolvedMode: themeState.resolvedMode,
				useCustomColor: themeState.useCustomColor,
				preset: themeState.preset,
				customColor: themeState.customColor,
				themeMode: themeState.themeMode,
				setThemeMode: themeState.setThemeMode,
				onPresetChange: (nextPreset) => {
					themeState.setUseCustomColor(false);
					themeState.setPreset(nextPreset);
				},
				onCustomColorChange: (value) => {
					themeState.setUseCustomColor(true);
					themeState.setCustomColor(value);
				},
				onToggleCustomColor: () =>
					themeState.setUseCustomColor((prev) => !prev),
			},
			navigation: {
				pathname: location.pathname,
				intent: profileNavigationIntent,
				onConsumeNavigationIntent: clearProfileNavigationIntent,
				onSetProfileNavigationIntent: setProfileNavigationIntent,
				onNavigate: (path) => navigate(path),
			},
		});

	return (
		<SidebarProvider
			open={sidebarOpen}
			onOpenChange={(open) => {
				setSidebarOpen(open);
				persistSidebarOpen(open);
			}}
			style={
				{
					'--sidebar-width': '15rem',
					'--sidebar-width-icon': '3.25rem',
				} as CSSProperties
			}
		>
			<div className="relative h-dvh w-full overflow-hidden p-3 md:p-5">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-75"
					style={{
						background:
							'radial-gradient(circle at 8% 0%, color-mix(in oklab, var(--primary) 26%, transparent), transparent 42%), radial-gradient(circle at 92% 12%, color-mix(in oklab, var(--primary) 15%, transparent), transparent 40%)',
					}}
				/>
				<div className="relative flex h-full min-h-0 w-full">
					<Sidebar
						variant="floating"
						collapsible="icon"
						className="border-0 [&_[data-slot=sidebar-inner]]:border [&_[data-slot=sidebar-inner]]:border-border/60 [&_[data-slot=sidebar-inner]]:bg-card/92 [&_[data-slot=sidebar-inner]]:backdrop-blur-2xl"
					>
						<WorkspaceSidebar
							activeNav={activeNav}
							onNavChange={(nav) => navigate(resolvePathFromNav(nav))}
							isRunning={isRunning}
							onToggleRunning={() => setIsRunning((prev) => !prev)}
						/>
					</Sidebar>

					<section className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col gap-3 bg-transparent md:pl-2">
						<Card className="w-full shrink-0 border-border/60 bg-card/84 p-4 backdrop-blur-2xl md:p-5">
							<WorkspaceTopbar
								activeNav={activeNav}
								themeMode={themeState.themeMode}
								onThemeModeChange={themeState.setThemeMode}
								onOpenLogPanel={handleOpenLogPanel}
								onNavigate={(path) => navigate(path)}
							/>
						</Card>
						<Card className="min-h-0 w-full flex-1 overflow-hidden border-border/60 bg-card/84 p-0 backdrop-blur-2xl">
							<ScrollArea className="h-full w-full p-4 md:p-5">
								<div className="w-full min-w-0">
									<Suspense
										fallback={
											<Card className="p-6 text-sm text-muted-foreground">
												页面加载中...
											</Card>
										}
									>
										<Outlet context={outletContext} />
									</Suspense>
								</div>
							</ScrollArea>
						</Card>
					</section>
				</div>
				<Toaster theme={toasterTheme} />
			</div>
		</SidebarProvider>
	);
}
