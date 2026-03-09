import type { ProfileItem } from '@/entities/profile/model/types';
import type { ProfileWindowStateItem, WindowBoundsItem } from '@/entities/window-session/model/types';

export type WindowsPageProps = {
	profiles: ProfileItem[];
	windowStates: ProfileWindowStateItem[];
	onRefreshWindows: () => Promise<void>;
	onViewProfile: (profileId: string) => void;
	onOpenTab: (profileId: string, url?: string) => Promise<void>;
	onCloseTab: (profileId: string, tabId?: number) => Promise<void>;
	onCloseInactiveTabs: (profileId: string, windowId?: number) => Promise<void>;
	onActivateTab: (profileId: string, tabId: number) => Promise<void>;
	onActivateTabByIndex: (profileId: string, index: number, windowId?: number) => Promise<void>;
	onOpenWindow: (profileId: string, url?: string) => Promise<void>;
	onCloseWindow: (profileId: string, windowId?: number) => Promise<void>;
	onFocusWindow: (profileId: string, windowId?: number) => Promise<void>;
	onSetWindowBounds: (profileId: string, bounds: WindowBoundsItem, windowId?: number) => Promise<void>;
	onBatchOpenTabs: (profileIds: string[], url?: string) => Promise<void>;
	onBatchCloseTabs: (profileIds: string[]) => Promise<void>;
	onBatchCloseInactiveTabs: (profileIds: string[]) => Promise<void>;
	onBatchOpenWindows: (profileIds: string[], url?: string) => Promise<void>;
	onBatchFocusWindows: (profileIds: string[]) => Promise<void>;
};
