import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { queryKeys } from '@/shared/config/query-keys';
import { useChromiumRuntimeStore } from '@/store/chromium-runtime-store';

interface ChromiumEventPayload {
	event_type: string;
	ts_ms: number;
	profile_id: string;
	data: Record<string, unknown>;
}

export function ChromiumEventsListener() {
	const qc = useQueryClient();
	const { t } = useTranslation('chromium');
	const unlistenRefs = useRef<Array<() => void>>([]);

	useEffect(() => {
		const unlisten = unlistenRefs.current;
		let mounted = true;

		function reg(event: string, handler: (payload: ChromiumEventPayload) => void) {
			listen<ChromiumEventPayload>(event, (e) => {
				if (mounted) handler(e.payload);
			}).then((fn) => unlisten.push(fn));
		}

		// window / tab
		reg('chromium_window_event', (p) => {
			qc.invalidateQueries({ queryKey: queryKeys.windowStates });
			if (p.event_type.startsWith('window.')) {
				qc.invalidateQueries({ queryKey: queryKeys.profiles });
			}
		});

		// bookmark
		reg('chromium_bookmark_event', (p) => {
			if (p.profile_id) {
				qc.invalidateQueries({ queryKey: queryKeys.bookmarks.byProfile(p.profile_id) });
			}
		});

		// download
		reg('chromium_download_event', (p) => {
			const { upsertDownload, completeDownload, interruptDownload } =
				useChromiumRuntimeStore.getState();
			const d = p.data;
			const profileId = p.profile_id;
			const downloadId = String(d.download_id ?? '');
			if (!downloadId) return;

			if (p.event_type === 'download.created') {
				upsertDownload({
					downloadId,
					profileId,
					url: String(d.url ?? ''),
					filename: String(d.filename ?? ''),
					bytesSoFar: 0,
					totalBytes: Number(d.total_bytes ?? 0),
					state: 'in_progress',
					updatedAt: Date.now(),
				});
			} else if (p.event_type === 'download.updated') {
				const existing =
					useChromiumRuntimeStore.getState().downloads[`${profileId}:${downloadId}`];
				upsertDownload({
					downloadId,
					profileId,
					url: existing?.url ?? '',
					filename: existing?.filename ?? '',
					bytesSoFar: Number(d.bytes_so_far ?? 0),
					totalBytes: Number(d.total_bytes ?? 0),
					state: 'in_progress',
					updatedAt: Date.now(),
				});
			} else if (p.event_type === 'download.completed') {
				const existing =
					useChromiumRuntimeStore.getState().downloads[`${profileId}:${downloadId}`];
				const filename = existing?.filename ?? '';
				completeDownload(profileId, downloadId, String(d.target_path ?? ''), Number(d.total_bytes ?? 0));
				toast.success(t('toast.downloadCompleted', { filename: filename || downloadId }));
			} else if (p.event_type === 'download.interrupted') {
				const existing =
					useChromiumRuntimeStore.getState().downloads[`${profileId}:${downloadId}`];
				const filename = existing?.filename ?? '';
				interruptDownload(profileId, downloadId, String(d.error ?? ''));
				if (filename) {
					toast.error(t('toast.downloadInterrupted', { filename }));
				}
			}
		});

		// extension
		reg('chromium_extension_event', (p) => {
			const { upsertExtension, removeExtension } = useChromiumRuntimeStore.getState();
			const d = p.data;
			const profileId = p.profile_id;
			const id = String(d.id ?? '');
			const name = String(d.name ?? '');
			if (!id) return;

			if (p.event_type === 'extension.uninstalled') {
				removeExtension(profileId, id);
			} else {
				upsertExtension({
					id,
					name,
					profileId,
					enabled: p.event_type !== 'extension.disabled',
				});
			}
		});

		// renderer
		reg('chromium_renderer_event', (p) => {
			qc.invalidateQueries({ queryKey: queryKeys.windowStates });
			const title = String(p.data.title ?? '');
			const profile = p.profile_id;
			if (p.event_type === 'renderer.crashed') {
				toast.error(t('toast.rendererCrashed', { profile, title }));
			} else if (p.event_type === 'renderer.hung') {
				toast.warning(t('toast.rendererHung', { profile, title }));
			}
		});

		// media / fullscreen
		reg('chromium_media_event', (p) => {
			const { setFullscreen } = useChromiumRuntimeStore.getState();
			const windowSessionId = String(p.data.window_session_id ?? '');
			if (!windowSessionId) return;
			setFullscreen(p.profile_id, windowSessionId, p.event_type === 'media.fullscreen_entered');
		});

		// network
		reg('chromium_network_event', (p) => {
			const { setProfileOnline } = useChromiumRuntimeStore.getState();
			const isOffline = p.data.connection_type === 'none';
			const profile = p.profile_id;
			setProfileOnline(profile, !isOffline);
			if (isOffline) {
				toast.warning(t('toast.networkOffline', { profile }));
			}
		});

		// lifecycle
		reg('chromium_lifecycle_event', (p) => {
			const { clearProfile } = useChromiumRuntimeStore.getState();
			const profile = p.profile_id;
			if (p.event_type === 'browser.ready') {
				qc.invalidateQueries({ queryKey: queryKeys.profiles });
				qc.invalidateQueries({ queryKey: queryKeys.windowStates });
			} else if (p.event_type === 'profile.shutdown_initiated') {
				clearProfile(profile);
				qc.invalidateQueries({ queryKey: queryKeys.profiles });
			}
		});

		return () => {
			mounted = false;
			for (const fn of unlisten) fn();
			unlisten.length = 0;
		};
	}, [qc, t]);

	return null;
}
