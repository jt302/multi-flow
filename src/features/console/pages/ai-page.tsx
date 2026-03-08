import { ActiveSectionCard, SessionTableCard } from '../components';
import { NAV_SECTIONS } from '../constants';

export function AiPage() {
	const section = NAV_SECTIONS.ai;
	return (
		<div className="space-y-3">
			<ActiveSectionCard label="AI 执行" title={section.title} description={section.desc} />
			<SessionTableCard title={section.tableTitle} rows={section.rows} />
		</div>
	);
}
