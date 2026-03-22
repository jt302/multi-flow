import { useEffect, useState } from 'react';

import { ProfileCreateForm } from '@/features/profile/ui/profile-create-form';
import { ProfileDetailPage } from '@/features/profile/ui/profile-detail-page';
import { ProfileListPage } from '@/features/profile/ui/profile-list-page';
import type { ProfilesPageProps } from '@/features/profile/model/page-types';

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
	onDeleteProfile,
	onRestoreProfile,
	onReadProfileCookies,
	onExportProfileCookies,
	onRefreshProfiles,
	navigationIntent,
	onConsumeNavigationIntent,
}: ProfilesPageProps) {
	const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail'>(
		'list',
	);
	const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

	useEffect(() => {
		if (!navigationIntent) {
			return;
		}
		setActiveProfileId(navigationIntent.profileId);
		setView(navigationIntent.view);
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
			resources={resources}
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
				boundProxy={proxies.find(
					(item) => item.id === profileProxyBindings[profile.id],
				)}
				onBack={() => {
					setView('list');
					setActiveProfileId(null);
				}}
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
