import { useLocation } from 'react-router-dom';

import { Card, Toaster } from '@/components/ui';
import { resolveSonnerTheme } from '@/entities/theme/model/sonner-theme';
import { useThemeSettings } from '@/entities/theme/model/use-theme-settings';
import { useLogPanelState } from '../model/use-log-panel-state';
import { LogPanelList } from './log-panel-list';
import { LogPanelToolbar } from './log-panel-toolbar';

export function LogPanel() {
	const { resolvedMode } = useThemeSettings();
	const { search } = useLocation();
	const isStandalone = new URLSearchParams(search).get('standalone') === '1';
	const {
		listRef,
		state,
		filteredLogs,
		groupedLogs,
		setComponentFilter,
		setProfileFilter,
		setKeyword,
		setLevelFilter,
		toggleGroupByProfile,
		toggleAutoScroll,
		setGroupOpen,
		clearLogs,
		openDetachedWindow,
		exportCurrent,
	} = useLogPanelState();

	return (
		<div className="h-dvh overflow-hidden p-3 md:p-5">
			<Card className="flex h-full min-h-0 flex-col border-border/70 bg-card/92 backdrop-blur-2xl">
				<LogPanelToolbar
					isStandalone={isStandalone}
					openingWindow={state.openingWindow}
					exporting={state.exporting}
					autoScroll={state.autoScroll}
					groupByProfile={state.groupByProfile}
					componentFilter={state.componentFilter}
					profileFilter={state.profileFilter}
					keyword={state.keyword}
					levelFilter={state.levelFilter}
					logCount={state.logs.length}
					filteredCount={filteredLogs.length}
					loading={state.loading}
					onOpenDetachedWindow={() => void openDetachedWindow()}
					onToggleAutoScroll={toggleAutoScroll}
					onClearLogs={clearLogs}
					onToggleGroupByProfile={toggleGroupByProfile}
					onExportCurrent={() => void exportCurrent()}
					onComponentFilterChange={setComponentFilter}
					onProfileFilterChange={setProfileFilter}
					onKeywordChange={setKeyword}
					onLevelFilterChange={setLevelFilter}
				/>
				<LogPanelList
					listRef={listRef}
					filteredLogs={filteredLogs}
					groupedLogs={groupedLogs}
					groupByProfile={state.groupByProfile}
					expandedGroups={state.expandedGroups}
					onGroupOpenChange={setGroupOpen}
				/>
			</Card>
			<Toaster theme={resolveSonnerTheme(resolvedMode)} />
		</div>
	);
}
