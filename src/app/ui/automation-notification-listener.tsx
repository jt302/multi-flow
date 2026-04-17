import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { listenAutomationNotification } from '@/entities/automation/api/automation-api';
import type { AutomationNotificationEvent } from '@/entities/automation/model/types';

export function AutomationNotificationListener() {
	const unlistenRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let mounted = true;

		listenAutomationNotification((event: AutomationNotificationEvent) => {
			if (!mounted) return;

			const level = event.level ?? 'info';
			const profileLabel = event.profileName ?? (event.profileId ? event.profileId.slice(0, 8) : null);
			const descParts = [event.body || undefined, profileLabel ? `[${profileLabel}]` : undefined].filter(Boolean);
			const options = {
				description: descParts.length > 0 ? descParts.join('  ') : undefined,
				duration: event.durationMs ?? 5000,
			};

			switch (level) {
				case 'success':
					toast.success(event.title, options);
					break;
				case 'warning':
					toast.warning(event.title, options);
					break;
				case 'error':
					toast.error(event.title, options);
					break;
				default:
					toast.info(event.title, options);
					break;
			}
		}).then((unlisten) => {
			unlistenRef.current = unlisten;
		});

		return () => {
			mounted = false;
			unlistenRef.current?.();
		};
	}, []);

	return null;
}
