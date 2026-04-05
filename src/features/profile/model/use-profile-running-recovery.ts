import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { ProfileActionState, ProfileItem } from '@/entities/profile/model/types';

type UseProfileRunningRecoveryOptions = {
	profiles: ProfileItem[];
	profileActionStatesRef: MutableRefObject<Record<string, ProfileActionState>>;
	profileActionLocksRef: MutableRefObject<Set<string>>;
	setActionState: (profileId: string, state: ProfileActionState | null) => void;
};

export function useProfileRunningRecovery({
	profiles,
	profileActionStatesRef,
	profileActionLocksRef,
	setActionState,
}: UseProfileRunningRecoveryOptions) {
	const previousProfilesRef = useRef<ProfileItem[]>([]);
	const { t } = useTranslation('profile');

	useEffect(() => {
		const previousProfileMap = new Map(previousProfilesRef.current.map((item) => [item.id, item]));
		for (const profile of profiles) {
			const previous = previousProfileMap.get(profile.id);
			const actionState = profileActionStatesRef.current[profile.id];
			if (
				previous?.running &&
				!profile.running &&
				!actionState &&
				!profileActionLocksRef.current.has(profile.id) &&
				profile.lifecycle === 'active'
			) {
				setActionState(profile.id, 'recovering');
				toast.info(t('toast.recovered', { name: profile.name }));
				window.setTimeout(() => setActionState(profile.id, null), 1800);
			}
		}
		previousProfilesRef.current = profiles;
	}, [profileActionLocksRef, profileActionStatesRef, profiles, setActionState, t]);
}
