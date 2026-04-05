import type { ProfileItem } from '@/entities/profile/model/types';
import type {
	SyncManagerConnectionStatus,
	SyncSessionPayload,
	SyncTargetItem,
	SyncWarningItem,
} from '@/entities/window-session/model/types';

export type WindowsPageProps = {
	profiles: ProfileItem[];
	windowStates: SyncTargetItem[];
	syncConnectionStatus: SyncManagerConnectionStatus;
	sidecarPort: number | null;
	sessionPayload: SyncSessionPayload | null;
	recentWarnings: SyncWarningItem[];
	syncLastError: string | null;
	onRefreshWindows: () => Promise<void>;
	onStartSync: (profileIds: string[], masterProfileId: string) => Promise<void>;
	onStopSync: () => Promise<void>;
	onRestartSync: () => Promise<void>;
};
