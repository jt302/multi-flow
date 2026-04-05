import { ThemeRuntime } from '@/entities/theme/ui/theme-runtime';
import { AiDialogModal } from './ui/ai-dialog-modal';
import { AutomationNotificationListener } from './ui/automation-notification-listener';
import { AutomationProgressListener } from './ui/automation-progress-listener';
import { ChatEventsListener } from './ui/chat-events-listener';
import { HumanInterventionModal } from './ui/human-intervention-modal';
import { StepErrorPauseModal } from './ui/step-error-pause-modal';
import { ToolConfirmationModal } from './ui/tool-confirmation-modal';
import { AppRouter } from './router';

export function App() {
	return (
		<>
			<ThemeRuntime />
			<HumanInterventionModal />
			<StepErrorPauseModal />
			<AiDialogModal />
			<ToolConfirmationModal />
			<AutomationNotificationListener />
			<AutomationProgressListener />
			<ChatEventsListener />
			<AppRouter />
		</>
	);
}
