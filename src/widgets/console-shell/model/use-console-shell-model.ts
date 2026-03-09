import { useState } from 'react';

import { useThemeSettings } from '@/entities/theme/model/use-theme-settings';
import { useConsoleState } from '@/features/console/hooks/use-console-state';
import type { ProfileNavigationIntent } from './types';

export function useConsoleShellModel() {
	const consoleState = useConsoleState();
	const themeState = useThemeSettings();
	const [profileNavigationIntent, setProfileNavigationIntent] =
		useState<ProfileNavigationIntent>(null);

	return {
		consoleState,
		themeState,
		profileNavigationIntent,
		setProfileNavigationIntent,
	};
}
