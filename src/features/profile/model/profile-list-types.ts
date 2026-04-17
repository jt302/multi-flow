import type { GroupItem } from '@/entities/group/model/types';
import type {
	BatchProfileActionResponse,
	BrowserBgColorMode,
	ExportProfileCookiesPayload,
	ExportProfileCookiesResponse,
	ProfileActionState,
	ProfileItem,
	ProfileProxyBindingMap,
	ReadProfileCookiesResponse,
	ToolbarLabelMode,
} from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';

export type ProfileListPageProps = {
	profiles: ProfileItem[];
	groups: GroupItem[];
	proxies: ProxyItem[];
	resources: ResourceItem[];
	profileProxyBindings: ProfileProxyBindingMap;
	profileActionStates: Record<string, ProfileActionState>;
	onCreateClick: () => void;
	onViewProfile: (profileId: string) => void;
	onEditProfile: (profileId: string) => void;
	onUpdateProfileVisual: (
		profileId: string,
		payload: {
			browserBgColorMode?: BrowserBgColorMode;
			browserBgColor?: string | null;
			toolbarLabelMode?: ToolbarLabelMode;
		},
	) => Promise<void>;
	onOpenProfile: (profileId: string) => Promise<void>;
	onCloseProfile: (profileId: string) => Promise<void>;
	onSetProfileGroup: (profileId: string, groupName?: string) => Promise<void>;
	onFocusProfileWindow: (profileId: string) => Promise<void>;
	onBatchOpenProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onBatchCloseProfiles: (profileIds: string[]) => Promise<BatchProfileActionResponse>;
	onBatchSetProfileGroup: (profileIds: string[], groupName?: string) => Promise<BatchProfileActionResponse>;
	onDuplicateProfile: (profileId: string) => Promise<void>;
	onDeleteProfile: (profileId: string) => Promise<void>;
	onRestoreProfile: (profileId: string) => Promise<void>;
	onReadProfileCookies: (profileId: string) => Promise<ReadProfileCookiesResponse>;
	onExportProfileCookies: (
		profileId: string,
		payload: ExportProfileCookiesPayload,
	) => Promise<ExportProfileCookiesResponse>;
	onRefreshProfiles: () => Promise<void>;
};
