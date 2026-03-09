import { BarChart3, Bot, Globe2 } from 'lucide-react';

import { Badge, Card, CardContent, CardHeader, CardTitle, Icon } from '@/components/ui';
import { MetricsGrid } from '@/features/console/components/metrics-grid';
import { SessionTableCard } from '@/features/console/components/session-table-card';
import { NAV_SECTIONS } from '@/features/console/constants';
import type { PresetKey } from '@/features/console/types';

type DashboardPageProps = {
	resolvedMode: string;
	useCustomColor: boolean;
	preset: PresetKey;
};

export function DashboardPage({ resolvedMode, useCustomColor, preset }: DashboardPageProps) {
	const section = NAV_SECTIONS.dashboard;

	return (
		<div className="space-y-3">
			<MetricsGrid resolvedMode={resolvedMode} useCustomColor={useCustomColor} preset={preset} />

			<div className="grid gap-3 md:grid-cols-3">
				<Card className="p-3">
					<CardHeader className="p-0">
						<CardTitle className="flex items-center gap-2 text-sm">
							<Icon icon={BarChart3} size={14} />
							运行概况
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0 pt-2 text-xs text-muted-foreground">环境、代理和任务状态都在 1 分钟内更新。</CardContent>
				</Card>
				<Card className="p-3">
					<CardHeader className="p-0">
						<CardTitle className="flex items-center gap-2 text-sm">
							<Icon icon={Globe2} size={14} />
							代理健康
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0 pt-2 text-xs text-muted-foreground">今日失败节点主要集中在 DE 节点，建议切备用线路。</CardContent>
				</Card>
				<Card className="p-3">
					<CardHeader className="p-0">
						<CardTitle className="flex items-center gap-2 text-sm">
							<Icon icon={Bot} size={14} />
							AI 队列
						</CardTitle>
					</CardHeader>
					<CardContent className="p-0 pt-2 text-xs text-muted-foreground">
						自动任务正在执行中，<Badge className="ml-1">3 个任务活跃</Badge>
					</CardContent>
				</Card>
			</div>

			<SessionTableCard title={section.tableTitle} rows={section.rows} />
		</div>
	);
}
