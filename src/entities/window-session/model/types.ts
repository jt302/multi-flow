export type WindowTabItem = {
	tabId: number;
	title: string;
	url: string;
	active: boolean;
};

export type WindowBoundsItem = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type ProfileWindowItem = {
	windowId: number;
	focused: boolean;
	tabCount: number;
	activeTabId: number | null;
	activeTabUrl: string | null;
	bounds?: WindowBoundsItem | null;
	tabs: WindowTabItem[];
};

export type ProfileWindowStateItem = {
	profileId: string;
	sessionId: number;
	pid: number | null;
	totalWindows: number;
	totalTabs: number;
	windows: ProfileWindowItem[];
};
