import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ThemeRuntime } from '@/entities/theme/ui/theme-runtime';
import { HumanInterventionModal } from './ui/human-intervention-modal';
import { StepErrorPauseModal } from './ui/step-error-pause-modal';
import { AppRouter } from './router';

export function App() {
	useEffect(() => {
		getCurrentWindow().show();
	}, []);

	return (
		<>
			<ThemeRuntime />
			<HumanInterventionModal />
			<StepErrorPauseModal />
			<AppRouter />
		</>
	);
}
