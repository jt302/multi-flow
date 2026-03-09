import { useThemeSettings } from '@/entities/theme/model/use-theme-settings';
import { useConsoleState } from '@/features/console/hooks/use-console-state';
import { useConsoleNavigationStore } from './console-navigation-store';

export function useConsoleShellModel() {
	const consoleState = useConsoleState();
	const themeState = useThemeSettings();
	const profileNavigationIntent = useConsoleNavigationStore((state) => state.profileNavigationIntent);
	const setProfileNavigationIntent = useConsoleNavigationStore((state) => state.setProfileNavigationIntent);
	const clearProfileNavigationIntent = useConsoleNavigationStore((state) => state.clearProfileNavigationIntent);

	return {
		consoleState,
		themeState,
		profileNavigationIntent,
		setProfileNavigationIntent,
		clearProfileNavigationIntent,
	};
}
