import { Badge, CardContent } from '@/components/ui';
import type { BackendLogEvent } from '@/entities/log-entry/api/logs-api';
import {
	formatLogTime,
	getLogEventKey,
	levelToVariant,
	normalizeLogLevel,
} from '../model/use-log-panel-state';

type LogPanelListProps = {
	listRef: React.RefObject<HTMLDivElement | null>;
	filteredLogs: BackendLogEvent[];
	groupedLogs: Array<[string, BackendLogEvent[]]>;
	groupByProfile: boolean;
	expandedGroups: Record<string, boolean>;
	onGroupOpenChange: (groupId: string, open: boolean) => void;
};

function LogRow({ item }: { item: BackendLogEvent }) {
	const levelLabel = normalizeLogLevel(item.level);
	return (
		<div className="grid grid-cols-[74px_68px_220px_minmax(0,1fr)] items-start gap-2 rounded-lg border border-border/60 bg-background/55 px-2.5 py-1.5">
			<span className="text-muted-foreground">{formatLogTime(item.ts)}</span>
			<Badge variant={levelToVariant(levelLabel)} className="justify-center rounded-md px-1.5 py-0.5">
				{levelLabel}
			</Badge>
			<span className="truncate text-primary">{item.component}</span>
			<div className="min-w-0 text-foreground/95">
				{item.profileId ? (
					<span className="mr-2 rounded bg-primary/12 px-1.5 py-0.5 text-[11px] text-primary">
						{item.profileId}
					</span>
				) : null}
				<span className="break-words">{item.message}</span>
			</div>
		</div>
	);
}

export function LogPanelList({
	listRef,
	filteredLogs,
	groupedLogs,
	groupByProfile,
	expandedGroups,
	onGroupOpenChange,
}: LogPanelListProps) {
	return (
		<CardContent className="min-h-0 flex-1 p-0">
			<div ref={listRef} className="h-full overflow-y-auto px-4 pb-4">
				<div className="space-y-1 pb-2 font-mono text-xs">
					{filteredLogs.length === 0 ? (
						<p className="rounded-xl border border-border/70 bg-background/65 px-3 py-10 text-center text-sm text-muted-foreground">
							暂无匹配日志
						</p>
					) : groupByProfile ? (
						groupedLogs.map(([profileId, items]) => {
							const opened = expandedGroups[profileId] ?? true;
							return (
								<details
									key={profileId}
									open={opened}
									className="rounded-xl border border-border/70 bg-background/50 px-2"
									onToggle={(event) => onGroupOpenChange(profileId, event.currentTarget.open)}
								>
								<summary className="cursor-pointer select-none py-2 text-sm font-medium text-foreground">
									{profileId === 'unassigned' ? '未绑定 Profile' : profileId} ({items.length})
								</summary>
								<div className="space-y-1 pb-2">
									{items.map((item, index) => (
										<LogRow key={getLogEventKey(item, index)} item={item} />
									))}
								</div>
							</details>
						);
					})
				) : (
					filteredLogs.map((item, index) => (
						<LogRow key={getLogEventKey(item, index)} item={item} />
					))
				)}
			</div>
		</div>
	</CardContent>
	);
}
