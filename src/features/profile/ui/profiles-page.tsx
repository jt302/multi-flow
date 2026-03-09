import { useEffect, useState } from 'react';

import { ProfileCreateForm } from '@/features/profile/create-profile/ui/profile-create-form';
import { ProfileDetailPage } from '@/features/profile/detail/ui/profile-detail-page';
import { ProfileListPage } from '@/features/profile/list/ui/profile-list-page';
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
	onBatchOpenProfiles,
	onBatchCloseProfiles,
	onDeleteProfile,
	onRestoreProfile,
	onRefreshProfiles,
	navigationIntent,
	onConsumeNavigationIntent,
}: ProfilesPageProps) {
	const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
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
			return (
				<ProfileListPage
					profiles={profiles}
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
					onBatchOpenProfiles={onBatchOpenProfiles}
					onBatchCloseProfiles={onBatchCloseProfiles}
					onDeleteProfile={onDeleteProfile}
					onRestoreProfile={onRestoreProfile}
					onRefreshProfiles={onRefreshProfiles}
				/>
			);
		}
		return (
			<ProfileDetailPage
				profile={profile}
				resources={resources}
				boundProxy={proxies.find((item) => item.id === profileProxyBindings[profile.id])}
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
			return (
				<ProfileListPage
					profiles={profiles}
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
					onBatchOpenProfiles={onBatchOpenProfiles}
					onBatchCloseProfiles={onBatchCloseProfiles}
					onDeleteProfile={onDeleteProfile}
					onRestoreProfile={onRestoreProfile}
					onRefreshProfiles={onRefreshProfiles}
				/>
			);
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

	return (
		<ProfileListPage
			profiles={profiles}
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
			onBatchOpenProfiles={onBatchOpenProfiles}
			onBatchCloseProfiles={onBatchCloseProfiles}
			onDeleteProfile={onDeleteProfile}
			onRestoreProfile={onRestoreProfile}
			onRefreshProfiles={onRefreshProfiles}
		/>
	);
}
