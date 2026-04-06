// src/app/ui/sidebar-footer-status.tsx
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('nav');
  const { data: profiles = [] } = useProfilesQuery();
  const managedProfiles = profiles.filter((p) => p.lifecycle === 'active');
  const running = managedProfiles.filter((p) => p.running).length;
  if (running > 0) return { label: t('sidebar.status.browserRunning', { count: running }), variant: 'default' };
  return { label: t('sidebar.status.browserIdle'), variant: 'secondary' };
}

function useProxyBadge(): BadgeState {
  const { t } = useTranslation('nav');
  const { data: proxies = [] } = useProxiesQuery();
  if (proxies.length === 0) return { label: t('sidebar.status.proxyNone'), variant: 'secondary' };
  const ok = proxies.filter((p) => p.checkStatus === 'ok').length;
  const total = proxies.length;
  if (ok === total) return { label: t('sidebar.status.proxyAllOk'), variant: 'default' };
  if (ok === 0) return { label: t('sidebar.status.proxyAllFail'), variant: 'destructive' };
  return { label: t('sidebar.status.proxySome', { ok, total }), variant: 'warning' };
}

function useSyncBadge(): BadgeState {
  const { t } = useTranslation('nav');
  const status = useSyncManagerStore((s) => s.connectionStatus);
  switch (status) {
    case 'connected': return { label: t('sidebar.status.syncConnected'), variant: 'default' };
    case 'starting': return { label: t('sidebar.status.syncStarting'), variant: 'warning' };
    case 'disconnected':
    case 'error': return { label: t('sidebar.status.syncOffline'), variant: 'destructive' };
    default: return { label: t('sidebar.status.syncNotStarted'), variant: 'secondary' };
  }
}

function useAutomationBadge(): BadgeState {
  const { t } = useTranslation('nav');
  const activeRunId = useAutomationStore((s) => s.activeRunId);
  const liveRunStatus = useAutomationStore((s) => s.liveRunStatus);
  if (!activeRunId) return { label: t('sidebar.status.automationIdle'), variant: 'secondary' };
  if (liveRunStatus === 'waiting_human') return { label: t('sidebar.status.automationWaiting'), variant: 'warning' };
  if (liveRunStatus === 'running') return { label: t('sidebar.status.automationRunning'), variant: 'default' };
  // pending/terminal states or stale activeRunId from previous session
  return { label: t('sidebar.status.automationIdle'), variant: 'secondary' };
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
  const { t } = useTranslation('nav');
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const navigate = useNavigate();

  const browserBadge = useBrowserBadge();
  const proxyBadge = useProxyBadge();
  const syncBadge = useSyncBadge();
  const automationBadge = useAutomationBadge();

  const rows: Array<{ label: string; badge: BadgeState; path: string }> = [
    { label: t('sidebar.status.browser'), badge: browserBadge, path: '/profiles' },
    { label: t('sidebar.status.proxy'), badge: proxyBadge, path: '/proxy' },
    { label: t('sidebar.status.sync'), badge: syncBadge, path: '/windows' },
    { label: t('sidebar.status.automation'), badge: automationBadge, path: '/automation' },
  ];

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <div className="flex gap-1.5">
          <div
            className={cn('size-2 rounded-full', variantToColor(browserBadge.variant))}
            title={t('sidebar.status.rowTitle', { label: t('sidebar.status.browser'), status: browserBadge.label })}
          />
          <div
            className={cn('size-2 rounded-full', variantToColor(proxyBadge.variant))}
            title={t('sidebar.status.rowTitle', { label: t('sidebar.status.proxy'), status: proxyBadge.label })}
          />
        </div>
        <div className="flex gap-1.5">
          <div
            className={cn('size-2 rounded-full', variantToColor(syncBadge.variant))}
            title={t('sidebar.status.rowTitle', { label: t('sidebar.status.sync'), status: syncBadge.label })}
          />
          <div
            className={cn('size-2 rounded-full', variantToColor(automationBadge.variant))}
            title={t('sidebar.status.rowTitle', { label: t('sidebar.status.automation'), status: automationBadge.label })}
          />
        </div>
      </div>
    );
  }

  return (
    <Card className="border-sidebar-border/40 bg-sidebar-accent/30 shadow-sm transition-all duration-300">
      <CardHeader className="p-2 pb-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/65">
          {t('sidebar.status.title')}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5 p-2 pt-0">
        {rows.map(({ label, badge, path }) => (
          <button
            key={label}
            type="button"
            title={t('sidebar.status.rowTitle', { label, status: badge.label })}
            onClick={() => navigate(path)}
            className="flex cursor-pointer items-center justify-between rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-sidebar-accent/50"
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
