import { useReducer } from 'react';

import type { BatchProfileActionResponse } from '@/entities/profile/model/types';
import type { ProfileListFiltersState } from '@/entities/profile/lib/profile-list';

type QuickEditField = 'background' | 'toolbar';

type ProfileListPageState = {
	error: string | null;
	filters: ProfileListFiltersState;
	quickEdit: {
		profileId: string;
		field: QuickEditField;
	} | null;
	selectedProfileIds: string[];
	lastBatchOpenResult: BatchProfileActionResponse | null;
};

type ProfileListPageAction =
	| { type: 'set_error'; error: string | null }
	| { type: 'patch_filters'; patch: Partial<ProfileListFiltersState> }
	| { type: 'set_quick_edit'; quickEdit: ProfileListPageState['quickEdit'] }
	| { type: 'toggle_profile'; profileId: string; checked: boolean }
	| { type: 'set_selected_profiles'; profileIds: string[] }
	| { type: 'clear_selection' }
	| { type: 'set_batch_open_result'; result: BatchProfileActionResponse | null };

const initialState: ProfileListPageState = {
	error: null,
	filters: {
		keyword: '',
		groupFilter: 'all',
		runningFilter: 'all',
		lifecycleFilter: 'active',
	},
	quickEdit: null,
	selectedProfileIds: [],
	lastBatchOpenResult: null,
};

function reducer(state: ProfileListPageState, action: ProfileListPageAction): ProfileListPageState {
	switch (action.type) {
		case 'set_error':
			return { ...state, error: action.error };
		case 'patch_filters':
			return { ...state, filters: { ...state.filters, ...action.patch } };
		case 'set_quick_edit':
			return { ...state, quickEdit: action.quickEdit };
		case 'toggle_profile':
			return {
				...state,
				selectedProfileIds: action.checked
					? state.selectedProfileIds.includes(action.profileId)
						? state.selectedProfileIds
						: [...state.selectedProfileIds, action.profileId]
					: state.selectedProfileIds.filter((id) => id !== action.profileId),
			};
		case 'set_selected_profiles':
			return { ...state, selectedProfileIds: action.profileIds };
		case 'clear_selection':
			return { ...state, selectedProfileIds: [] };
		case 'set_batch_open_result':
			return { ...state, lastBatchOpenResult: action.result };
		default:
			return state;
	}
}

export function useProfileListState() {
	const [state, dispatch] = useReducer(reducer, initialState);

	return {
		state,
		setError: (error: string | null) => dispatch({ type: 'set_error', error }),
		patchFilters: (patch: Partial<ProfileListFiltersState>) => dispatch({ type: 'patch_filters', patch }),
		setQuickEdit: (quickEdit: ProfileListPageState['quickEdit']) => dispatch({ type: 'set_quick_edit', quickEdit }),
		toggleProfile: (profileId: string, checked: boolean) => dispatch({ type: 'toggle_profile', profileId, checked }),
		setSelectedProfiles: (profileIds: string[]) => dispatch({ type: 'set_selected_profiles', profileIds }),
		clearSelection: () => dispatch({ type: 'clear_selection' }),
		setBatchOpenResult: (result: BatchProfileActionResponse | null) => dispatch({ type: 'set_batch_open_result', result }),
	};
}
