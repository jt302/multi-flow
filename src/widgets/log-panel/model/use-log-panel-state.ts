import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { toast } from 'sonner';

import type { BackendLogEvent } from '@/entities/log-entry/api/logs-api';
import {
	exportBackendLogs,
	listenBackendLogs,
	openLogPanelWindow,
	readBackendLogs,
} from '@/entities/log-entry/api/logs-api';

const MAX_LOG_LINES = 2000;

export const LEVEL_OPTIONS = ['all', 'INFO', 'WARN', 'ERROR'] as const;

type LogLevelFilter = (typeof LEVEL_OPTIONS)[number];

type LogFilterInput = {
	levelFilter: LogLevelFilter;
	componentFilter: string;
	profileFilter: string;
	keyword: string;
};

type LogPanelState = {
	logs: BackendLogEvent[];
	componentFilter: string;
	profileFilter: string;
	keyword: string;
	levelFilter: LogLevelFilter;
	groupByProfile: boolean;
	expandedGroups: Record<string, boolean>;
	autoScroll: boolean;
	loading: boolean;
	openingWindow: boolean;
	exporting: boolean;
};

type LogPanelAction =
	| { type: 'set_logs'; logs: BackendLogEvent[] }
	| { type: 'append_log'; log: BackendLogEvent }
	| { type: 'set_component_filter'; value: string }
	| { type: 'set_profile_filter'; value: string }
	| { type: 'set_keyword'; value: string }
	| { type: 'set_level_filter'; value: LogLevelFilter }
	| { type: 'toggle_group_by_profile' }
	| { type: 'toggle_auto_scroll' }
	| { type: 'set_group_open'; groupId: string; open: boolean }
	| { type: 'set_loading'; value: boolean }
	| { type: 'set_opening_window'; value: boolean }
	| { type: 'set_exporting'; value: boolean }
	| { type: 'clear_logs' };

const initialState: LogPanelState = {
	logs: [],
	componentFilter: '',
	profileFilter: '',
	keyword: '',
	levelFilter: 'all',
	groupByProfile: false,
	expandedGroups: {},
	autoScroll: true,
	loading: true,
	openingWindow: false,
	exporting: false,
};

function reducer(state: LogPanelState, action: LogPanelAction): LogPanelState {
	switch (action.type) {
		case 'set_logs':
			return { ...state, logs: action.logs };
		case 'append_log': {
			const logs = [...state.logs, action.log];
			return {
				...state,
				logs: logs.length <= MAX_LOG_LINES ? logs : logs.slice(logs.length - MAX_LOG_LINES),
			};
		}
		case 'set_component_filter':
			return { ...state, componentFilter: action.value };
		case 'set_profile_filter':
			return { ...state, profileFilter: action.value };
		case 'set_keyword':
			return { ...state, keyword: action.value };
		case 'set_level_filter':
			return { ...state, levelFilter: action.value };
		case 'toggle_group_by_profile':
			return { ...state, groupByProfile: !state.groupByProfile };
		case 'toggle_auto_scroll':
			return { ...state, autoScroll: !state.autoScroll };
		case 'set_group_open':
			return {
				...state,
				expandedGroups: { ...state.expandedGroups, [action.groupId]: action.open },
			};
		case 'set_loading':
			return { ...state, loading: action.value };
		case 'set_opening_window':
			return { ...state, openingWindow: action.value };
		case 'set_exporting':
			return { ...state, exporting: action.value };
		case 'clear_logs':
			return { ...state, logs: [] };
		default:
			return state;
	}
}

export function formatLogTime(ts: number): string {
	return new Date(ts * 1000).toLocaleTimeString('zh-CN', { hour12: false });
}

export function normalizeLogLevel(level: string): string {
	const normalized = level.trim().toUpperCase();
	if (normalized.includes('ERROR')) {
		return 'ERROR';
	}
	if (normalized.includes('WARN')) {
		return 'WARN';
	}
	if (normalized.includes('INFO')) {
		return 'INFO';
	}
	return normalized || 'INFO';
}

export function levelToVariant(level: string): 'default' | 'secondary' | 'destructive' | 'outline' {
	const upper = normalizeLogLevel(level);
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

export function getLogEventKey(item: BackendLogEvent, index: number): string {
	return `${item.ts}:${item.level}:${item.component}:${item.profileId ?? 'unassigned'}:${item.line}:${index}`;
}

export function filterBackendLogs(
	logs: BackendLogEvent[],
	filters: LogFilterInput,
): BackendLogEvent[] {
	const componentKeyword = filters.componentFilter.trim().toLowerCase();
	const profileKeyword = filters.profileFilter.trim().toLowerCase();
	const contentKeyword = filters.keyword.trim().toLowerCase();
	return logs.filter((item) => {
		const normalizedLevel = normalizeLogLevel(item.level);
		if (filters.levelFilter !== 'all' && normalizedLevel !== filters.levelFilter) {
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
}

export function useLogPanelState() {
	const [state, dispatch] = useReducer(reducer, initialState);
	const listRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		let disposed = false;
		let unlisten: (() => void) | null = null;

		void (async () => {
			try {
				const initial = await readBackendLogs(500);
				if (!disposed) {
					dispatch({ type: 'set_logs', logs: initial });
				}
			} catch (error) {
				if (!disposed) {
					toast.error('读取后端日志失败');
				}
				console.error(error);
			} finally {
				if (!disposed) {
					dispatch({ type: 'set_loading', value: false });
				}
			}

			try {
				unlisten = await listenBackendLogs((event) => {
					dispatch({ type: 'append_log', log: event });
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
		if (!state.autoScroll || !listRef.current) {
			return;
		}
		listRef.current.scrollTop = listRef.current.scrollHeight;
	}, [state.autoScroll, state.logs]);

	const filteredLogs = useMemo(() => {
		return filterBackendLogs(state.logs, {
			levelFilter: state.levelFilter,
			componentFilter: state.componentFilter,
			profileFilter: state.profileFilter,
			keyword: state.keyword,
		});
	}, [state.componentFilter, state.keyword, state.levelFilter, state.logs, state.profileFilter]);

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

	const openDetachedWindow = useCallback(async () => {
		if (state.openingWindow) {
			return;
		}
		dispatch({ type: 'set_opening_window', value: true });
		try {
			await openLogPanelWindow();
		} catch (error) {
			toast.error('打开独立日志窗口失败');
			console.error(error);
		} finally {
			dispatch({ type: 'set_opening_window', value: false });
		}
	}, [state.openingWindow]);

	const exportCurrent = useCallback(async () => {
		if (state.exporting) {
			return;
		}
		dispatch({ type: 'set_exporting', value: true });
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
			dispatch({ type: 'set_exporting', value: false });
		}
	}, [filteredLogs, state.exporting]);

	return {
		listRef,
		state,
		filteredLogs,
		groupedLogs,
		setComponentFilter: (value: string) => dispatch({ type: 'set_component_filter', value }),
		setProfileFilter: (value: string) => dispatch({ type: 'set_profile_filter', value }),
		setKeyword: (value: string) => dispatch({ type: 'set_keyword', value }),
		setLevelFilter: (value: LogLevelFilter) => dispatch({ type: 'set_level_filter', value }),
		toggleGroupByProfile: () => dispatch({ type: 'toggle_group_by_profile' }),
		toggleAutoScroll: () => dispatch({ type: 'toggle_auto_scroll' }),
		setGroupOpen: (groupId: string, open: boolean) => dispatch({ type: 'set_group_open', groupId, open }),
		clearLogs: () => dispatch({ type: 'clear_logs' }),
		openDetachedWindow,
		exportCurrent,
	};
}
