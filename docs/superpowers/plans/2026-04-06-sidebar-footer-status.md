# Sidebar Footer Status Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake "Runtime Status" engine toggle in SidebarFooter with a real System Status Dashboard showing live data for browsers, proxies, sync, and automation.

**Architecture:** Create a self-contained `SidebarFooterStatus` component that reads from existing query hooks and stores. Remove the fake `isRunning` state from `WorkspaceLayout`. Update `WorkspaceSidebar` to use the new component instead of the old props.

**Tech Stack:** React 19, TypeScript, TanStack Query, Zustand, shadcn/ui, react-router-dom, lucide-react

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/app/ui/sidebar-footer-status.tsx` | Self-contained status component — reads live data, renders expanded/collapsed views |
| Modify | `src/app/ui/workspace-sidebar.tsx` | Remove `isRunning`/`onToggleRunning` props, render `<SidebarFooterStatus />` |
| Modify | `src/app/ui/workspace-layout.tsx` | Remove `isRunning` state and `onToggleRunning` handler |

---

## Task 1: Create `sidebar-footer-status.tsx`

**Files:**
- Create: `src/app/ui/sidebar-footer-status.tsx`

- [ ] **Step 1: Create the component file**

```tsx
// src/app/ui/sidebar-footer-status.tsx
import { useNavigate } from 'react-router-dom';

import { Badge, Card, CardContent, CardHeader, useSidebar } from '@/components/ui';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { useProxiesQuery } from '@/entities/proxy/model/use-proxies-query';
import { useSyncManagerStore } from '@/store/sync-manager-store';
import { useAutomationStore } from '@/store/automation-store';
import { cn } from '@/lib/utils';

// ── Derived badge values ────────────────────────────────────────────────────

type BadgeState = {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'warning';
};

function useBrowserBadge(): BadgeState {
  const { data: profiles = [] } = useProfilesQuery();
  const active = profiles.filter((p) => p.lifecycle === 'active');
  const running = active.filter((p) => p.running).length;
  if (running > 0) return { label: `${running} 运行中`, variant: 'default' };
  return { label: '无运行', variant: 'secondary' };
}

function useProxyBadge(): BadgeState {
  const { data: proxies = [] } = useProxiesQuery();
  if (proxies.length === 0) return { label: '无代理', variant: 'secondary' };
  const ok = proxies.filter((p) => p.checkStatus === 'ok').length;
  const total = proxies.length;
  if (ok === total) return { label: '全部正常', variant: 'default' };
  if (ok === 0) return { label: '全部异常', variant: 'destructive' };
  return { label: `${ok}/${total} 正常`, variant: 'warning' };
}

function useSyncBadge(): BadgeState {
  const status = useSyncManagerStore((s) => s.connectionStatus);
  switch (status) {
    case 'connected': return { label: '已连接', variant: 'default' };
    case 'starting': return { label: '启动中', variant: 'warning' };
    case 'disconnected':
    case 'error': return { label: '离线', variant: 'destructive' };
    default: return { label: '未启动', variant: 'secondary' };
  }
}

function useAutomationBadge(): BadgeState {
  const activeRunId = useAutomationStore((s) => s.activeRunId);
  const liveRunStatus = useAutomationStore((s) => s.liveRunStatus);
  if (!activeRunId) return { label: '空闲', variant: 'secondary' };
  if (liveRunStatus === 'waiting_human') return { label: '等待操作', variant: 'warning' };
  if (liveRunStatus === 'running') return { label: '运行中', variant: 'default' };
  return { label: '空闲', variant: 'secondary' };
}

// ── Dot color for collapsed view ────────────────────────────────────────────

function variantToColor(variant: BadgeState['variant']): string {
  switch (variant) {
    case 'default': return 'bg-emerald-500';
    case 'warning': return 'bg-amber-400';
    case 'destructive': return 'bg-red-500';
    default: return 'bg-muted-foreground/30';
  }
}

// ── Main component ──────────────────────────────────────────────────────────

export function SidebarFooterStatus() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();

  const browserBadge = useBrowserBadge();
  const proxyBadge = useProxyBadge();
  const syncBadge = useSyncBadge();
  const automationBadge = useAutomationBadge();

  const rows: Array<{ label: string; badge: BadgeState; path: string; title: string }> = [
    { label: '浏览器', badge: browserBadge, path: '/profiles', title: `浏览器: ${browserBadge.label}` },
    { label: '代理', badge: proxyBadge, path: '/proxy', title: `代理: ${proxyBadge.label}` },
    { label: '同步', badge: syncBadge, path: '/windows', title: `同步: ${syncBadge.label}` },
    { label: '自动化', badge: automationBadge, path: '/automation', title: `自动化: ${automationBadge.label}` },
  ];

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <div className="flex gap-1.5">
          <div
            className={cn('size-2 rounded-full', variantToColor(browserBadge.variant))}
            title={`浏览器: ${browserBadge.label}`}
          />
          <div
            className={cn('size-2 rounded-full', variantToColor(proxyBadge.variant))}
            title={`代理: ${proxyBadge.label}`}
          />
        </div>
        <div className="flex gap-1.5">
          <div
            className={cn('size-2 rounded-full', variantToColor(syncBadge.variant))}
            title={`同步: ${syncBadge.label}`}
          />
          <div
            className={cn('size-2 rounded-full', variantToColor(automationBadge.variant))}
            title={`自动化: ${automationBadge.label}`}
          />
        </div>
      </div>
    );
  }

  return (
    <Card className="border-sidebar-border/40 bg-sidebar-accent/30 shadow-sm transition-all duration-300">
      <CardHeader className="p-3 pb-1.5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/65">
          系统状态
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5 p-3 pt-0">
        {rows.map(({ label, badge, path, title }) => (
          <button
            key={label}
            type="button"
            title={title}
            onClick={() => navigate(path)}
            className="flex cursor-pointer items-center justify-between rounded-md px-1 py-1 text-xs transition-colors hover:bg-sidebar-accent/50"
          >
            <span className="text-sidebar-foreground/70">{label}</span>
            <Badge variant={badge.variant} className="text-[10px]">
              {badge.label}
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Check that the `Badge` component supports a `warning` variant**

Run:
```bash
grep -n "warning" /Users/tt/Developer/personal/multi-flow/src/components/ui/badge.tsx
```

If `warning` is NOT listed as a variant, skip to Step 3. If it IS listed, skip Step 3 and go to Step 4.

- [ ] **Step 3: (Only if `warning` variant missing) Add `warning` variant to Badge**

Open `src/components/ui/badge.tsx` and add `warning` to the `badgeVariants`:

```tsx
// Find the badgeVariants cva call and add:
warning:
  'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400 [a&]:hover:bg-amber-500/25',
```

- [ ] **Step 4: Run TypeScript build to verify the new file compiles**

```bash
cd /Users/tt/Developer/personal/multi-flow && pnpm -s build 2>&1 | head -50
```

Expected: build succeeds OR only fails on the files we haven't updated yet (workspace-sidebar.tsx still has old props). Errors about missing `isRunning`/`onToggleRunning` on `WorkspaceSidebar` are expected at this stage — fix in Task 2.

---

## Task 2: Update `workspace-sidebar.tsx`

**Files:**
- Modify: `src/app/ui/workspace-sidebar.tsx`

- [ ] **Step 1: Remove old props and import, add `SidebarFooterStatus`**

Replace the entire file content with:

```tsx
import { Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
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
import { PROFILES_DEVICE_PRESETS_PATH } from '@/app/workspace-routes';
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
								const isProfilesItem = item.id === 'profiles';
								return (
									<SidebarMenuItem key={item.id}>
										<SidebarMenuButton
											type="button"
											variant={active ? 'outline' : 'default'}
											isActive={active}
											aria-label={item.label}
											onClick={() => onNavChange(item.id)}
											tooltip={item.label}
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
										{isProfilesItem && !collapsed && (
											<SidebarMenuSub>
												<SidebarMenuSubItem>
													<SidebarMenuSubButton
														type="button"
														isActive={activePath === PROFILES_DEVICE_PRESETS_PATH}
														onClick={() => onNavigate(PROFILES_DEVICE_PRESETS_PATH)}
														className="cursor-pointer"
													>
														<Smartphone className="size-3.5" />
														{t('sidebar.devicePresets')}
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											</SidebarMenuSub>
										)}
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
```

> **Note:** The `Cpu` icon is still used in the `SidebarHeader`. Add it back to the import: `import { Cpu, Smartphone } from 'lucide-react';`

- [ ] **Step 2: Fix the import — add `Cpu` back**

The file above is missing `Cpu` in the import line. The correct first line should be:

```tsx
import { Cpu, Smartphone } from 'lucide-react';
```

Make sure the written file has both icons imported.

- [ ] **Step 3: Run TypeScript build**

```bash
cd /Users/tt/Developer/personal/multi-flow && pnpm -s build 2>&1 | head -50
```

Expected: errors about `isRunning` and `onToggleRunning` being passed as props in `workspace-layout.tsx` (unused props now). Fix in Task 3.

---

## Task 3: Clean up `workspace-layout.tsx`

**Files:**
- Modify: `src/app/ui/workspace-layout.tsx`

- [ ] **Step 1: Remove `isRunning` state and `onToggleRunning` from `WorkspaceLayout`**

In `src/app/ui/workspace-layout.tsx`:

Remove line 35:
```tsx
const [isRunning, setIsRunning] = useState(true);
```

Remove `useState` from the React import if it's no longer used. Check line 1:
```tsx
import { Suspense, useState, type CSSProperties } from 'react';
```
→ Change to:
```tsx
import { Suspense, type CSSProperties } from 'react';
```

- [ ] **Step 2: Remove the two props from the `WorkspaceSidebar` call**

Find this block (~line 127-134):
```tsx
<WorkspaceSidebar
  activeNav={activeNav}
  activePath={location.pathname}
  onNavChange={(nav) => navigate(resolvePathFromNav(nav))}
  onNavigate={(path) => navigate(path)}
  isRunning={isRunning}
  onToggleRunning={() => setIsRunning((prev) => !prev)}
/>
```

Replace with:
```tsx
<WorkspaceSidebar
  activeNav={activeNav}
  activePath={location.pathname}
  onNavChange={(nav) => navigate(resolvePathFromNav(nav))}
  onNavigate={(path) => navigate(path)}
/>
```

- [ ] **Step 3: Run TypeScript build — expect clean**

```bash
cd /Users/tt/Developer/personal/multi-flow && pnpm -s build 2>&1
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/tt/Developer/personal/multi-flow && git add src/app/ui/sidebar-footer-status.tsx src/app/ui/workspace-sidebar.tsx src/app/ui/workspace-layout.tsx src/components/ui/badge.tsx && git commit -m "feat(ui): replace fake engine toggle with real system status dashboard in sidebar footer"
```

---

## Task 4: Manual Verification

- [ ] **Step 1: Run the app**

```bash
cd /Users/tt/Developer/personal/multi-flow && pnpm tauri dev
```

- [ ] **Step 2: Verify expanded state**
  - Sidebar expanded → SidebarFooter shows card with "系统状态" label
  - Four rows visible: 浏览器 / 代理 / 同步 / 自动化
  - Each row shows a colored badge

- [ ] **Step 3: Verify collapsed state**
  - Click sidebar toggle → sidebar collapses to icon mode
  - SidebarFooter shows 2×2 dot matrix (4 colored dots)
  - Hover each dot → tooltip appears with status text

- [ ] **Step 4: Verify click navigation**
  - Click 浏览器 row → navigates to `/profiles`
  - Click 代理 row → navigates to `/proxy`
  - Click 同步 row → navigates to `/windows`
  - Click 自动化 row → navigates to `/automation`

- [ ] **Step 5: Verify live data**
  - Open a browser profile → 浏览器 badge updates to "N 运行中"
  - Close all profiles → badge returns to "无运行"

---

## Self-Review Checklist

**Spec coverage:**
- [x] Remove fake `isRunning` state → Task 3
- [x] 4 rows: browsers, proxy, sync, automation → Task 1
- [x] Color-coded badges → Task 1 (`useBrowserBadge`, `useProxyBadge`, etc.)
- [x] Click to navigate → Task 1 (`navigate(path)` in each row)
- [x] Collapsed 2×2 dot matrix → Task 1 (collapsed branch)
- [x] Automation always shown → Task 1 (all 4 rows always rendered)
- [x] TypeScript build check → Tasks 1, 2, 3

**Type consistency:**
- `BadgeState.variant` uses `'warning'` throughout — Task 1 Step 3 guards this with a Badge variant check
- `variantToColor` maps all 4 variants — complete
- `useSyncManagerStore` selector `(s) => s.connectionStatus` — matches `SyncManagerStoreState` type
- `useAutomationStore` selectors `(s) => s.activeRunId` and `(s) => s.liveRunStatus` — match `AutomationStore` type
