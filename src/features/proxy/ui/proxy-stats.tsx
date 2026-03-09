import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

type ProxyStatsProps = {
	totalCount: number;
	activeCount: number;
	boundCount: number;
};

export function ProxyStats({ totalCount, activeCount, boundCount }: ProxyStatsProps) {
	return (
		<div className="grid gap-3 md:grid-cols-3">
			<Card className="p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">代理总数</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{totalCount}</p>
				</CardContent>
			</Card>
			<Card className="p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">可用代理</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{activeCount}</p>
				</CardContent>
			</Card>
			<Card className="p-3">
				<CardHeader className="px-1 pb-1">
					<CardTitle className="text-xs text-muted-foreground">已绑定环境</CardTitle>
				</CardHeader>
				<CardContent className="px-1 pt-0">
					<p className="text-2xl font-semibold">{boundCount}</p>
				</CardContent>
			</Card>
		</div>
	);
}
