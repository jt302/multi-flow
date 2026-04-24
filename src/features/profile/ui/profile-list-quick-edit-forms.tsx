import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v3';

import { Button, Input } from '@/components/ui';

const backgroundQuickEditSchema = z.object({
	browserBgColor: z
		.string()
		.trim()
		.regex(/^#[0-9a-fA-F]{6}$/, i18next.t('profile:backgroundColor.invalidFormat')),
});

import i18next from 'i18next';

const toolbarQuickEditSchema = z.object({
	toolbarText: z.string(),
});

type BackgroundQuickEditValues = z.infer<typeof backgroundQuickEditSchema>;
type ToolbarQuickEditValues = z.infer<typeof toolbarQuickEditSchema>;

type BackgroundQuickEditFormProps = {
	initialColor: string;
	disabled: boolean;
	onCancel: () => void;
	onSubmit: (color: string) => Promise<void>;
	onReset: () => Promise<void>;
};

type ToolbarQuickEditFormProps = {
	initialToolbarText: string;
	disabled: boolean;
	onCancel: () => void;
	onSubmit: (toolbarText: string) => Promise<void>;
};

export function BackgroundQuickEditForm({
	initialColor,
	disabled,
	onCancel,
	onSubmit,
	onReset,
}: BackgroundQuickEditFormProps) {
	const { t } = useTranslation(['profile', 'common']);
	const {
		register,
		handleSubmit,
		reset,
		watch,
		setValue,
		formState: { errors },
	} = useForm<BackgroundQuickEditValues>({
		resolver: zodResolver(backgroundQuickEditSchema),
		defaultValues: {
			browserBgColor: initialColor,
		},
	});

	useEffect(() => {
		reset({ browserBgColor: initialColor });
	}, [initialColor, reset]);

	const browserBgColor = watch('browserBgColor');

	return (
		<form
			className="space-y-2"
			onSubmit={handleSubmit(async (values) => {
				await onSubmit(values.browserBgColor.trim());
			})}
		>
			<div className="flex flex-wrap items-center gap-2">
				<Input
					type="color"
					value={browserBgColor}
					onChange={(event) =>
						setValue('browserBgColor', event.target.value, {
							shouldDirty: true,
							shouldValidate: true,
						})
					}
					className="h-9 w-11 cursor-pointer rounded p-1"
					disabled={disabled}
				/>
				<Input
					{...register('browserBgColor')}
					placeholder="#0F8A73"
					className="h-9 max-w-[180px]"
					disabled={disabled}
				/>
				<div className="ml-auto flex items-center gap-1">
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="cursor-pointer"
						onClick={() => void onReset()}
						disabled={disabled}
					>
						{t('backgroundColor.reset')}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="cursor-pointer"
						onClick={onCancel}
					>
						{t('common:cancel')}
					</Button>
					<Button
						type="submit"
						size="sm"
						variant="outline"
						className="cursor-pointer"
						disabled={disabled}
					>
						{t('backgroundColor.save')}
					</Button>
				</div>
			</div>
			{errors.browserBgColor ? (
				<p className="text-xs text-destructive">{errors.browserBgColor.message}</p>
			) : null}
		</form>
	);
}

export function ToolbarQuickEditForm({
	initialToolbarText,
	disabled,
	onCancel,
	onSubmit,
}: ToolbarQuickEditFormProps) {
	const { t } = useTranslation(['profile', 'common']);
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<ToolbarQuickEditValues>({
		resolver: zodResolver(toolbarQuickEditSchema),
		defaultValues: {
			toolbarText: initialToolbarText,
		},
	});

	useEffect(() => {
		reset({ toolbarText: initialToolbarText });
	}, [initialToolbarText, reset]);

	return (
		<form
			className="space-y-2"
			onSubmit={handleSubmit(async (values) => {
				await onSubmit(values.toolbarText);
			})}
		>
			<div className="flex flex-wrap items-center gap-2">
				<Input
					{...register('toolbarText')}
					placeholder={t('toolbarText.placeholder')}
					className="h-9 min-w-[260px] flex-1"
					disabled={disabled}
				/>
				<div className="ml-auto flex items-center gap-1">
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="cursor-pointer"
						onClick={onCancel}
					>
						{t('common:cancel')}
					</Button>
					<Button
						type="submit"
						size="sm"
						variant="outline"
						className="cursor-pointer"
						disabled={disabled}
					>
						{t('toolbarText.save')}
					</Button>
				</div>
			</div>
			{errors.toolbarText ? (
				<p className="text-xs text-destructive">{errors.toolbarText.message}</p>
			) : null}
		</form>
	);
}
