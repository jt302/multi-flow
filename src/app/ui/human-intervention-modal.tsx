import { useEffect, useRef, useState } from 'react';

import {
	cancelAutomationRun,
	listenAutomationHumanDismissed,
	listenAutomationHumanRequired,
	resumeAutomationRun,
} from '@/entities/automation/api/automation-api';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAutomationStore } from '@/store/automation-store';

export function HumanInterventionModal() {
	const [inputValue, setInputValue] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const unlistenRefs = useRef<Array<() => void>>([]);

	const humanIntervention = useAutomationStore((s) => s.humanIntervention);
	const onHumanRequired = useAutomationStore((s) => s.onHumanRequired);
	const onHumanDismissed = useAutomationStore((s) => s.onHumanDismissed);

	useEffect(() => {
		let mounted = true;

		Promise.all([
			listenAutomationHumanRequired((event) => {
				if (!mounted) return;
				onHumanRequired(event);
				setInputValue('');
				setSubmitting(false);
			}),
			listenAutomationHumanDismissed((event) => {
				if (!mounted) return;
				onHumanDismissed(event.runId);
			}),
		]).then((unlistens) => {
			unlistenRefs.current = unlistens;
		});

		return () => {
			mounted = false;
			unlistenRefs.current.forEach((u) => u());
		};
	}, [onHumanRequired, onHumanDismissed]);

	if (!humanIntervention) return null;

	const { runId, message, inputLabel } = humanIntervention;
	const hasInput = inputLabel != null;

	async function handleContinue() {
		if (!humanIntervention) return;
		setSubmitting(true);
		try {
			await resumeAutomationRun(runId, hasInput ? inputValue : undefined);
		} finally {
			setSubmitting(false);
		}
	}

	async function handleCancel() {
		if (!humanIntervention) return;
		setSubmitting(true);
		try {
			await cancelAutomationRun(runId);
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
					<DialogTitle>等待人工操作</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<p className="text-sm text-foreground whitespace-pre-wrap">{message}</p>

					{hasInput && (
						<div className="space-y-1.5">
							<Label>{inputLabel}</Label>
							<Input
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleContinue();
								}}
								disabled={submitting}
								autoFocus
							/>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleCancel}
						disabled={submitting}
						className="cursor-pointer"
					>
						取消运行
					</Button>
					<Button
						onClick={handleContinue}
						disabled={submitting}
						className="cursor-pointer"
					>
						{submitting ? '处理中...' : '继续'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
