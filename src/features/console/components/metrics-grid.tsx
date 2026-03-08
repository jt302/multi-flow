import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';

import type { MetricsGridProps } from '../types';

export function MetricsGrid({ resolvedMode, useCustomColor, preset }: MetricsGridProps) {
	return (
		<div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<Card>
				<CardHeader className="pb-2">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">运行环境</CardDescription>
					<CardTitle className="text-3xl">24</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">+3 今日新增</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-2">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">代理可用率</CardDescription>
					<CardTitle className="text-3xl">98.4%</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">最近 1 小时</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-2">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">异常暂停</CardDescription>
					<CardTitle className="text-3xl">2</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">需人工处理</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-2">
					<CardDescription className="text-xs uppercase tracking-[0.16em]">当前主题</CardDescription>
					<CardTitle className="text-lg capitalize">{resolvedMode}</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-xs text-muted-foreground">{useCustomColor ? '自定义主色' : `预设: ${preset}`}</p>
				</CardContent>
			</Card>
		</div>
	);
}
