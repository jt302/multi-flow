import { Plus, Save } from 'lucide-react';
import { Controller, type UseFormReturn } from 'react-hook-form';

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Checkbox,
	Icon,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from '@/components/ui';
import type { ProfileDevicePresetItem } from '@/entities/profile/model/types';
import {
	ARCH_OPTIONS,
	BITNESS_OPTIONS,
	type DevicePresetFormValues,
	FORM_FACTOR_OPTIONS,
	PLATFORM_OPTIONS,
} from '@/features/settings/model/use-device-preset-editor';

type DevicePresetFormProps = {
	form: UseFormReturn<DevicePresetFormValues>;
	activePreset: ProfileDevicePresetItem | null;
	onReset: () => void;
	onSubmit: () => void;
};

export function DevicePresetForm({
	form,
	activePreset,
	onReset,
	onSubmit,
}: DevicePresetFormProps) {
	const mobileCheckboxId = 'device-preset-mobile';
	const {
		register,
		control,
		formState: { errors, isSubmitting },
	} = form;

	return (
		<Card className="border-border/70 bg-background/55 p-4">
			<CardHeader className="p-0">
				<div className="flex items-center justify-between gap-3">
					<div>
						<CardTitle className="text-sm">{activePreset ? '编辑机型映射' : '新增机型映射'}</CardTitle>
						<p className="mt-1 text-xs text-muted-foreground">
							这里维护环境创建、环境列表展示和启动链路共用的机型映射参数。
						</p>
					</div>
					{activePreset ? <Badge variant="outline">编辑中</Badge> : <Badge variant="secondary">待保存新项</Badge>}
				</div>
			</CardHeader>
			<CardContent className="p-0 pt-4">
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit();
					}}
				>
					<div className="grid gap-3 md:grid-cols-2">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">机型名称</p>
							<Input {...register('label')} placeholder="例如 Pixel 8 Lab" />
							{errors.label ? <p className="mt-1 text-xs text-destructive">{errors.label.message}</p> : null}
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">平台</p>
							<Controller
								control={control}
								name="platform"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="选择平台" />
										</SelectTrigger>
										<SelectContent>
											{PLATFORM_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">平台版本</p>
							<Input {...register('platformVersion')} placeholder="例如 14.0.0" />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">平台参数</p>
							<Input {...register('customPlatform')} placeholder="例如 Win32 / MacIntel / Linux armv81" />
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-4">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">宽度</p>
							<Input type="number" {...register('viewportWidth', { valueAsNumber: true })} />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">高度</p>
							<Input type="number" {...register('viewportHeight', { valueAsNumber: true })} />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">DPR</p>
							<Input type="number" step="0.125" {...register('deviceScaleFactor', { valueAsNumber: true })} />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">触点</p>
							<Input type="number" {...register('touchPoints', { valueAsNumber: true })} />
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-4">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">架构</p>
							<Controller
								control={control}
								name="arch"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ARCH_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">位数</p>
							<Controller
								control={control}
								name="bitness"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{BITNESS_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">形态</p>
							<Controller
								control={control}
								name="formFactor"
								render={({ field }) => (
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{FORM_FACTOR_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							/>
						</div>
						<div className="flex items-end">
							<label htmlFor={mobileCheckboxId} className="flex h-9 items-center gap-2 text-sm text-foreground">
								<Controller
									control={control}
									name="mobile"
									render={({ field }) => (
										<Checkbox
											id={mobileCheckboxId}
											checked={field.value}
											onCheckedChange={(checked) => field.onChange(Boolean(checked))}
										/>
									)}
								/>
								移动设备
							</label>
						</div>
					</div>

					<div className="grid gap-3 md:grid-cols-2">
						<div>
							<p className="mb-1 text-xs text-muted-foreground">GL Vendor</p>
							<Input {...register('customGlVendor')} placeholder="例如 Apple / Qualcomm / Google Inc. (Intel)" />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">GL Renderer</p>
							<Input {...register('customGlRenderer')} placeholder="例如 Apple M3 / Adreno 750" />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">CPU 核心数</p>
							<Input type="number" {...register('customCpuCores', { valueAsNumber: true })} />
						</div>
						<div>
							<p className="mb-1 text-xs text-muted-foreground">内存 (GB)</p>
							<Input type="number" {...register('customRamGb', { valueAsNumber: true })} />
							{errors.customRamGb ? <p className="mt-1 text-xs text-destructive">{errors.customRamGb.message}</p> : null}
						</div>
					</div>

					<div>
						<p className="mb-1 text-xs text-muted-foreground">UA 模板</p>
						<Textarea rows={4} {...register('userAgentTemplate')} placeholder="Mozilla/5.0 (...) Chrome/{version} Safari/537.36" />
						{errors.userAgentTemplate ? <p className="mt-1 text-xs text-destructive">{errors.userAgentTemplate.message}</p> : null}
					</div>

					<div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
						<Button type="button" variant="ghost" onClick={onReset}>
							清空并新建
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							<Icon icon={activePreset ? Save : Plus} size={14} />
							{activePreset ? '保存修改' : '保存新机型'}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
