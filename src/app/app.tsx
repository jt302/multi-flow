import { ThemeRuntime } from '@/entities/theme/ui/theme-runtime';
import { HumanInterventionModal } from './ui/human-intervention-modal';
import { AppRouter } from './router';

export function App() {
	return (
		<>
			<ThemeRuntime />
			<HumanInterventionModal />
			<AppRouter />
		</>
	);
}
