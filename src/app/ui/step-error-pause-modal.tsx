import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	cancelAutomationRun,
	listenAutomationStepErrorPause,
	resumeAutomationRun,
} from '@/entities/automation/api/automation-api';
import type { AutomationStepErrorPauseEvent } from '@/entities/automation/model/types';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

export function StepErrorPauseModal() {
	const [pauseEvent, setPauseEvent] = useState<AutomationStepErrorPauseEvent | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const unlistenRef = useRef<(() => void) | null>(null);
	const { t } = useTranslation('common');

	useEffect(() => {
		let mounted = true;
		listenAutomationStepErrorPause((event) => {
			if (!mounted) return;
			setPauseEvent(event);
			setSubmitting(false);
		}).then((u) => { unlistenRef.current = u; });
		return () => {
			mounted = false;
			unlistenRef.current?.();
		};
	}, []);

	if (!pauseEvent) return null;

	async function handleContinue() {
		if (!pauseEvent) return;
		setSubmitting(true);
		try {
			await resumeAutomationRun(pauseEvent.runId, 'continue');
			setPauseEvent(null);
		} finally {
			setSubmitting(false);
		}
	}

	async function handleStop() {
		if (!pauseEvent) return;
		setSubmitting(true);
		try {
			await cancelAutomationRun(pauseEvent.runId);
			setPauseEvent(null);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open onOpenChange={() => {}}>
			<DialogContent
				className="max-w-md"
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>{t('stepErrorTitle')}</DialogTitle>
				</DialogHeader>
				<div className="space-y-3 py-2">
					<p className="text-sm text-muted-foreground">{t('stepFailed', { index: pauseEvent.stepIndex + 1 })}</p>
					<div className="rounded bg-red-50 dark:bg-red-950/20 p-3">
						<p className="text-sm text-red-500 break-all whitespace-pre-wrap font-mono">{pauseEvent.errorMessage}</p>
					</div>
					<p className="text-sm text-muted-foreground">{t('skipStepPrompt')}</p>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={handleStop} disabled={submitting} className="cursor-pointer">
						{t('stopRun')}
					</Button>
					<Button onClick={handleContinue} disabled={submitting} className="cursor-pointer">
						{submitting ? t('processing') : t('skipAndContinue')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
