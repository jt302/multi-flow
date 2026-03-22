import { Puzzle } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Badge, Button, Checkbox, Icon } from '@/components/ui';
import type { PluginPackage } from '@/entities/plugin/model/types';

import type { ProfileFormValues } from '../model/profile-form';
import { SectionTitle } from './section-title';

type PluginsSettingsSectionProps = {
	form: UseFormReturn<ProfileFormValues>;
	packages: PluginPackage[];
	pluginSelections: ProfileFormValues['pluginSelections'];
	loading: boolean;
	error: string | null;
};

function isSelected(
	pluginSelections: ProfileFormValues['pluginSelections'],
	packageId: string,
) {
	return pluginSelections.find((item) => item.packageId === packageId) ?? null;
}

export function PluginsSettingsSection({
	form,
	packages,
	pluginSelections,
	loading,
	error,
}: PluginsSettingsSectionProps) {
	const { setValue } = form;

	const updateSelections = (next: ProfileFormValues['pluginSelections']) => {
		setValue('pluginSelections', next, {
			shouldDirty: true,
			shouldValidate: true,
		});
	};

	return (
		<div className="rounded-xl border border-border/70 p-3">
			<SectionTitle
				title="插件"
				description="从已下载插件库中选择要跟随当前环境启动的插件。运行中的环境修改后需要重启才会生效。"
			/>
			{loading ? (
				<p className="text-xs text-muted-foreground">正在加载插件库...</p>
			) : null}
			{error ? <p className="text-xs text-destructive">{error}</p> : null}
			{!loading && packages.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
					当前还没有已下载插件。先到独立的插件页通过扩展 ID 下载，再回到这里选择要安装到环境的插件。
				</div>
			) : null}
			<div className="space-y-2">
				{packages.map((pkg) => {
					const selected = isSelected(pluginSelections, pkg.packageId);
					return (
						<div
							key={pkg.packageId}
							className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3"
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<label className="flex min-w-0 flex-1 items-start gap-3 text-sm">
									<Checkbox
										checked={Boolean(selected)}
										className="mt-0.5 cursor-pointer"
										onCheckedChange={(checked) => {
											if (checked !== true) {
												updateSelections(
													pluginSelections.filter(
														(item) => item.packageId !== pkg.packageId,
													),
												);
												return;
											}
											updateSelections([
												...pluginSelections.filter(
													(item) => item.packageId !== pkg.packageId,
												),
												{ packageId: pkg.packageId, enabled: true },
											]);
										}}
									/>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium text-foreground">{pkg.name}</p>
											<Badge variant="outline">v{pkg.version}</Badge>
											<Badge variant="secondary">{pkg.extensionId}</Badge>
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{pkg.description?.trim() || '暂无描述'}
										</p>
									</div>
								</label>
								<div className="flex items-center gap-2">
									<label className="flex items-center gap-2 text-xs text-muted-foreground">
										<Checkbox
											checked={selected?.enabled ?? false}
											disabled={!selected}
											className="cursor-pointer"
											onCheckedChange={(checked) => {
												updateSelections(
													pluginSelections.map((item) =>
														item.packageId === pkg.packageId
															? { ...item, enabled: checked === true }
															: item,
													),
												);
											}}
										/>
										启用
									</label>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 cursor-pointer px-2 text-[11px]"
										onClick={() => {
											updateSelections(
												pluginSelections.filter(
													(item) => item.packageId !== pkg.packageId,
												),
											);
										}}
										disabled={!selected}
									>
										<Icon icon={Puzzle} size={12} />
										移除
									</Button>
								</div>
							</div>
							{pkg.updateStatus === 'update_available' ? (
								<p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
									检测到新版本 {pkg.latestVersion ?? '未知'}，如果希望环境使用新版本，请先去插件页更新插件包。
								</p>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}
