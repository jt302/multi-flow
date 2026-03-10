import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

type ProfileListStatsProps = {
	filteredCount: number;
	totalCount: number;
	activeCount: number;
	runningCount: number;
};

export function ProfileListStats({
	filteredCount,
	totalCount,
	activeCount,
	runningCount,
}: ProfileListStatsProps) {
	return (
		<div className="grid gap-3 md:grid-cols-3">
			<Card className="p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">环境总数</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{filteredCount}</p>
					<p className="text-xs text-muted-foreground">总计 {totalCount}</p>
				</CardContent>
			</Card>
			<Card className="p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">活跃环境</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{activeCount}</p>
				</CardContent>
			</Card>
			<Card className="p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">运行中</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{runningCount}</p>
				</CardContent>
			</Card>
		</div>
	);
}
