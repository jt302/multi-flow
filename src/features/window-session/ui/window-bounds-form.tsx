import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v3';

import { Button, Input } from '@/components/ui';
import type { ProfileWindowItem, WindowBoundsItem } from '@/entities/window-session/model/types';

const windowBoundsFormSchema = z.object({
	x: z.coerce.number().int('X 必须是整数'),
	y: z.coerce.number().int('Y 必须是整数'),
	width: z.coerce.number().int('宽度必须是整数').min(1, '宽度必须大于 0'),
	height: z.coerce.number().int('高度必须是整数').min(1, '高度必须大于 0'),
});

type WindowBoundsFormValues = z.infer<typeof windowBoundsFormSchema>;

type WindowBoundsFormProps = {
	window: ProfileWindowItem;
	controllable: boolean;
	onApply: (windowId: number, bounds: WindowBoundsItem) => Promise<void>;
};

export function WindowBoundsForm({ window, controllable, onApply }: WindowBoundsFormProps) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<WindowBoundsFormValues>({
		resolver: zodResolver(windowBoundsFormSchema),
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
			<Input {...register('x')} inputMode="numeric" placeholder="X" className="h-8 text-xs" />
			<Input {...register('y')} inputMode="numeric" placeholder="Y" className="h-8 text-xs" />
			<Input {...register('width')} inputMode="numeric" placeholder="宽度" className="h-8 text-xs" />
			<Input {...register('height')} inputMode="numeric" placeholder="高度" className="h-8 text-xs" />
			<Button type="submit" size="sm" variant="outline" className="cursor-pointer" disabled={!controllable}>
				应用窗口尺寸
			</Button>
			{errors.x || errors.y || errors.width || errors.height ? (
				<p className="text-xs text-destructive md:col-span-5">
					{errors.x?.message ?? errors.y?.message ?? errors.width?.message ?? errors.height?.message}
				</p>
			) : null}
		</form>
	);
}
