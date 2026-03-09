import type { GroupItem } from '@/entities/group/model/types';
import type {
	BatchProfileActionResponse,
	CreateProfilePayload,
	ProfileActionState,
	ProfileItem,
	ProfileProxyBindingMap,
} from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';

export type ProfilesPageProps = {
	profiles: ProfileItem[];
	groups: GroupItem[];
	proxies: ProxyItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	resources: ResourceItem[];
	profileActionStates: Record<string, ProfileActionState>;
	onCreateProfile: (payload: CreateProfilePayload) => Promise<void>;
	onUpdateProfile: (profileId: string, payload: CreateProfilePayload) => Promise<void>;
	onUpdateProfileVisual: (
		profileId: string,
		payload: { browserBgColor?: string; toolbarText?: string },
	) => Promise<void>;
	onOpenProfile: (profileId: string) => Promise<void>;
	onCloseProfile: (profileId: string) => Promise<void>;
	onSetProfileGroup: (profileId: string, groupName?: string) => Promise<void>;
	onFocusProfileWindow: (profileId: string) => Promise<void>;
	onBatchOpenProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onBatchCloseProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onBatchSetProfileGroup: (profileIds: string[], groupName?: string) => Promise<BatchProfileActionResponse>;
	onDeleteProfile: (profileId: string) => Promise<void>;
	onRestoreProfile: (profileId: string) => Promise<void>;
	onRefreshProfiles: () => Promise<void>;
	navigationIntent?: {
		profileId: string;
		view: 'detail' | 'edit';
	} | null;
	onConsumeNavigationIntent?: () => void;
};
