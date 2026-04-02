import { ThemeRuntime } from '@/entities/theme/ui/theme-runtime';
import { AiDialogModal } from './ui/ai-dialog-modal';
import { AutomationNotificationListener } from './ui/automation-notification-listener';
import { HumanInterventionModal } from './ui/human-intervention-modal';
import { StepErrorPauseModal } from './ui/step-error-pause-modal';
import { AppRouter } from './router';

export function App() {
	return (
		<>
			<ThemeRuntime />
			<HumanInterventionModal />
			<StepErrorPauseModal />
			<AiDialogModal />
			<AutomationNotificationListener />
			<AppRouter />
		</>
	);
}
