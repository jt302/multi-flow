import { Eye, Focus, LayoutPanelTop, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Checkbox,
	Icon,
} from '@/components/ui';
import type { ProfileItem } from '@/entities/profile/model/types';
import type {
	ProfileWindowStateItem,
	WindowBoundsItem,
} from '@/entities/window-session/model/types';
import { WindowBoundsForm } from './window-bounds-form';

type WindowStatesCardProps = {
	profiles: ProfileItem[];
	windowStates: ProfileWindowStateItem[];
	selectedProfileIds: string[];
	pendingProfileIds: Set<string>;
	error: string | null;
	onSelectProfile: (profileId: string, checked: boolean) => void;
	onViewProfile: (profileId: string) => void;
	onRunProfileAction: (profileId: string, action: () => Promise<void>) => void;
	onResolveValidatedActionUrl: () => Promise<string>;
	onOpenTab: (profileId: string, url?: string) => Promise<void>;
	onCloseTab: (profileId: string, tabId?: number) => Promise<void>;
	onCloseInactiveTabs: (profileId: string, windowId?: number) => Promise<void>;
	onActivateTab: (profileId: string, tabId: number) => Promise<void>;
	onActivateTabByIndex: (profileId: string, index: number, windowId?: number) => Promise<void>;
	onOpenWindow: (profileId: string, url?: string) => Promise<void>;
	onCloseWindow: (profileId: string, windowId?: number) => Promise<void>;
	onFocusWindow: (profileId: string, windowId?: number) => Promise<void>;
	onSetWindowBounds: (
		profileId: string,
		bounds: WindowBoundsItem,
		windowId?: number,
	) => Promise<void>;
};

export function WindowStatesCard({
	profiles,
	windowStates,
	selectedProfileIds,
	pendingProfileIds,
	error,
	onSelectProfile,
	onViewProfile,
	onRunProfileAction,
	onResolveValidatedActionUrl,
	onOpenTab,
	onCloseTab,
	onCloseInactiveTabs,
	onActivateTab,
	onActivateTabByIndex,
	onOpenWindow,
	onCloseWindow,
	onFocusWindow,
	onSetWindowBounds,
}: WindowStatesCardProps) {
	const { t } = useTranslation('window');

	const profileNameMap = profiles.reduce<Record<string, string>>((acc, item) => {
		acc[item.id] = item.name;
		return acc;
	}, {});
	const profileRunningMap = profiles.reduce<Record<string, boolean>>((acc, item) => {
		acc[item.id] = item.running && item.lifecycle === 'active';
		return acc;
	}, {});
	const windowProfileIds = new Set(windowStates.map((item) => item.profileId));
	const runningWithoutWindows = profiles.filter(
		(item) => item.lifecycle === 'active' && item.running && !windowProfileIds.has(item.id),
	);

	return (
		<Card className="p-3">
			<CardHeader className="px-1 pb-2">
				<CardTitle className="text-sm">{t('states.title')}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 px-1 pt-0">
				{windowStates.length === 0 ? (
					<div className="rounded-xl border border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
						{t('states.noRunningWindows')}
					</div>
				) : (
					windowStates.map((state) => {
						const profileLabel = profileNameMap[state.profileId] ?? state.profileId;
						const selected = selectedProfileIds.includes(state.profileId);
						const isRunning = profileRunningMap[state.profileId] ?? true;
						const profileBusy = pendingProfileIds.has(state.profileId);
						const hasWindowSnapshot = state.totalWindows > 0;
						const controllable = isRunning && hasWindowSnapshot && !profileBusy;
						return (
							<div key={state.profileId} className="rounded-xl border border-border/70 p-3">
								<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<Checkbox
											checked={selected}
											onCheckedChange={(checked) =>
												onSelectProfile(state.profileId, checked === true)
											}
										/>
										<p className="text-sm font-semibold">{profileLabel}</p>
										<Badge variant="outline">
											{state.totalWindows} {t('states.windows')}
										</Badge>
										<Badge variant="secondary">
											{state.totalTabs} {t('states.tabs')}
										</Badge>
										<Badge variant={isRunning ? 'default' : 'secondary'}>
											{isRunning
												? profileBusy
													? t('states.operating')
													: t('states.running')
												: t('states.stopped')}
										</Badge>
										{isRunning && !hasWindowSnapshot ? (
											<Badge variant="outline">{t('states.syncing')}</Badge>
										) : null}
										{state.pid ? <Badge variant="secondary">PID {state.pid}</Badge> : null}
									</div>
									<div className="flex items-center gap-1">
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="cursor-pointer"
											onClick={() => onViewProfile(state.profileId)}
										>
											<Icon icon={Eye} size={12} />
											{t('states.profileDetail')}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="cursor-pointer"
											onClick={() =>
												onRunProfileAction(state.profileId, async () =>
													onOpenTab(state.profileId, await onResolveValidatedActionUrl()),
												)
											}
											disabled={!controllable}
										>
											<Icon icon={Plus} size={12} />
											{t('states.newTab')}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="cursor-pointer"
											onClick={() =>
												onRunProfileAction(state.profileId, async () =>
													onOpenWindow(state.profileId, await onResolveValidatedActionUrl()),
												)
											}
											disabled={!controllable}
										>
											<Icon icon={LayoutPanelTop} size={12} />
											{t('states.newWindow')}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="cursor-pointer"
											onClick={() =>
												onRunProfileAction(state.profileId, async () => onCloseTab(state.profileId))
											}
											disabled={!controllable}
										>
											<Icon icon={X} size={12} />
											{t('states.closeCurrentTab')}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="cursor-pointer"
											onClick={() =>
												onRunProfileAction(state.profileId, async () =>
													onCloseInactiveTabs(state.profileId),
												)
											}
											disabled={!controllable}
										>
											<Icon icon={X} size={12} />
											{t('states.closeBgTabs')}
										</Button>
									</div>
								</div>

								<div className="space-y-2">
									{state.windows.map((window) => (
										<div
											key={`${state.profileId}-${window.windowId}`}
											className="rounded-lg border border-border/60 p-2"
										>
											<div className="mb-1 flex items-center justify-between">
												<div className="flex items-center gap-2 text-xs">
													<Badge variant={window.focused ? 'default' : 'secondary'}>
														{t('states.windowNumber', { id: window.windowId })}
													</Badge>
													<Badge variant="outline">
														{window.tabCount} {t('states.tabs')}
													</Badge>
												</div>
												<div className="flex items-center gap-1">
													<Button
														type="button"
														size="icon"
														variant="ghost"
														className="h-7 w-7 cursor-pointer"
														onClick={() =>
															onRunProfileAction(state.profileId, async () =>
																onFocusWindow(state.profileId, window.windowId),
															)
														}
														disabled={!controllable}
													>
														<Icon icon={Focus} size={12} />
													</Button>
													<Button
														type="button"
														size="icon"
														variant="ghost"
														className="h-7 w-7 cursor-pointer"
														onClick={() =>
															onRunProfileAction(state.profileId, async () =>
																onCloseWindow(state.profileId, window.windowId),
															)
														}
														disabled={!controllable}
													>
														<Icon icon={X} size={12} />
													</Button>
												</div>
											</div>

											<WindowBoundsForm
												window={window}
												controllable={controllable}
												onApply={async (windowId, bounds) => {
													onRunProfileAction(state.profileId, async () =>
														onSetWindowBounds(state.profileId, bounds, windowId),
													);
												}}
											/>

											<div className="space-y-1">
												{window.tabs.map((tab) => (
													<div
														key={`${state.profileId}-${window.windowId}-${tab.tabId}`}
														className="flex items-center justify-between rounded-md border border-border/50 px-2 py-1"
													>
														<div className="min-w-0">
															<div className="flex items-center gap-2">
																{tab.active ? (
																	<Badge variant="default">{t('states.current')}</Badge>
																) : (
																	<Badge variant="secondary">{t('states.background')}</Badge>
																)}
																<p className="truncate text-xs font-medium">{tab.title}</p>
															</div>
															<p className="truncate text-[11px] text-muted-foreground">
																{tab.url}
															</p>
														</div>
														<div className="flex items-center gap-1">
															<Button
																type="button"
																size="icon"
																variant="ghost"
																className="h-7 w-7 cursor-pointer"
																onClick={() =>
																	onRunProfileAction(state.profileId, async () =>
																		onActivateTab(state.profileId, tab.tabId),
																	)
																}
																disabled={!controllable}
															>
																<Icon icon={Focus} size={12} />
															</Button>
															<Button
																type="button"
																size="icon"
																variant="ghost"
																className="h-7 w-7 cursor-pointer"
																onClick={() =>
																	onRunProfileAction(state.profileId, async () =>
																		onCloseTab(state.profileId, tab.tabId),
																	)
																}
																disabled={!controllable}
															>
																<Icon icon={X} size={12} />
															</Button>
														</div>
													</div>
												))}
											</div>
											<div className="mt-2 flex justify-end">
												<Button
													type="button"
													size="sm"
													variant="ghost"
													className="cursor-pointer"
													onClick={() =>
														onRunProfileAction(state.profileId, async () =>
															onActivateTabByIndex(state.profileId, 0, window.windowId),
														)
													}
													disabled={!controllable}
												>
													<Icon icon={Focus} size={12} />
													{t('states.activateFirstTab')}
												</Button>
											</div>
										</div>
									))}
								</div>
							</div>
						);
					})
				)}
				{runningWithoutWindows.length > 0 ? (
					<div className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
						{t('states.runningWithoutWindows')}
						{runningWithoutWindows.map((item) => ` ${item.name}(${item.id})`).join('、')}
					</div>
				) : null}
				{error ? <p className="text-xs text-destructive">{error}</p> : null}
			</CardContent>
		</Card>
	);
}
