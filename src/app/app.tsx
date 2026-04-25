import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ThemeRuntime } from '@/entities/theme/ui/theme-runtime';
import { reportFrontendError } from '@/shared/lib/frontend-errors';
import { AppRouter } from './router';
import { AiDialogModal } from './ui/ai-dialog-modal';
import { AppUpdateListener } from './ui/app-update-listener';
import { AutomationNotificationListener } from './ui/automation-notification-listener';
import { AutomationProgressListener } from './ui/automation-progress-listener';
import { ChatEventsListener } from './ui/chat-events-listener';
import { ChromiumEventsListener } from './ui/chromium-events-listener';
import { HumanInterventionModal } from './ui/human-intervention-modal';
import { StepErrorPauseModal } from './ui/step-error-pause-modal';
import { ToolConfirmationModal } from './ui/tool-confirmation-modal';

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
	state = { error: null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		reportFrontendError('AppErrorBoundary', error, info.componentStack ?? undefined);
	}

	render() {
		if (this.state.error) {
			const err = this.state.error as Error;
			return (
				<div
					style={{
						display: 'flex',
						height: '100vh',
						alignItems: 'center',
						justifyContent: 'center',
						padding: '2rem',
						fontFamily: 'monospace',
					}}
				>
					<div
						style={{
							maxWidth: '600px',
							padding: '1.5rem',
							border: '1px solid #f87171',
							borderRadius: '8px',
							background: '#fff5f5',
						}}
					>
						<p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '0.5rem' }}>
							应用崩溃 (App Crashed)
						</p>
						<p style={{ color: '#dc2626', fontSize: '0.75rem', wordBreak: 'break-all' }}>
							{err.message}
						</p>
						<button
							type="button"
							style={{
								marginTop: '1rem',
								padding: '0.375rem 0.75rem',
								background: '#dc2626',
								color: '#fff',
								border: 'none',
								borderRadius: '4px',
								cursor: 'pointer',
								fontSize: '0.75rem',
							}}
							onClick={() => this.setState({ error: null })}
						>
							重试 / Retry
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

export function App() {
	return (
		<AppErrorBoundary>
			<ThemeRuntime />
			<HumanInterventionModal />
			<StepErrorPauseModal />
			<AiDialogModal />
			<ToolConfirmationModal />
			<AutomationNotificationListener />
			<AutomationProgressListener />
			<AppUpdateListener />
			<ChatEventsListener />
			<ChromiumEventsListener />
			<AppRouter />
		</AppErrorBoundary>
	);
}
