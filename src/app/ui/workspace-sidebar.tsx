import { Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { getWorkspaceNavItems } from '@/app/model/workspace-nav-items';
import type { NavId } from '@/app/model/workspace-types';
import { SidebarFooterStatus } from './sidebar-footer-status';

type WorkspaceSidebarProps = {
	activeNav: NavId;
	activePath: string;
	onNavChange: (nav: NavId) => void;
	onNavigate: (path: string) => void;
};

export function WorkspaceSidebar({
	activeNav,
	activePath,
	onNavChange,
	onNavigate,
}: WorkspaceSidebarProps) {
	const { state } = useSidebar();
	const collapsed = state === 'collapsed';
	const { t } = useTranslation('nav');

	return (
		<>
			<SidebarHeader className={cn('p-3 pb-2', collapsed && 'px-0 pt-2 pb-1')}>
				{collapsed ? (
					<div className="mx-auto grid size-11 shrink-0 place-items-center rounded-2xl border border-sidebar-border/40 bg-sidebar-accent/30 shadow-sm transition-all duration-300">
						<div className="grid size-8 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
							<Cpu className="size-3.5" />
						</div>
					</div>
				) : (
					<div className="flex items-center gap-3 rounded-2xl border border-sidebar-border/40 bg-sidebar-accent/30 p-2.5 shadow-sm transition-all duration-300">
						<div className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
							<Cpu className="size-4" />
						</div>
						<div className="min-w-0">
							<p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/65">
								multi-flow
							</p>
							<p className="truncate text-base font-semibold leading-none">
								Workspace
							</p>
						</div>
					</div>
				)}
			</SidebarHeader>

			<SidebarContent className="px-2 pb-2">
				<SidebarGroup className="p-1">
					<SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
						{t('sidebar.navigation')}
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1.5">
							{getWorkspaceNavItems().map((item) => {
								const active = item.id === activeNav;
								const ItemIcon = item.icon;
								const hasCollapsedMenu = collapsed && Boolean(item.children?.length);
								const button = (
									<SidebarMenuButton
										type="button"
										variant={active ? 'outline' : 'default'}
										isActive={active}
										aria-label={item.label}
										onClick={
											hasCollapsedMenu
												? undefined
												: () => onNavChange(item.id)
										}
										tooltip={hasCollapsedMenu ? undefined : item.label}
										className={cn(
											'h-10 rounded-xl px-2.5 transition-all duration-300 active:scale-95',
											collapsed && 'h-8 justify-center px-0',
											active
												? 'border-primary/30 bg-primary/10 shadow-sm'
												: 'border border-transparent hover:bg-sidebar-accent/50 hover:shadow-sm hover:scale-[1.02]',
										)}
									>
										<span
											className={cn(
												'grid place-items-center',
												collapsed
													? active
														? 'size-5 text-primary'
														: 'size-5 text-sidebar-foreground/70'
													: active
														? 'bg-primary/20 text-primary'
														: 'rounded-lg bg-sidebar-accent/65 text-sidebar-foreground/70',
												!collapsed && 'size-7 rounded-lg',
											)}
										>
											<ItemIcon className="size-3.5" />
										</span>
										{collapsed ? null : <span>{item.label}</span>}
									</SidebarMenuButton>
								);
								return (
									<SidebarMenuItem key={item.id}>
										{hasCollapsedMenu ? (
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													{button}
												</DropdownMenuTrigger>
												<DropdownMenuContent
													side="right"
													align="start"
													className="min-w-44"
												>
													<DropdownMenuLabel>{item.label}</DropdownMenuLabel>
													<DropdownMenuSeparator />
													{item.children?.map((child) => {
														const ChildIcon = child.icon;
														return (
															<DropdownMenuItem
																key={child.path}
																onSelect={() => onNavigate(child.path)}
															>
																<ChildIcon className="size-4" />
																<span>{child.label}</span>
															</DropdownMenuItem>
														);
													})}
												</DropdownMenuContent>
											</DropdownMenu>
										) : (
											button
										)}
										{!collapsed && item.children?.length ? (
											<SidebarMenuSub>
												{item.children.map((child) => {
													const ChildIcon = child.icon;
													return (
														<SidebarMenuSubItem key={child.path}>
															<SidebarMenuSubButton
																type="button"
																isActive={activePath === child.path}
																onClick={() => onNavigate(child.path)}
																className="cursor-pointer"
															>
																<ChildIcon className="size-3.5" />
																{child.label}
															</SidebarMenuSubButton>
														</SidebarMenuSubItem>
													);
												})}
											</SidebarMenuSub>
										) : null}
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className={cn('p-3 pt-1', collapsed && 'p-2 pt-1')}>
				<SidebarFooterStatus />
			</SidebarFooter>
		</>
	);
}
