import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsUpDown, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { ProfileGroupSelector } from '@/components/common/profile-group-selector';
import { useProfilesQuery } from '@/entities/profile/model/use-profiles-query';
import { cn } from '@/lib/utils';

type Props = {
	selectedIds: string[];
	activeId: string | null;
	onSelectionChange: (ids: string[], activeId: string | null) => void;
};

export function ProfileMultiSelect({
	selectedIds,
	activeId,
	onSelectionChange,
}: Props) {
	const { t } = useTranslation('chat');
	const [open, setOpen] = useState(false);
	const profilesQuery = useProfilesQuery();
	const profiles = profilesQuery.data ?? [];

	const handleChange = useCallback(
		(ids: string[]) => {
			const nextActive =
				ids.length === 0
					? null
					: ids.includes(activeId ?? '')
						? activeId
						: ids[0];
			onSelectionChange(ids, nextActive);
		},
		[activeId, onSelectionChange],
	);

	const remove = useCallback(
		(id: string) => {
			const next = selectedIds.filter((x) => x !== id);
			const nextActive =
				next.length === 0
					? null
					: next.includes(activeId ?? '')
						? activeId
						: next[0];
			onSelectionChange(next, nextActive);
		},
		[selectedIds, activeId, onSelectionChange],
	);

	const setActive = useCallback(
		(id: string) => {
			if (selectedIds.includes(id)) {
				onSelectionChange(selectedIds, id);
			}
		},
		[selectedIds, onSelectionChange],
	);

	const selectedProfiles = profiles.filter((p) =>
		selectedIds.includes(p.id),
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex h-7 w-52 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs cursor-pointer hover:bg-accent transition-colors"
				>
					<span className="flex-1 truncate text-left">
						{selectedProfiles.length === 0 ? (
							<span className="text-muted-foreground">
								{t('selectProfile')}
							</span>
						) : (
							<span className="flex items-center gap-1 overflow-hidden">
								{selectedProfiles.slice(0, 2).map((p) => (
									<Badge
										key={p.id}
										variant={
											p.id === activeId
												? 'default'
												: 'secondary'
										}
										className="h-4 max-w-[70px] gap-0.5 px-1 text-[10px]"
									>
										<span className="truncate">
											{p.name}
										</span>
										{p.running && (
											<span className="inline-block size-1.5 rounded-full bg-green-500 shrink-0" />
										)}
										<X
											className="size-2.5 shrink-0 cursor-pointer opacity-60 hover:opacity-100"
											onClick={(e) => {
												e.stopPropagation();
												remove(p.id);
											}}
										/>
									</Badge>
								))}
								{selectedProfiles.length > 2 && (
									<span className="text-muted-foreground">
										+{selectedProfiles.length - 2}
									</span>
								)}
							</span>
						)}
					</span>
					<ChevronsUpDown className="size-3 shrink-0 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-3" align="start">
				<ProfileGroupSelector
					selectedIds={selectedIds}
					onChange={handleChange}
				/>
				{/* CDP 活跃环境选择 */}
				{selectedProfiles.length > 0 && (
					<div className="mt-2 border-t pt-2 space-y-1">
						<p className="text-[10px] text-muted-foreground">
							{t('setActiveCdp')}
						</p>
						<div className="flex flex-wrap gap-1">
							{selectedProfiles.map((p) => (
								<button
									key={p.id}
									type="button"
									className={cn(
										'rounded px-1.5 py-0.5 text-[10px] cursor-pointer',
										p.id === activeId
											? 'bg-primary text-primary-foreground'
											: 'bg-muted text-muted-foreground hover:bg-accent',
									)}
									onClick={() => setActive(p.id)}
								>
									{p.name}
								</button>
							))}
						</div>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
