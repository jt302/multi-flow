import { Component, Suspense, useState, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useThemeSettings } from '@/entities/theme/model/use-theme-settings';
import { resolveSonnerTheme } from '@/entities/theme/model/sonner-theme';
import { openLogPanelWindow } from '@/entities/log-entry/api/logs-api';
import { Card, Sidebar, SidebarProvider, Toaster } from '@/components/ui';
import { useIsMobile } from '@/hooks/use-mobile';

import { resolveNavFromPath, resolvePathFromNav } from '@/app/workspace-routes';
import { buildWorkspaceLayoutOutletContext } from '@/app/model/workspace-layout-context';
import { ResourceDownloadListener } from './resource-download-listener';
import { PluginDownloadListener } from './plugin-download-listener';
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
import { normalizeCustomThemePreset } from '@/entities/theme/model/custom-presets';
import { reportFrontendError } from '@/shared/lib/frontend-errors';

class RouteErrorBoundary extends Component<
	{ children: ReactNode; pathname: string },
	{ error: Error | null }
> {
	state: { error: Error | null } = { error: null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		reportFrontendError('RouteErrorBoundary', error, info.componentStack ?? undefined);
	}

	componentDidUpdate(prevProps: { pathname: string }) {
		if (prevProps.pathname !== this.props.pathname && this.state.error) {
			this.setState({ error: null });
		}
	}

	render() {
		const { error } = this.state;
		if (error) {
			return (
				<div className="flex h-full items-center justify-center p-6">
					<div className="max-w-lg space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-5">
						<p className="text-sm font-semibold text-destructive">页面渲染出错</p>
						<p className="font-mono text-xs text-destructive/80 break-all">
							{error.message}
						</p>
						<button
							type="button"
							className="rounded bg-destructive px-3 py-1.5 text-xs text-destructive-foreground cursor-pointer hover:opacity-90"
							onClick={() => this.setState({ error: null })}
						>
							重试
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

function resolveActiveNav(pathname: string): NavId {
	return resolveNavFromPath(pathname) ?? 'dashboard';
}

function RouteContainer({
	pathname: _pathname,
	children,
}: {
	pathname: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col p-2 sm:p-3 md:p-4 animate-in fade-in zoom-in-[0.98] duration-500 fill-mode-both">
			{children}
		</div>
	);
}

function RouteSuspenseFallback({ pathname: _pathname }: { pathname: string }) {
	return (
		<div className="p-6 text-sm text-muted-foreground border border-border/40 bg-transparent rounded-xl flex items-center justify-center min-h-[50vh]">
			<div className="flex flex-col items-center gap-3 opacity-60">
				<div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			</div>
		</div>
	);
}

export function WorkspaceLayout() {
	const navigate = useNavigate();
	const location = useLocation();
	const isMobile = useIsMobile();
	const activeNav = resolveActiveNav(location.pathname);
	const themeState = useThemeSettings();
	const [sidebarOpen, setSidebarOpen] = useState(() =>
		resolveInitialSidebarOpen({
			cookieText: typeof document === 'undefined' ? '' : document.cookie,
			storageValue:
				typeof window === 'undefined'
					? null
					: window.localStorage.getItem(SIDEBAR_STORAGE_KEY),
		}),
	);
	const { t } = useTranslation('common');

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
				toast.error(t('openLogPanelFailed'));
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
				customPresets: themeState.customPresets,
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
				onAddCustomPreset: () => {
					const normalized = normalizeCustomThemePreset(themeState.customColor);
					if (!normalized) {
						return;
					}

					themeState.addCustomPreset(normalized);
				},
				onApplyCustomPreset: (value) => {
					themeState.setCustomColor(value);
					themeState.setUseCustomColor(true);
				},
				onDeleteCustomPreset: (value) => {
					themeState.removeCustomPreset(value);
				},
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
			<div className="relative h-dvh w-full overflow-hidden p-2 sm:p-4">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-1000"
					style={{
						background:
							'radial-gradient(circle at 10% 0%, color-mix(in oklab, var(--primary) 15%, transparent), transparent 50%), radial-gradient(circle at 90% 10%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 50%), radial-gradient(circle at 50% 100%, color-mix(in oklab, var(--primary) 8%, transparent), transparent 40%)',
					}}
				/>
				<div className="relative flex h-full min-h-0 w-full">
					<Sidebar
						variant="floating"
						collapsible="icon"
						className="border-0 [&_[data-slot=sidebar-inner]]:border [&_[data-slot=sidebar-inner]]:border-border/40 [&_[data-slot=sidebar-inner]]:bg-card/70 [&_[data-slot=sidebar-inner]]:backdrop-blur-3xl [&_[data-slot=sidebar-inner]]:shadow-xl [&_[data-slot=sidebar-inner]]:transition-all"
					>
						<WorkspaceSidebar
							activeNav={activeNav}
							activePath={location.pathname}
							onNavChange={(nav) => {
								const path = resolvePathFromNav(nav);
								navigate(path);
							}}
							onNavigate={(path) => navigate(path)}
						/>
					</Sidebar>

					<section className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col gap-2 sm:gap-4 bg-transparent pl-0 sm:pl-1 md:pl-2">
						<Card className="w-full shrink-0 border-border/40 bg-card/60 px-3 py-2 sm:px-4 sm:py-2.5 backdrop-blur-3xl shadow-sm transition-all duration-300">
							<WorkspaceTopbar
								activeNav={activeNav}
								themeMode={themeState.themeMode}
								onThemeModeChange={themeState.setThemeMode}
								onOpenLogPanel={handleOpenLogPanel}
								onNavigate={(path) => navigate(path)}
							/>
						</Card>
						<Card
							className="min-h-0 w-full flex-1 overflow-hidden flex flex-col border-border/40 bg-card/60 p-0 backdrop-blur-3xl shadow-md transition-all duration-300"
							data-mobile-layout={isMobile ? 'true' : 'false'}
						>
							<div className="flex-1 min-h-0 overflow-y-auto mf-scrollbar">
								<RouteContainer key={location.pathname} pathname={location.pathname}>
									<RouteErrorBoundary pathname={location.pathname}>
										<Suspense fallback={<RouteSuspenseFallback pathname={location.pathname} />}>
											<Outlet context={outletContext} />
										</Suspense>
									</RouteErrorBoundary>
								</RouteContainer>
							</div>
						</Card>
					</section>
				</div>
				<Toaster theme={toasterTheme} />
				<ResourceDownloadListener />
				<PluginDownloadListener />
			</div>
		</SidebarProvider>
	);
}
