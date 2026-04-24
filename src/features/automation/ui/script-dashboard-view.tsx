import { Network, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { openAutomationCanvasWindow } from '@/entities/automation/api/automation-api';
import type { AutomationScript } from '@/entities/automation/model/types';

type Props = {
	scripts: AutomationScript[];
	onSelect: (scriptId: string) => void;
	onNew: () => void;
};

/** 默认仪表盘视图：未选中脚本时以网格卡片形式展示所有脚本 */
export function ScriptDashboardView({ scripts, onSelect, onNew }: Props) {
	const { t } = useTranslation('automation');

	if (scripts.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center space-y-3">
					<p className="text-sm text-muted-foreground">{t('dashboard.noScripts')}</p>
					<Button size="sm" variant="outline" className="cursor-pointer" onClick={onNew}>
						<Plus className="h-3.5 w-3.5 mr-1.5" />
						{t('dashboard.newScript')}
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto p-5">
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{scripts.map((script) => (
					<div
						key={script.id}
						className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow cursor-pointer"
						onClick={() => onSelect(script.id)}
					>
						{/* 卡片标题 */}
						<div className="flex items-start justify-between gap-2">
							<h3 className="text-base font-semibold leading-snug truncate flex-1">
								{script.name}
							</h3>
						</div>

						{/* 描述 */}
						{script.description && (
							<p className="text-sm text-muted-foreground line-clamp-2">{script.description}</p>
						)}

						{/* 统计徽章 */}
						<div className="flex items-center gap-2 flex-wrap">
							<Badge variant="secondary" className="text-xs h-5">
								{script.steps.length} {t('dashboard.steps')}
							</Badge>
							{(script.associatedProfileIds?.length ?? 0) > 0 && (
								<Badge variant="outline" className="text-xs h-5">
									{script.associatedProfileIds!.length} {t('dashboard.profiles')}
								</Badge>
							)}
						</div>

						{/* 操作按钮 */}
						<div className="flex items-center gap-2 mt-auto pt-1">
							<Button
								variant="outline"
								size="sm"
								className="cursor-pointer h-7 text-xs"
								onClick={(e) => {
									e.stopPropagation();
									void openAutomationCanvasWindow(script.id, script.name);
								}}
							>
								<Network className="h-3 w-3 mr-1" />
								{t('dashboard.openCanvas')}
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
