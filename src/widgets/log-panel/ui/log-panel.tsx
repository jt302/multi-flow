import {
	ArrowLeft,
	ChevronsUpDown,
	Download,
	RefreshCw,
	ScanSearch,
	SquareArrowOutUpRight,
	Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon, Input, Toaster } from '@/components/ui';
import { useThemeSettings } from '@/entities/theme/model/use-theme-settings';
import type { BackendLogEvent } from '@/entities/log-entry/api/logs-api';

import {
	exportBackendLogs,
	listenBackendLogs,
	openLogPanelWindow,
	readBackendLogs,
} from '@/entities/log-entry/api/logs-api';

const MAX_LOG_LINES = 2000;
const LEVEL_OPTIONS = ['all', 'INFO', 'WARN', 'ERROR'] as const;

function formatTime(ts: number): string {
	return new Date(ts * 1000).toLocaleTimeString('zh-CN', { hour12: false });
}

function levelToVariant(level: string): 'default' | 'secondary' | 'destructive' | 'outline' {
	const upper = level.toUpperCase();
	if (upper === 'ERROR') {
		return 'destructive';
	}
	if (upper === 'WARN') {
		return 'outline';
	}
	if (upper === 'INFO') {
		return 'default';
	}
	return 'secondary';
}

export function LogPanel() {
	const { resolvedMode } = useThemeSettings();
	const { search } = useLocation();
	const isStandalone = new URLSearchParams(search).get('standalone') === '1';
	const [logs, setLogs] = useState<BackendLogEvent[]>([]);
	const [componentFilter, setComponentFilter] = useState('');
	const [profileFilter, setProfileFilter] = useState('');
	const [keyword, setKeyword] = useState('');
	const [levelFilter, setLevelFilter] = useState<'all' | 'INFO' | 'WARN' | 'ERROR'>('all');
	const [groupByProfile, setGroupByProfile] = useState(false);
	const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
	const [autoScroll, setAutoScroll] = useState(true);
	const [loading, setLoading] = useState(true);
	const [openingWindow, setOpeningWindow] = useState(false);
	const [exporting, setExporting] = useState(false);
	const listRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		let disposed = false;
		let unlisten: (() => void) | null = null;

		const append = (next: BackendLogEvent) => {
			setLogs((prev) => {
				const merged = [...prev, next];
				if (merged.length <= MAX_LOG_LINES) {
					return merged;
				}
				return merged.slice(merged.length - MAX_LOG_LINES);
			});
		};

		void (async () => {
			try {
				const initial = await readBackendLogs(500);
				if (!disposed) {
					setLogs(initial);
				}
			} catch (error) {
				if (!disposed) {
					toast.error('读取后端日志失败');
				}
				console.error(error);
			} finally {
				if (!disposed) {
					setLoading(false);
				}
			}

			try {
				unlisten = await listenBackendLogs((event) => {
					append(event);
				});
			} catch (error) {
				if (!disposed) {
					toast.error('订阅日志事件失败');
				}
				console.error(error);
			}
		})();

		return () => {
			disposed = true;
			if (unlisten) {
				unlisten();
			}
		};
	}, []);

	useEffect(() => {
		if (!autoScroll || !listRef.current) {
			return;
		}
		listRef.current.scrollTop = listRef.current.scrollHeight;
	}, [autoScroll, logs]);

	const filteredLogs = useMemo(() => {
		const componentKeyword = componentFilter.trim().toLowerCase();
		const profileKeyword = profileFilter.trim().toLowerCase();
		const contentKeyword = keyword.trim().toLowerCase();
		return logs.filter((item) => {
			if (levelFilter !== 'all' && item.level.toUpperCase() !== levelFilter) {
				return false;
			}
			if (componentKeyword && !item.component.toLowerCase().includes(componentKeyword)) {
				return false;
			}
			if (profileKeyword && !(item.profileId ?? '').toLowerCase().includes(profileKeyword)) {
				return false;
			}
			if (contentKeyword && !item.line.toLowerCase().includes(contentKeyword)) {
				return false;
			}
			return true;
		});
	}, [componentFilter, keyword, levelFilter, logs, profileFilter]);

	const groupedLogs = useMemo(() => {
		const map = new Map<string, BackendLogEvent[]>();
		for (const item of filteredLogs) {
			const key = item.profileId ?? 'unassigned';
			const list = map.get(key);
			if (list) {
				list.push(item);
			} else {
				map.set(key, [item]);
			}
		}
		return Array.from(map.entries()).sort((a, b) => {
			if (a[0] === 'unassigned') {
				return 1;
			}
			if (b[0] === 'unassigned') {
				return -1;
			}
			return a[0].localeCompare(b[0]);
		});
	}, [filteredLogs]);

	const openDetachedWindow = async () => {
		if (openingWindow) {
			return;
		}
		setOpeningWindow(true);
		try {
			await openLogPanelWindow();
		} catch (error) {
			toast.error('打开独立日志窗口失败');
			console.error(error);
		} finally {
			setOpeningWindow(false);
		}
	};

	const exportCurrent = async () => {
		if (exporting) {
			return;
		}
		setExporting(true);
		try {
			const result = await exportBackendLogs(
				filteredLogs.map((item) => item.line),
				`backend-logs-filtered-${Date.now()}.log`,
			);
			toast.success(`已导出 ${result.lineCount} 条日志`, {
				description: result.path,
			});
		} catch (error) {
			toast.error('导出日志失败');
			console.error(error);
		} finally {
			setExporting(false);
		}
	};

	const renderLogItem = (item: BackendLogEvent, index: number) => (
		<div
			key={`${item.ts}-${index}-${item.component}`}
			className="grid grid-cols-[74px_68px_220px_minmax(0,1fr)] items-start gap-2 rounded-lg border border-border/60 bg-background/55 px-2.5 py-1.5"
		>
			<span className="text-muted-foreground">{formatTime(item.ts)}</span>
			<Badge variant={levelToVariant(item.level)} className="justify-center rounded-md px-1.5 py-0.5">
				{item.level}
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

	return (
		<div className="h-dvh overflow-hidden p-3 md:p-5">
			<Card className="flex h-full min-h-0 flex-col border-border/70 bg-card/92 backdrop-blur-2xl">
				<CardHeader className="gap-3 pb-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">backend / logs</p>
							<CardTitle className="mt-1 text-base">后端日志面板</CardTitle>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{isStandalone ? null : (
								<Link
									to="/dashboard"
									className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
								>
									<Icon icon={ArrowLeft} size={13} />
									返回控制台
								</Link>
							)}
							{isStandalone ? null : (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									disabled={openingWindow}
									onClick={() => {
										void openDetachedWindow();
									}}
								>
									<Icon icon={SquareArrowOutUpRight} size={13} />
									打开独立窗口
								</Button>
							)}
							<Button
								type="button"
								variant={autoScroll ? 'default' : 'outline'}
								size="sm"
								onClick={() => setAutoScroll((prev) => !prev)}
							>
								<Icon icon={ScanSearch} size={13} />
								自动滚动
							</Button>
							<Button type="button" variant="outline" size="sm" onClick={() => setLogs([])}>
								<Icon icon={Trash2} size={13} />
								清空视图
							</Button>
							<Button
								type="button"
								variant={groupByProfile ? 'default' : 'outline'}
								size="sm"
								onClick={() => setGroupByProfile((prev) => !prev)}
							>
								<Icon icon={ChevronsUpDown} size={13} />
								按 Profile 分组
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={exporting}
								onClick={() => {
									void exportCurrent();
								}}
							>
								<Icon icon={Download} size={13} />
								导出过滤结果
							</Button>
						</div>
					</div>

					<div className="grid gap-2 md:grid-cols-4">
						<div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/75 p-1">
							{LEVEL_OPTIONS.map((level) => (
								<Button
									key={level}
									type="button"
									size="sm"
									variant={levelFilter === level ? 'default' : 'ghost'}
									className="h-8 flex-1"
									onClick={() => setLevelFilter(level)}
								>
									{level}
								</Button>
							))}
						</div>
						<Input
							value={componentFilter}
							onChange={(event) => setComponentFilter(event.currentTarget.value)}
							placeholder="按 component 过滤，例如 engine_manager"
							className="bg-background/75"
						/>
						<Input
							value={profileFilter}
							onChange={(event) => setProfileFilter(event.currentTarget.value)}
							placeholder="按 profile_id 过滤，例如 pf_000001"
							className="bg-background/75"
						/>
						<Input
							value={keyword}
							onChange={(event) => setKeyword(event.currentTarget.value)}
							placeholder="搜索日志内容"
							className="bg-background/75"
						/>
					</div>

					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Badge variant="secondary">总计 {logs.length}</Badge>
						<Badge variant="secondary">过滤后 {filteredLogs.length}</Badge>
						<Badge variant="secondary">级别 {levelFilter}</Badge>
						{groupByProfile ? <Badge variant="secondary">分组视图</Badge> : null}
						{loading ? (
							<span className="inline-flex items-center gap-1">
								<Icon icon={RefreshCw} size={12} className="animate-spin" />
								加载历史日志中...
							</span>
						) : null}
					</div>
				</CardHeader>

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
											onToggle={(event) => {
												const current = event.currentTarget.open;
												setExpandedGroups((prev) => ({ ...prev, [profileId]: current }));
											}}
										>
											<summary className="cursor-pointer select-none py-2 text-sm font-medium text-foreground">
												{profileId === 'unassigned' ? '未绑定 Profile' : profileId} ({items.length})
											</summary>
											<div className="space-y-1 pb-2">
												{items.map((item, index) => renderLogItem(item, index))}
											</div>
										</details>
									);
								})
							) : (
								filteredLogs.map((item, index) => renderLogItem(item, index))
							)}
						</div>
					</div>
				</CardContent>
			</Card>
			<Toaster theme={resolvedMode === 'dark' ? 'dark' : 'light'} />
		</div>
	);
}
