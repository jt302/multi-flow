import { useCallback, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useWorkspaceRefresh } from '@/app/model/use-workspace-refresh';
import type { WorkspaceOutletContext } from '@/app/model/workspace-types';
import { useGroupsQuery } from '@/entities/group/model/use-groups-query';
import type { ProfileActionState } from '@/entities/profile/model/types';
import { useProfileProxyBindingsQuery } from '@/entities/profile/model/use-profile-proxy-bindings-query';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import type { ResourceProgressState } from '@/entities/resource/model/types';
import { useResourcesQuery } from '@/entities/resource/model/use-resources-query';
import { useProfileActions } from '@/features/profile/model/use-profile-actions';
import { useProfileRunningRecovery } from '@/features/profile/model/use-profile-running-recovery';
import { ProfilesPage } from '@/features/profile/ui/profiles-page';
import { useWindowActions } from '@/features/window-session/model/use-window-actions';

export function ProfilesRoutePage() {
	const { navigation } = useOutletContext<WorkspaceOutletContext>();
	const [profileActionStates, setProfileActionStates] = useState<
		Record<string, ProfileActionState>
	>({});
	const [, setResourceProgress] = useState<ResourceProgressState | null>(null);
	const profileActionLocksRef = useRef<Set<string>>(new Set());
	const profileCloseSuppressionRef = useRef<Map<string, number>>(new Map());
	const windowActionLocksRef = useRef<Set<string>>(new Set());
	const profileActionStatesRef = useRef<Record<string, ProfileActionState>>({});
	const groupsQuery = useGroupsQuery();
	const profilesQuery = useProfilesQuery();
	const proxiesQuery = useProxiesQuery();
	const resourcesQuery = useResourcesQuery();
	const {
		refreshGroups,
		refreshResources,
		refreshWindows,
		refreshWindowsStable,
		refreshProfilesAndBindings,
	} = useWorkspaceRefresh();

	const groups = useMemo(
		() => (groupsQuery.data ?? []).filter((item) => item.lifecycle === 'active'),
		[groupsQuery.data],
	);
	const profiles = profilesQuery.data ?? [];
	const proxies = proxiesQuery.data ?? [];
	const resources = resourcesQuery.data ?? [];
	const activeProfileIds = useMemo(
		() => profiles.filter((item) => item.lifecycle === 'active').map((item) => item.id),
		[profiles],
	);
	const bindingsQuery = useProfileProxyBindingsQuery(activeProfileIds);
	const profileProxyBindings = bindingsQuery.data ?? {};

	const setActionState = useCallback((profileId: string, state: ProfileActionState | null) => {
		setProfileActionStates((prev) => {
			if (state === null) {
				if (!(profileId in prev)) {
					return prev;
				}
				const next = { ...prev };
				delete next[profileId];
				return next;
			}

			return { ...prev, [profileId]: state };
		});
	}, []);

	profileActionStatesRef.current = profileActionStates;

	const withProfileActionLock = useCallback(
		async (profileId: string, action: () => Promise<void>) => {
			if (profileActionLocksRef.current.has(profileId)) {
				return;
			}
			profileActionLocksRef.current.add(profileId);
			try {
				await action();
			} finally {
				profileActionLocksRef.current.delete(profileId);
			}
		},
		[],
	);

	const withWindowActionLock = useCallback(
		async (profileId: string, action: () => Promise<void>) => {
			if (windowActionLocksRef.current.has(profileId)) {
				return;
			}
			windowActionLocksRef.current.add(profileId);
			try {
				await action();
			} finally {
				windowActionLocksRef.current.delete(profileId);
			}
		},
		[],
	);

	const suppressRunningRecovery = useCallback((profileIds: string[]) => {
		const suppressedUntil = Date.now() + 6000;
		for (const profileId of profileIds) {
			profileCloseSuppressionRef.current.set(profileId, suppressedUntil);
		}
	}, []);

	useProfileRunningRecovery({
		profiles,
		profileActionStatesRef,
		profileActionLocksRef,
		profileCloseSuppressionRef,
		setActionState,
	});

	const profileActions = useProfileActions({
		setActionState,
		withProfileActionLock,
		suppressRunningRecovery,
		setResourceProgress,
		refreshProfilesAndBindings,
		refreshGroups,
		refreshWindows,
		refreshResources,
		refreshDevicePresets: async () => {},
	});
	const { focusWindow } = useWindowActions({
		withWindowActionLock,
		refreshWindowsStable,
		refreshProfilesAndBindings,
	});

	return (
		<ProfilesPage
			profiles={profiles}
			groups={groups}
			proxies={proxies}
			profileProxyBindings={profileProxyBindings}
			resources={resources}
			profileActionStates={profileActionStates}
			onCreateProfile={profileActions.createProfile}
			onUpdateProfile={profileActions.updateProfile}
			onUpdateProfileVisual={profileActions.updateProfileVisual}
			onOpenProfile={profileActions.openProfile}
			onCloseProfile={profileActions.closeProfile}
			onSetProfileGroup={profileActions.setProfileGroup}
			onFocusProfileWindow={focusWindow}
			onBatchOpenProfiles={profileActions.batchOpenProfiles}
			onBatchCloseProfiles={profileActions.batchCloseProfiles}
			onBatchSetProfileGroup={profileActions.batchSetProfileGroup}
			onDuplicateProfile={profileActions.duplicateProfile}
			onDeleteProfile={profileActions.deleteProfile}
			onRestoreProfile={profileActions.restoreProfile}
			onReadProfileCookies={profileActions.readProfileCookies}
			onExportProfileCookies={profileActions.exportProfileCookies}
			onRefreshProfiles={refreshProfilesAndBindings}
			navigationIntent={navigation.intent}
			onConsumeNavigationIntent={navigation.onConsumeNavigationIntent}
			onNavigate={navigation.onNavigate}
		/>
	);
}
