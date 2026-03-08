import type {
	BatchProfileActionResponse,
	ProfileActionState,
	ProfileItem,
	ProfileProxyBindingMap,
	ProxyItem,
	ResourceItem,
} from '@/features/console/types';

export type ProfileListPageProps = {
	profiles: ProfileItem[];
	proxies: ProxyItem[];
	resources: ResourceItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	profileActionStates: Record<string, ProfileActionState>;
	onCreateClick: () => void;
	onViewProfile: (profileId: string) => void;
	onEditProfile: (profileId: string) => void;
	onUpdateProfileVisual: (
		profileId: string,
		payload: { browserBgColor?: string; toolbarText?: string },
	) => Promise<void>;
	onOpenProfile: (profileId: string) => Promise<void>;
	onCloseProfile: (profileId: string) => Promise<void>;
	onBatchOpenProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onBatchCloseProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onDeleteProfile: (profileId: string) => Promise<void>;
	onRestoreProfile: (profileId: string) => Promise<void>;
	onRefreshProfiles: () => Promise<void>;
};
