import { Cpu, Play, RefreshCcw } from 'lucide-react';

import { Badge, Button, Card, CardContent, CardHeader, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';

import { NAV_ITEMS } from '../constants';
import type { ConsoleSidebarProps } from '../types';

export function ConsoleSidebar({ activeNav, onNavChange, isRunning, onToggleRunning }: ConsoleSidebarProps) {
	return (
		<aside className="h-full rounded-3xl border border-border/60 bg-card/85 p-5 backdrop-blur-2xl">
			<div className="mb-6 flex items-center gap-3">
				<div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/35">
					<Icon icon={Cpu} size={18} />
				</div>
				<div>
					<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">multi-flow</p>
					<h1 className="text-xl font-semibold">Control Deck</h1>
				</div>
			</div>

			<nav className="space-y-1.5">
				{NAV_ITEMS.map((item) => {
					const active = activeNav === item.id;
					return (
						<Button
							key={item.id}
							type="button"
							onClick={() => onNavChange(item.id)}
							variant={active ? 'default' : 'ghost'}
							className={cn('w-full cursor-pointer justify-start gap-2.5 rounded-xl px-3 py-2.5 text-sm', active && 'shadow-md shadow-primary/30')}
						>
							<Icon icon={item.icon} size={16} />
							{item.label}
						</Button>
					);
				})}
			</nav>

			<Card className="mt-6 bg-background/70">
				<CardHeader className="p-4 pb-2">
					<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">AI 状态</p>
				</CardHeader>
				<CardContent className="space-y-3 p-4 pt-0">
					<div className="flex items-center justify-between text-sm">
						<span>自动执行引擎</span>
						<Badge variant={isRunning ? 'default' : 'secondary'}>{isRunning ? '活跃' : '暂停'}</Badge>
					</div>
					<Button type="button" onClick={onToggleRunning} variant="outline" className="w-full cursor-pointer">
						<Icon icon={isRunning ? RefreshCcw : Play} size={14} />
						{isRunning ? '暂停自动任务' : '恢复自动任务'}
					</Button>
				</CardContent>
			</Card>
		</aside>
	);
}
