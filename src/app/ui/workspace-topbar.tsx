import { Logs, MonitorCog, MoonStar, Search, Sun } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getWorkspaceNavItems } from '@/app/model/workspace-nav-items';
import { getWorkspaceSection } from '@/app/model/workspace-sections';
import type { NavId } from '@/app/model/workspace-types';
import { resolvePathFromNav } from '@/app/workspace-routes';
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
import { cn } from '@/lib/utils';
import { DownloadsPopover } from '@/widgets/downloads/ui/downloads-popover';
import { OfflineBadge } from '@/widgets/downloads/ui/offline-badge';

type WorkspaceTopbarProps = {
	activeNav: NavId;
	themeMode: ThemeMode;
	onThemeModeChange: (mode: ThemeMode) => void;
	onOpenLogPanel?: () => void;
	onNavigate: (path: string) => void;
};

export const WorkspaceTopbar = memo(function WorkspaceTopbar({
	activeNav,
	themeMode,
	onThemeModeChange,
	onOpenLogPanel,
	onNavigate,
}: WorkspaceTopbarProps) {
	const { t } = useTranslation('common');
	const [commandOpen, setCommandOpen] = useState(false);
	const section = useMemo(() => getWorkspaceSection(activeNav), [activeNav]);

	const navCommands = useMemo(
		() =>
			getWorkspaceNavItems().map((item) => ({
				label: item.label,
				path: resolvePathFromNav(item.id),
			})),
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
			<header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
				<div className="flex min-w-0 items-center gap-3 sm:flex-1">
					<SidebarTrigger className="shrink-0" />
					<div className="min-w-0">
						<p className="truncate text-sm font-semibold">{section.title}</p>
						<p className="truncate text-xs text-muted-foreground">{section.desc}</p>
					</div>
				</div>

				<div className="flex w-full min-w-0 items-center gap-2 sm:ml-auto sm:w-auto sm:max-w-full sm:shrink-0">
					<Button
						type="button"
						variant="outline"
						onClick={() => setCommandOpen(true)}
						className="min-w-0 flex-1 justify-start border-border/40 bg-background/50 dark:bg-background/50 shadow-sm transition-all duration-300 hover:scale-[1.02] sm:w-auto sm:flex-none sm:justify-center"
					>
						<Search data-icon="inline-start" className="text-muted-foreground" />
						{t('nav:searchCommand')}
					</Button>
					<OfflineBadge />
					<DownloadsPopover />
					<Button
						type="button"
						variant="secondary"
						className="min-w-0 flex-1 justify-start bg-background/50 dark:bg-background/50 shadow-sm border border-border/40 transition-all duration-300 hover:scale-[1.02] sm:w-auto sm:flex-none sm:justify-center"
						onClick={onOpenLogPanel}
					>
						<Logs data-icon="inline-start" className="text-muted-foreground" />
						{t('nav:logPanel')}
					</Button>
					<div className="shrink-0 rounded-xl border border-border/40 bg-background/50 dark:bg-background/50 p-1 shadow-sm transition-all duration-300 hover:shadow-md">
						<div className="flex items-center justify-between sm:w-auto sm:justify-start">
							<Button
								type="button"
								onClick={() => onThemeModeChange('light')}
								variant={themeMode === 'light' ? 'default' : 'ghost'}
								size="icon-sm"
								className={cn(
									'rounded-lg transition-all duration-300',
									themeMode === 'light' && 'shadow-sm',
								)}
							>
								<Sun />
							</Button>
							<Button
								type="button"
								onClick={() => onThemeModeChange('dark')}
								variant={themeMode === 'dark' ? 'default' : 'ghost'}
								size="icon-sm"
								className={cn(
									'rounded-lg transition-all duration-300',
									themeMode === 'dark' && 'shadow-sm',
								)}
							>
								<MoonStar />
							</Button>
							<Button
								type="button"
								onClick={() => onThemeModeChange('system')}
								variant={themeMode === 'system' ? 'default' : 'ghost'}
								size="icon-sm"
								className={cn(
									'rounded-lg transition-all duration-300',
									themeMode === 'system' && 'shadow-sm',
								)}
							>
								<MonitorCog />
							</Button>
						</div>
					</div>
				</div>
			</header>

			<CommandDialog
				open={commandOpen}
				onOpenChange={setCommandOpen}
				title={t('nav:globalCommand')}
				description={t('nav:globalCommandDesc')}
			>
				<CommandInput placeholder={t('nav:commandPlaceholder')} />
				<CommandList>
					<CommandEmpty>{t('common:noMatches')}</CommandEmpty>
					<CommandGroup heading={t('nav:pageJump')}>
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
					<CommandGroup heading={t('nav:actions')}>
						<CommandItem
							onSelect={() => {
								onOpenLogPanel?.();
								setCommandOpen(false);
							}}
						>
							{t('nav:openLogPanel')}
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
});
