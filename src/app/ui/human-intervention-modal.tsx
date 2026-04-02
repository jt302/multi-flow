import { useEffect, useRef, useState } from 'react';

import {
	cancelAutomationRun,
	listenAutomationHumanDismissed,
	listenAutomationHumanRequired,
	resumeAutomationRun,
} from '@/entities/automation/api/automation-api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
	const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
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
				setSelectedOptions([]);
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

	const { runId, message, inputLabel, dialogType } = humanIntervention;

	async function handleResume(value?: string) {
		setSubmitting(true);
		try {
			await resumeAutomationRun(runId, value);
		} finally {
			setSubmitting(false);
		}
	}

	async function handleCancel() {
		setSubmitting(true);
		try {
			await cancelAutomationRun(runId);
		} finally {
			setSubmitting(false);
		}
	}

	// ── confirm dialog ──
	if (dialogType === 'confirm') {
		const title = humanIntervention.title || '确认';
		const buttons = humanIntervention.buttons;

		// 新版：动态按钮列表
		if (buttons && buttons.length > 0) {
			return (
				<Dialog open onOpenChange={() => {}}>
					<DialogContent
						className="max-w-md"
						onInteractOutside={(e) => e.preventDefault()}
						onEscapeKeyDown={(e) => e.preventDefault()}
					>
						<DialogHeader>
							<DialogTitle>{title}</DialogTitle>
						</DialogHeader>
						<div className="py-2">
							<p className="text-sm text-foreground whitespace-pre-wrap">
								{message}
							</p>
						</div>
						<DialogFooter>
							{buttons.map((btn) => (
								<Button
									key={btn.value}
									variant={
										btn.variant === 'destructive'
											? 'destructive'
											: btn.variant === 'outline'
												? 'outline'
												: 'default'
									}
									onClick={() => handleResume(btn.value)}
									disabled={submitting}
									className="cursor-pointer"
								>
									{btn.text}
								</Button>
							))}
						</DialogFooter>
					</DialogContent>
				</Dialog>
			);
		}

		// 旧版兼容：confirm_text / cancel_text
		const confirmText = humanIntervention.confirmText || '确认';
		const cancelText = humanIntervention.cancelText || '取消';
		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="max-w-md"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					<div className="py-2">
						<p className="text-sm text-foreground whitespace-pre-wrap">
							{message}
						</p>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => handleResume('false')}
							disabled={submitting}
							className="cursor-pointer"
						>
							{cancelText}
						</Button>
						<Button
							onClick={() => handleResume('true')}
							disabled={submitting}
							className="cursor-pointer"
						>
							{submitting ? '处理中...' : confirmText}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ── select dialog ──
	if (dialogType === 'select') {
		const title = humanIntervention.title || '请选择';
		const options = humanIntervention.options ?? [];
		const multiSelect = humanIntervention.multiSelect ?? false;

		function toggleOption(opt: string) {
			setSelectedOptions((prev) => {
				if (multiSelect) {
					return prev.includes(opt)
						? prev.filter((o) => o !== opt)
						: [...prev, opt];
				}
				return [opt];
			});
		}

		function handleSubmitSelection() {
			const value = multiSelect
				? JSON.stringify(selectedOptions)
				: (selectedOptions[0] ?? '');
			handleResume(value);
		}

		return (
			<Dialog open onOpenChange={() => {}}>
				<DialogContent
					className="max-w-md"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 py-2">
						{message && (
							<p className="text-sm text-foreground whitespace-pre-wrap">
								{message}
							</p>
						)}
						<div className="space-y-2 max-h-60 overflow-y-auto">
							{options.map((opt) => (
								<label
									key={opt}
									className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted"
								>
									<Checkbox
										checked={selectedOptions.includes(opt)}
										onCheckedChange={() => toggleOption(opt)}
										disabled={submitting}
									/>
									<span className="text-sm">{opt}</span>
								</label>
							))}
						</div>
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
							onClick={handleSubmitSelection}
							disabled={submitting || selectedOptions.length === 0}
							className="cursor-pointer"
						>
							{submitting ? '处理中...' : '确定'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	// ── default: wait_for_user ──
	const hasInput = inputLabel != null;

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
					<p className="text-sm text-foreground whitespace-pre-wrap">
						{message}
					</p>

					{hasInput && (
						<div className="space-y-1.5">
							<Label>{inputLabel}</Label>
							<Input
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter')
										handleResume(hasInput ? inputValue : undefined);
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
						onClick={() => handleResume(hasInput ? inputValue : undefined)}
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
