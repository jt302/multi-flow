import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
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
				toast.info(`环境 ${profile.name} 已退出，状态已自动回收`);
				window.setTimeout(() => setActionState(profile.id, null), 1800);
			}
		}
		previousProfilesRef.current = profiles;
	}, [profileActionLocksRef, profileActionStatesRef, profiles, setActionState]);
}
