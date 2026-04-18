import { invoke } from '@tauri-apps/api/core';
import type { HostLocaleSuggestion } from '@/features/profile/model/profile-form';

export async function fetchHostLocaleSuggestion(): Promise<HostLocaleSuggestion> {
	return invoke<HostLocaleSuggestion>('host_locale_suggestion');
}
