import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v3';

import { Button, Input } from '@/components/ui';
import type { ProfileWindowItem, WindowBoundsItem } from '@/entities/window-session/model/types';

const windowBoundsFormSchema = (t: (key: string) => string) =>
	z.object({
		x: z.coerce.number().int(t('validation:xInteger')),
		y: z.coerce.number().int(t('validation:yInteger')),
		width: z.coerce.number().int(t('validation:widthInteger')).min(1, t('validation:widthMin')),
		height: z.coerce.number().int(t('validation:heightInteger')).min(1, t('validation:heightMin')),
	});

type WindowBoundsFormValues = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type WindowBoundsFormProps = {
	window: ProfileWindowItem;
	controllable: boolean;
	onApply: (windowId: number, bounds: WindowBoundsItem) => Promise<void>;
};

export function WindowBoundsForm({ window, controllable, onApply }: WindowBoundsFormProps) {
	const { t } = useTranslation(['common', 'window']);

	const schema = windowBoundsFormSchema((key: string) => t(`window:${key}`));

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<WindowBoundsFormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			x: window.bounds?.x ?? 0,
			y: window.bounds?.y ?? 0,
			width: window.bounds?.width ?? 1300,
			height: window.bounds?.height ?? 800,
		},
	});

	useEffect(() => {
		reset({
			x: window.bounds?.x ?? 0,
			y: window.bounds?.y ?? 0,
			width: window.bounds?.width ?? 1300,
			height: window.bounds?.height ?? 800,
		});
	}, [window.bounds?.height, window.bounds?.width, window.bounds?.x, window.bounds?.y, reset]);

	return (
		<form
			className="mb-2 grid gap-2 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
			onSubmit={handleSubmit(async (values) => {
				await onApply(window.windowId, {
					x: values.x,
					y: values.y,
					width: values.width,
					height: values.height,
				});
			})}
		>
			<Input
				{...register('x')}
				inputMode="numeric"
				placeholder={t('common:x')}
				className="h-8 text-xs"
			/>
			<Input
				{...register('y')}
				inputMode="numeric"
				placeholder={t('common:y')}
				className="h-8 text-xs"
			/>
			<Input
				{...register('width')}
				inputMode="numeric"
				placeholder={t('common:width')}
				className="h-8 text-xs"
			/>
			<Input
				{...register('height')}
				inputMode="numeric"
				placeholder={t('common:height')}
				className="h-8 text-xs"
			/>
			<Button
				type="submit"
				size="sm"
				variant="outline"
				className="cursor-pointer"
				disabled={!controllable}
			>
				{t('window:applyBounds')}
			</Button>
			{errors.x || errors.y || errors.width || errors.height ? (
				<p className="text-xs text-destructive md:col-span-5">
					{errors.x?.message ??
						errors.y?.message ??
						errors.width?.message ??
						errors.height?.message}
				</p>
			) : null}
		</form>
	);
}
