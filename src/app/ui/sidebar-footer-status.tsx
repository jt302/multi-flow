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
  const managedProfiles = profiles.filter((p) => p.lifecycle === 'active');
  const running = managedProfiles.filter((p) => p.running).length;
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
  if (liveRunStatus === 'pending') return { label: '准备中', variant: 'warning' };
  // 终态 (success/failed/cancelled/interrupted): activeRunId 清除前的短暂窗口
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
