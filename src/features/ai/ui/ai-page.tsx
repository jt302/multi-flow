import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { SessionTableCard } from '@/widgets/session-table-card/ui/session-table-card';
import { CONSOLE_NAV_SECTIONS } from '@/widgets/console-shell/model/nav-sections';

export function AiPage() {
	const section = CONSOLE_NAV_SECTIONS.ai;
	return (
		<div className="space-y-3">
			<ActiveSectionCard label="AI 执行" title={section.title} description={section.desc} />
			<SessionTableCard title={section.tableTitle} rows={section.rows} />
		</div>
	);
}
