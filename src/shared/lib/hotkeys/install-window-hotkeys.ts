import { getCurrentWindow } from '@tauri-apps/api/window';

export function installWindowHotkeys() {
	type MultiFlowWindow = Window & { __multiFlowWindowHotkeysBound?: boolean };
	const scopedWindow = window as MultiFlowWindow;
	if (scopedWindow.__multiFlowWindowHotkeysBound) {
		return;
	}
	scopedWindow.__multiFlowWindowHotkeysBound = true;

	document.addEventListener('keydown', (event) => {
		const isCloseWindow =
			(event.metaKey || event.ctrlKey) &&
			!event.shiftKey &&
			!event.altKey &&
			event.key.toLowerCase() === 'w';
		if (!isCloseWindow) {
			return;
		}
		event.preventDefault();
		void getCurrentWindow().close();
	});
}
