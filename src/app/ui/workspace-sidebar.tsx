import { Cpu, Play, RefreshCcw } from 'lucide-react';

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { WORKSPACE_NAV_ITEMS } from '@/app/model/workspace-nav-items';
import type { NavId } from '@/app/model/workspace-types';

type WorkspaceSidebarProps = {
	activeNav: NavId;
	onNavChange: (nav: NavId) => void;
	isRunning: boolean;
	onToggleRunning: () => void;
};

export function WorkspaceSidebar({
	activeNav,
	onNavChange,
	isRunning,
	onToggleRunning,
}: WorkspaceSidebarProps) {
	return (
		<>
			<SidebarHeader className="p-3 pb-2">
				<div className="flex items-center gap-3 rounded-2xl border border-sidebar-border/65 bg-sidebar-accent/55 p-2.5">
					<div className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
						<Cpu className="size-4" />
					</div>
					<div className="min-w-0">
						<p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/65">multi-flow</p>
						<p className="truncate text-base font-semibold leading-none">Workspace</p>
					</div>
				</div>
			</SidebarHeader>

			<SidebarContent className="px-2 pb-2">
				<SidebarGroup className="p-1">
					<SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
						导航
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1.5">
							{WORKSPACE_NAV_ITEMS.map((item) => {
								const active = item.id === activeNav;
								const ItemIcon = item.icon;
								return (
									<SidebarMenuItem key={item.id}>
										<SidebarMenuButton
											type="button"
											variant={active ? 'outline' : 'default'}
											isActive={active}
											onClick={() => onNavChange(item.id)}
											tooltip={item.label}
											className={cn(
												'h-10 rounded-xl px-2.5',
												active
													? 'border-primary/35 bg-primary/12 shadow-sm'
													: 'border border-transparent hover:bg-sidebar-accent/80',
											)}
										>
											<span
												className={cn(
													'grid size-7 place-items-center rounded-lg',
													active
														? 'bg-primary/20 text-primary'
														: 'bg-sidebar-accent/65 text-sidebar-foreground/70',
												)}
											>
												<ItemIcon className="size-3.5" />
											</span>
											<span>{item.label}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="p-3 pt-1">
				<Card className="border-sidebar-border/60 bg-sidebar-accent/45">
					<CardHeader className="p-3 pb-1.5">
						<p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/65">RPA 状态</p>
					</CardHeader>
					<CardContent className="flex flex-col gap-2 p-3 pt-0">
						<div className="flex items-center justify-between text-xs">
							<span>执行引擎</span>
							<Badge variant={isRunning ? 'default' : 'secondary'}>{isRunning ? '活跃' : '暂停'}</Badge>
						</div>
						<Button type="button" variant="secondary" size="sm" onClick={onToggleRunning}>
							{isRunning ? <RefreshCcw data-icon="inline-start" /> : <Play data-icon="inline-start" />}
							{isRunning ? '暂停执行引擎' : '恢复执行引擎'}
						</Button>
					</CardContent>
				</Card>
			</SidebarFooter>
		</>
	);
}
