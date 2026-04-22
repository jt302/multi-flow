import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/shared/config/query-keys';

interface ChromiumEventPayload {
	event_type: string;
	ts_ms: number;
	profile_id: string;
	data: Record<string, unknown>;
}

/**
 * 全局监听 Chromium 推送的书签和窗口/Tab 事件，
 * 触发对应 react-query 缓存失效，替代原有 5 秒轮询。
 */
export function ChromiumEventsListener() {
	const qc = useQueryClient();
	const unlistenBookmarkRef = useRef<(() => void) | null>(null);
	const unlistenWindowRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let mounted = true;

		listen<ChromiumEventPayload>('chromium_bookmark_event', (event) => {
			if (!mounted) return;
			const profileId = event.payload.profile_id;
			if (profileId) {
				qc.invalidateQueries({
					queryKey: queryKeys.bookmarks.byProfile(profileId),
				});
			}
		}).then((unlisten) => {
			unlistenBookmarkRef.current = unlisten;
		});

		listen<ChromiumEventPayload>('chromium_window_event', (event) => {
			if (!mounted) return;
			qc.invalidateQueries({ queryKey: queryKeys.windowStates });
			// Also refresh profile list so running state stays in sync.
			if (event.payload.event_type.startsWith('window.')) {
				qc.invalidateQueries({ queryKey: queryKeys.profiles });
			}
		}).then((unlisten) => {
			unlistenWindowRef.current = unlisten;
		});

		return () => {
			mounted = false;
			unlistenBookmarkRef.current?.();
			unlistenWindowRef.current?.();
		};
	}, [qc]);

	return null;
}
