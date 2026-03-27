import { useEffect } from 'react';

import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

import type { AutomationScript, ScriptStep } from '@/entities/automation/model/types';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type StepFormItem = ScriptStep & { _id?: string };

type FormValues = {
	name: string;
	description: string;
	steps: StepFormItem[];
};

type Props = {
	open: boolean;
	script: AutomationScript | null;
	onOpenChange: (open: boolean) => void;
	onSave: (name: string, description: string, steps: ScriptStep[]) => void;
	isSaving: boolean;
};

const STEP_KINDS = [
	{ value: 'navigate', label: '导航 navigate' },
	{ value: 'wait', label: '等待 wait' },
	{ value: 'evaluate', label: '执行JS evaluate' },
	{ value: 'click', label: '点击 click' },
	{ value: 'type', label: '输入 type' },
	{ value: 'screenshot', label: '截图 screenshot' },
	{ value: 'magic', label: 'Magic 指令' },
	{ value: 'cdp', label: 'CDP 调用' },
	{ value: 'wait_for_user', label: '人工介入 wait_for_user' },
];

function defaultStep(kind: string): ScriptStep {
	switch (kind) {
		case 'navigate': return { kind: 'navigate', url: 'https://' };
		case 'wait': return { kind: 'wait', ms: 1000 };
		case 'evaluate': return { kind: 'evaluate', expression: '' };
		case 'click': return { kind: 'click', selector: '' };
		case 'type': return { kind: 'type', selector: '', text: '' };
		case 'screenshot': return { kind: 'screenshot' };
		case 'magic': return { kind: 'magic', command: '', params: {} };
		case 'cdp': return { kind: 'cdp', method: '' };
		case 'wait_for_user': return { kind: 'wait_for_user', message: '' };
		default: return { kind: 'wait', ms: 1000 };
	}
}

export function ScriptEditorDialog({ open, script, onOpenChange, onSave, isSaving }: Props) {
	const {
		register,
		control,
		handleSubmit,
		reset,
		watch,
		formState: { errors },
	} = useForm<FormValues>({
		defaultValues: { name: '', description: '', steps: [] },
	});
	const { fields, append, remove, update } = useFieldArray({ control, name: 'steps' });

	useEffect(() => {
		if (open) {
			reset({
				name: script?.name ?? '',
				description: script?.description ?? '',
				steps: (script?.steps ?? []) as StepFormItem[],
			});
		}
	}, [open, script, reset]);

	function onSubmit(values: FormValues) {
		onSave(values.name, values.description, values.steps as ScriptStep[]);
	}

	function handleAddStep() {
		append(defaultStep('navigate') as StepFormItem);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>{script ? '编辑脚本' : '新建脚本'}</DialogTitle>
				</DialogHeader>

				<form
					id="script-editor-form"
					onSubmit={handleSubmit(onSubmit)}
					className="flex flex-col gap-4 overflow-y-auto flex-1 pr-1"
				>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label>名称 *</Label>
							<Input
								{...register('name', { required: '请输入脚本名称' })}
								placeholder="脚本名称"
								className={errors.name ? 'border-destructive' : ''}
							/>
							{errors.name && (
								<p className="text-xs text-destructive">{errors.name.message}</p>
							)}
						</div>
						<div className="space-y-1.5">
							<Label>描述</Label>
							<Input {...register('description')} placeholder="可选描述" />
						</div>
					</div>

					<div>
						<div className="flex items-center justify-between mb-2">
							<Label>步骤</Label>
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="h-7 cursor-pointer"
								onClick={handleAddStep}
							>
								<Plus className="h-3.5 w-3.5 mr-1" />
								添加步骤
							</Button>
						</div>

						{fields.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
								点击「添加步骤」开始
							</p>
						) : (
							<div className="space-y-2">
								{fields.map((field, index) => {
									const kind = watch(`steps.${index}.kind`);
									return (
										<div key={field.id} className="flex items-start gap-2 p-3 border rounded-md bg-muted/30">
											<GripVertical className="h-4 w-4 text-muted-foreground mt-1.5 flex-shrink-0" />
											<div className="flex-1 space-y-2">
												<Select
													value={kind}
													onValueChange={(v) => {
														update(index, defaultStep(v) as StepFormItem);
													}}
												>
													<SelectTrigger className="h-8 text-xs cursor-pointer">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{STEP_KINDS.map((k) => (
															<SelectItem key={k.value} value={k.value} className="cursor-pointer">
																{k.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<StepFields index={index} kind={kind} register={register} />
											</div>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-destructive"
												onClick={() => remove(index)}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</form>

				<DialogFooter className="flex-shrink-0">
					<Button
						type="button"
						variant="outline"
						className="cursor-pointer"
						onClick={() => onOpenChange(false)}
					>
						取消
					</Button>
					<Button
						type="submit"
						form="script-editor-form"
						disabled={isSaving}
						className="cursor-pointer"
					>
						{isSaving ? '保存中...' : '保存'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function StepFields({
	index,
	kind,
	register,
}: {
	index: number;
	kind: string;
	register: ReturnType<typeof useForm<FormValues>>['register'];
}) {
	switch (kind) {
		case 'navigate':
			return (
				<Input
					{...register(`steps.${index}.url` as `steps.${number}.url`)}
					placeholder="https://example.com"
					className="h-8 text-xs"
				/>
			);
		case 'wait':
			return (
				<Input
					{...register(`steps.${index}.ms` as `steps.${number}.ms`, { valueAsNumber: true })}
					type="number"
					placeholder="毫秒"
					className="h-8 text-xs"
				/>
			);
		case 'evaluate':
			return (
				<Textarea
					{...register(`steps.${index}.expression` as `steps.${number}.expression`)}
					placeholder="document.title"
					className="text-xs font-mono min-h-[60px]"
				/>
			);
		case 'click':
			return (
				<Input
					{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
					placeholder="CSS 选择器"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'type':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.selector` as `steps.${number}.selector`)}
						placeholder="CSS 选择器"
						className="h-8 text-xs font-mono"
					/>
					<Input
						{...register(`steps.${index}.text` as `steps.${number}.text`)}
						placeholder="输入文本"
						className="h-8 text-xs"
					/>
				</div>
			);
		case 'screenshot':
			return <p className="text-xs text-muted-foreground">截取当前页面截图</p>;
		case 'magic':
			return (
				<Input
					{...register(`steps.${index}.command` as `steps.${number}.command`)}
					placeholder="Magic 指令名称"
					className="h-8 text-xs"
				/>
			);
		case 'cdp':
			return (
				<Input
					{...register(`steps.${index}.method` as `steps.${number}.method`)}
					placeholder="CDP 方法，如 Page.reload"
					className="h-8 text-xs font-mono"
				/>
			);
		case 'wait_for_user':
			return (
				<div className="space-y-1.5">
					<Input
						{...register(`steps.${index}.message` as `steps.${number}.message`)}
						placeholder="提示信息，支持 {{变量}}"
						className="h-8 text-xs"
					/>
					<Input
						{...register(`steps.${index}.input_label` as `steps.${number}.input_label`)}
						placeholder="输入框标签（留空则无输入框）"
						className="h-8 text-xs"
					/>
				</div>
			);
		default:
			return null;
	}
}
