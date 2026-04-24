import { useEffect, useState } from 'react';
import type { ProfilesPageProps } from '@/features/profile/model/page-types';
import { ProfileCreateForm } from '@/features/profile/ui/profile-create-form';
import { ProfileDetailPage } from '@/features/profile/ui/profile-detail-page';
import { ProfileListPage } from '@/features/profile/ui/profile-list-page';

export function ProfilesPage({
	profiles,
	groups,
	proxies,
	profileProxyBindings,
	resources,
	profileActionStates,
	onCreateProfile,
	onUpdateProfile,
	onUpdateProfileVisual,
	onOpenProfile,
	onCloseProfile,
	onSetProfileGroup,
	onFocusProfileWindow,
	onBatchOpenProfiles,
	onBatchCloseProfiles,
	onBatchSetProfileGroup,
	onDuplicateProfile,
	onDeleteProfile,
	onRestoreProfile,
	onReadProfileCookies,
	onExportProfileCookies,
	onRefreshProfiles,
	navigationIntent,
	onConsumeNavigationIntent,
	onNavigate,
}: ProfilesPageProps) {
	const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
	const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
	const [returnNav, setReturnNav] = useState<string | null>(null);

	useEffect(() => {
		if (!navigationIntent) {
			return;
		}
		setActiveProfileId(navigationIntent.profileId);
		setView(navigationIntent.view);
		setReturnNav(navigationIntent.returnNav ?? null);
		onConsumeNavigationIntent?.();
	}, [navigationIntent, onConsumeNavigationIntent]);

	useEffect(() => {
		if (view === 'list' || view === 'create' || !activeProfileId) {
			return;
		}
		if (profiles.some((item) => item.id === activeProfileId)) {
			return;
		}
		setActiveProfileId(null);
		setView('list');
	}, [activeProfileId, profiles, view]);

	const renderListPage = () => (
		<ProfileListPage
			profiles={profiles}
			groups={groups}
			proxies={proxies}
			profileProxyBindings={profileProxyBindings}
			profileActionStates={profileActionStates}
			onCreateClick={() => setView('create')}
			onViewProfile={(profileId) => {
				setActiveProfileId(profileId);
				setView('detail');
			}}
			onEditProfile={(profileId) => {
				setActiveProfileId(profileId);
				setView('edit');
			}}
			onUpdateProfileVisual={onUpdateProfileVisual}
			onOpenProfile={onOpenProfile}
			onCloseProfile={onCloseProfile}
			onSetProfileGroup={onSetProfileGroup}
			onFocusProfileWindow={onFocusProfileWindow}
			onBatchOpenProfiles={onBatchOpenProfiles}
			onBatchCloseProfiles={onBatchCloseProfiles}
			onBatchSetProfileGroup={onBatchSetProfileGroup}
			onDuplicateProfile={onDuplicateProfile}
			onDeleteProfile={onDeleteProfile}
			onRestoreProfile={onRestoreProfile}
			onReadProfileCookies={onReadProfileCookies}
			onExportProfileCookies={onExportProfileCookies}
			onRefreshProfiles={onRefreshProfiles}
		/>
	);

	if (view === 'create') {
		return (
			<ProfileCreateForm
				groups={groups}
				proxies={proxies}
				resources={resources}
				onSubmit={onCreateProfile}
				onBack={() => setView('list')}
			/>
		);
	}

	if (view === 'detail' && activeProfileId) {
		const profile = profiles.find((item) => item.id === activeProfileId);
		if (!profile) {
			return renderListPage();
		}
		return (
			<ProfileDetailPage
				profile={profile}
				resources={resources}
				boundProxy={proxies.find((item) => item.id === profileProxyBindings[profile.id])}
				onBack={() => {
					if (returnNav && onNavigate) {
						onNavigate(returnNav);
					} else {
						setView('list');
						setActiveProfileId(null);
					}
					setReturnNav(null);
				}}
				backLabel={returnNav ? '返回' : undefined}
				onEditProfile={(profileId) => {
					setActiveProfileId(profileId);
					setView('edit');
				}}
			/>
		);
	}

	if (view === 'edit' && activeProfileId) {
		const profile = profiles.find((item) => item.id === activeProfileId);
		if (!profile) {
			return renderListPage();
		}
		return (
			<ProfileCreateForm
				key={`edit-${profile.id}`}
				mode="edit"
				initialProfile={profile}
				initialProxyId={profileProxyBindings[profile.id]}
				groups={groups}
				proxies={proxies}
				resources={resources}
				onSubmit={(payload) => onUpdateProfile(profile.id, payload)}
				onBack={() => {
					setView('list');
					setActiveProfileId(null);
				}}
			/>
		);
	}

	return renderListPage();
}
