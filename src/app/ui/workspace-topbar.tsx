import { Logs, MonitorCog, MoonStar, Search, ShieldCheck, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { WORKSPACE_SECTIONS } from '@/app/model/workspace-sections';
import { WORKSPACE_NAV_ITEMS } from '@/app/model/workspace-nav-items';
import { resolvePathFromNav } from '@/app/workspace-routes';
import type { NavId } from '@/app/model/workspace-types';
import {
	Button,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	SidebarTrigger,
} from '@/components/ui';
import type { ThemeMode } from '@/entities/theme/model/types';

type WorkspaceTopbarProps = {
	activeNav: NavId;
	themeMode: ThemeMode;
	onThemeModeChange: (mode: ThemeMode) => void;
	onOpenLogPanel?: () => void;
	onNavigate: (path: string) => void;
};

export function WorkspaceTopbar({
	activeNav,
	themeMode,
	onThemeModeChange,
	onOpenLogPanel,
	onNavigate,
}: WorkspaceTopbarProps) {
	const [commandOpen, setCommandOpen] = useState(false);
	const section = WORKSPACE_SECTIONS[activeNav];

	const navCommands = useMemo(
		() => WORKSPACE_NAV_ITEMS.map((item) => ({ label: item.label, path: resolvePathFromNav(item.id) })),
		[],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				setCommandOpen((prev) => !prev);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);

	return (
		<>
			<header className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<SidebarTrigger className="shrink-0" />
					<div className="min-w-0">
						<p className="truncate text-sm font-semibold">{section.title}</p>
						<p className="truncate text-xs text-muted-foreground">{section.desc}</p>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button type="button" variant="outline" onClick={() => setCommandOpen(true)}>
						<Search data-icon="inline-start" />
						搜索命令
					</Button>
					<Button type="button" variant="secondary" className="bg-background/70" onClick={onOpenLogPanel}>
						<Logs data-icon="inline-start" />
						日志面板
					</Button>
					<div className="flex items-center rounded-xl border border-border bg-background/70 p-1">
						<Button type="button" onClick={() => onThemeModeChange('light')} variant={themeMode === 'light' ? 'default' : 'ghost'} size="icon-sm" className="rounded-lg">
							<Sun />
						</Button>
						<Button type="button" onClick={() => onThemeModeChange('dark')} variant={themeMode === 'dark' ? 'default' : 'ghost'} size="icon-sm" className="rounded-lg">
							<MoonStar />
						</Button>
						<Button type="button" onClick={() => onThemeModeChange('system')} variant={themeMode === 'system' ? 'default' : 'ghost'} size="icon-sm" className="rounded-lg">
							<MonitorCog />
						</Button>
					</div>
					<Button type="button" variant="secondary" className="bg-background/70">
						<ShieldCheck data-icon="inline-start" />
						状态巡检
					</Button>
				</div>
			</header>

			<CommandDialog
				open={commandOpen}
				onOpenChange={setCommandOpen}
				title="全局命令"
				description="快速跳转页面与触发常用动作"
			>
				<CommandInput placeholder="输入页面或命令关键字..." />
				<CommandList>
					<CommandEmpty>没有匹配项</CommandEmpty>
					<CommandGroup heading="页面跳转">
						{navCommands.map((command) => (
							<CommandItem
								key={command.path}
								onSelect={() => {
									onNavigate(command.path);
									setCommandOpen(false);
								}}
							>
								{command.label}
							</CommandItem>
						))}
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="动作">
						<CommandItem
							onSelect={() => {
								onOpenLogPanel?.();
								setCommandOpen(false);
							}}
						>
							打开日志面板
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}
