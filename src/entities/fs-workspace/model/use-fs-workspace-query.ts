import { useQuery } from '@tanstack/react-query';
import { fsWorkspaceApi } from '../api/fs-workspace-api';
import { queryKeys } from '@/shared/config/query-keys';

export function useFsRootsQuery() {
	return useQuery({
		queryKey: queryKeys.fsRoots,
		queryFn: fsWorkspaceApi.listRoots,
	});
}

export function useFsDirQuery(rootId: string, relPath: string) {
	return useQuery({
		queryKey: queryKeys.fsDir(rootId, relPath),
		queryFn: () => fsWorkspaceApi.listDir(rootId, relPath),
		enabled: !!rootId,
	});
}

export function useFsDescriptionQuery(rootId: string, relPath: string, enabled: boolean) {
	return useQuery({
		queryKey: [...queryKeys.fsDir(rootId, relPath), 'description'],
		queryFn: () => fsWorkspaceApi.readDescription(rootId, relPath),
		enabled: enabled && !!rootId,
	});
}
