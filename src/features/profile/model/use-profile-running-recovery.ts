import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { ProfileActionState, ProfileItem } from '@/entities/profile/model/types';

type UseProfileRunningRecoveryOptions = {
	profiles: ProfileItem[];
	profileActionStatesRef: MutableRefObject<Record<string, ProfileActionState>>;
	profileActionLocksRef: MutableRefObject<Set<string>>;
	profileCloseSuppressionRef: MutableRefObject<Map<string, number>>;
	setActionState: (profileId: string, state: ProfileActionState | null) => void;
};

type ShouldMarkProfileRecoveredInput = {
	previousRunning?: boolean;
	currentRunning: boolean;
	lifecycle: ProfileItem['lifecycle'];
	actionState?: ProfileActionState;
	actionLocked: boolean;
	closeSuppressed: boolean;
};

export function shouldMarkProfileRecovered({
	previousRunning,
	currentRunning,
	lifecycle,
	actionState,
	actionLocked,
	closeSuppressed,
}: ShouldMarkProfileRecoveredInput) {
	return Boolean(
		previousRunning &&
			!currentRunning &&
			!actionState &&
			!actionLocked &&
			!closeSuppressed &&
			lifecycle === 'active',
	);
}

export function useProfileRunningRecovery({
	profiles,
	profileActionStatesRef,
	profileActionLocksRef,
	profileCloseSuppressionRef,
	setActionState,
}: UseProfileRunningRecoveryOptions) {
	const previousProfilesRef = useRef<ProfileItem[]>([]);
	const { t } = useTranslation('profile');

	useEffect(() => {
		const previousProfileMap = new Map(previousProfilesRef.current.map((item) => [item.id, item]));
		const now = Date.now();
		for (const profile of profiles) {
			const previous = previousProfileMap.get(profile.id);
			const actionState = profileActionStatesRef.current[profile.id];
			const suppressedUntil = profileCloseSuppressionRef.current.get(profile.id) ?? 0;
			const closeSuppressed = suppressedUntil > now;
			if (suppressedUntil > 0 && suppressedUntil <= now) {
				profileCloseSuppressionRef.current.delete(profile.id);
			}
			if (
				shouldMarkProfileRecovered({
					previousRunning: previous?.running,
					currentRunning: profile.running,
					lifecycle: profile.lifecycle,
					actionState,
					actionLocked: profileActionLocksRef.current.has(profile.id),
					closeSuppressed,
				})
			) {
				setActionState(profile.id, 'recovering');
				toast.info(t('toast.recovered', { name: profile.name }));
				window.setTimeout(() => setActionState(profile.id, null), 1800);
			} else if (previous?.running && !profile.running && closeSuppressed) {
				profileCloseSuppressionRef.current.delete(profile.id);
			}
		}
		previousProfilesRef.current = profiles;
	}, [
		profileActionLocksRef,
		profileActionStatesRef,
		profileCloseSuppressionRef,
		profiles,
		setActionState,
		t,
	]);
}
