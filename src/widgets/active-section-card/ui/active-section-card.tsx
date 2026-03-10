import { PageHeader } from '@/components/common';

import type { ActiveSectionCardProps } from '@/app/model/workspace-types';

export function ActiveSectionCard({ label, title, description }: ActiveSectionCardProps) {
	return <PageHeader label={label} title={title} description={description} className="mb-3" />;
}
