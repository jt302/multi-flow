import { Logs, MonitorCog, MoonStar, Search, ShieldCheck, Sun } from 'lucide-react';

import { WORKSPACE_NAV_ITEMS } from '@/app/model/workspace-nav-items';
import type { NavId } from '@/app/model/workspace-types';
import { Button, Icon, Input } from '@/components/ui';
import type { ThemeMode } from '@/entities/theme/model/types';

type WorkspaceTopbarProps = {
	activeNav: NavId;
	themeMode: ThemeMode;
	onThemeModeChange: (mode: ThemeMode) => void;
	onOpenLogPanel?: () => void;
};

export function WorkspaceTopbar({
	activeNav,
	themeMode,
	onThemeModeChange,
	onOpenLogPanel,
}: WorkspaceTopbarProps) {
	const activeLabel = WORKSPACE_NAV_ITEMS.find((item) => item.id === activeNav)?.label ?? '';

	return (
		<header className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
			<div className="space-y-2">
				<p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
					workspace / {activeLabel}
				</p>
				<div className="relative w-full xl:w-[26rem]">
					<Icon
						icon={Search}
						size={14}
						className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="search"
						placeholder="搜索环境、分组、代理..."
						className="bg-background/75 pl-9"
					/>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2.5">
				<Button
					type="button"
					variant="secondary"
					className="bg-background/70"
					onClick={onOpenLogPanel}
				>
					<Icon icon={Logs} size={14} />
					日志面板
				</Button>
				<div className="flex items-center rounded-xl border border-border bg-background/70 p-1">
					<Button
						type="button"
						onClick={() => onThemeModeChange('light')}
						variant={themeMode === 'light' ? 'default' : 'ghost'}
						size="icon"
						className="h-8 w-8 rounded-lg"
					>
						<Icon icon={Sun} size={14} />
					</Button>
					<Button
						type="button"
						onClick={() => onThemeModeChange('dark')}
						variant={themeMode === 'dark' ? 'default' : 'ghost'}
						size="icon"
						className="h-8 w-8 rounded-lg"
					>
						<Icon icon={MoonStar} size={14} />
					</Button>
					<Button
						type="button"
						onClick={() => onThemeModeChange('system')}
						variant={themeMode === 'system' ? 'default' : 'ghost'}
						size="icon"
						className="h-8 w-8 rounded-lg"
					>
						<Icon icon={MonitorCog} size={14} />
					</Button>
				</div>

				<Button type="button" variant="secondary" className="bg-background/70">
					<Icon icon={ShieldCheck} size={14} />
					状态巡检
				</Button>
			</div>
		</header>
	);
}

