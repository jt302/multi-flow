import {
	Checkbox,
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui';
import type { GroupItem } from '@/entities/group/model/types';
import type {
	ExportProfileCookiesPayload,
	ExportProfileCookiesResponse,
	ProfileActionState,
	ProfileItem,
	ReadProfileCookiesResponse,
} from '@/entities/profile/model/types';
import type { ProxyItem } from '@/entities/proxy/model/types';
import type { ResourceItem } from '@/entities/resource/model/types';
import { ProfileListItem } from './profile-list-item';
import type {
	QuickEditField,
	ProfileListQuickEditState,
} from '@/store/profile-list-store';

type ProfileListTableProps = {
	profiles: ProfileItem[];
	groups: GroupItem[];
	resources: ResourceItem[];
	profileActionStates: Record<string, ProfileActionState>;
	profileProxyBindings: Record<string, string | undefined>;
	proxyById: Record<string, ProxyItem>;
	selectedProfileIds: string[];
	filteredActiveIds: string[];
	filteredSelectionIndeterminate: boolean;
	allFilteredSelected: boolean;
	quickEdit: ProfileListQuickEditState;
	onSetSelectedProfiles: (profileIds: string[]) => void;
	onClearSelection: () => void;
	onToggleProfile: (profileId: string, checked: boolean) => void;
	onQuickEditChange: (
		value: { profileId: string; field: QuickEditField } | null,
	) => void;
	onViewProfile: (profileId: string) => void;
	onEditProfile: (profileId: string) => void;
	onUpdateProfileVisual: (
		profileId: string,
		payload: { browserBgColor?: string; toolbarText?: string },
	) => Promise<void>;
	onOpenProfile: (profileId: string) => Promise<void>;
	onCloseProfile: (profileId: string) => Promise<void>;
	onSetProfileGroup: (profileId: string, groupName?: string) => Promise<void>;
	onFocusProfileWindow: (profileId: string) => Promise<void>;
	onDeleteProfile: (profileId: string) => Promise<void>;
	onRestoreProfile: (profileId: string) => Promise<void>;
	onReadProfileCookies: (profileId: string) => Promise<ReadProfileCookiesResponse>;
	onExportProfileCookies: (
		profileId: string,
		payload: ExportProfileCookiesPayload,
	) => Promise<ExportProfileCookiesResponse>;
	onRunAction: (action: () => Promise<void>) => Promise<void>;
	onErrorReset: () => void;
};

export function ProfileListTable({
	profiles,
	groups,
	resources,
	profileActionStates,
	profileProxyBindings,
	proxyById,
	selectedProfileIds,
	filteredActiveIds,
	filteredSelectionIndeterminate,
	allFilteredSelected,
	quickEdit,
	onSetSelectedProfiles,
	onClearSelection,
	onToggleProfile,
	onQuickEditChange,
	onViewProfile,
	onEditProfile,
	onUpdateProfileVisual,
	onOpenProfile,
	onCloseProfile,
	onSetProfileGroup,
	onFocusProfileWindow,
	onDeleteProfile,
	onRestoreProfile,
	onReadProfileCookies,
	onExportProfileCookies,
	onRunAction,
	onErrorReset,
}: ProfileListTableProps) {
	return (
		<div className="overflow-hidden rounded-xl border border-border/70">
			{profiles.length === 0 ? (
				<div className="px-4 py-10 text-center text-sm text-muted-foreground">
					没有匹配当前筛选条件的环境。
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/15 hover:bg-muted/15">
							<TableHead className="w-[86px]">
								<div className="grid grid-cols-[1rem_2.25rem] items-center justify-center gap-2">
									<Checkbox
										checked={
											filteredSelectionIndeterminate
												? 'indeterminate'
												: allFilteredSelected
										}
										disabled={filteredActiveIds.length === 0}
										onCheckedChange={(checked) => {
											if (checked === true) {
												onSetSelectedProfiles(filteredActiveIds);
												return;
											}
											onClearSelection();
										}}
									/>
									<span aria-hidden="true" className="h-9 w-9" />
								</div>
							</TableHead>
							<TableHead>环境</TableHead>
							<TableHead>备注 / 版本</TableHead>
							<TableHead>设备</TableHead>
							<TableHead>代理信息</TableHead>
							<TableHead className="w-[140px]">运行状态</TableHead>
							<TableHead className="w-[130px] text-right">操作</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{profiles.map((item, index) => {
							const boundProxyId = profileProxyBindings[item.id];
							const boundProxy = boundProxyId
								? proxyById[boundProxyId]
								: undefined;
							return (
								<ProfileListItem
									key={item.id}
									item={item}
									groups={groups}
									resources={resources}
									index={index}
									total={profiles.length}
									selected={selectedProfileIds.includes(item.id)}
									onSelectedChange={(checked) =>
										onToggleProfile(item.id, checked)
									}
									actionState={profileActionStates[item.id]}
									boundProxy={boundProxy}
									quickEdit={quickEdit}
									onQuickEditChange={(value) => {
										onQuickEditChange(value);
										onErrorReset();
									}}
									onRunAction={onRunAction}
									onViewProfile={onViewProfile}
									onCreateClick={onEditProfile}
									onUpdateProfileVisual={onUpdateProfileVisual}
									onOpenProfile={onOpenProfile}
									onCloseProfile={onCloseProfile}
									onSetProfileGroup={onSetProfileGroup}
									onFocusProfileWindow={onFocusProfileWindow}
									onDeleteProfile={onDeleteProfile}
									onRestoreProfile={onRestoreProfile}
									onReadProfileCookies={onReadProfileCookies}
									onExportProfileCookies={onExportProfileCookies}
								/>
							);
						})}
					</TableBody>
				</Table>
			)}
		</div>
	);
}
