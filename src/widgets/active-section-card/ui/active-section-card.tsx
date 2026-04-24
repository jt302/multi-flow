import type { ActiveSectionCardProps } from '@/app/model/workspace-types';
import { PageHeader } from '@/components/common';

export function ActiveSectionCard({
	label: _label,
	title: _title,
	description: _description,
}: ActiveSectionCardProps) {
	return <PageHeader />;
}
