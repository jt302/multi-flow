import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fsWorkspaceApi } from '@/entities/fs-workspace/api/fs-workspace-api';
import type { FsWhitelistEntry } from '@/entities/fs-workspace/model/types';
import { queryKeys } from '@/shared/config/query-keys';

export function useCreateFolder() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ rootId, relPath }: { rootId: string; relPath: string }) =>
			fsWorkspaceApi.createFolder(rootId, relPath),
		onSuccess: (_data, { rootId, relPath }) => {
			const parent = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '.';
			qc.invalidateQueries({ queryKey: queryKeys.fsDir(rootId, parent) });
			qc.invalidateQueries({ queryKey: queryKeys.fsRoots });
		},
	});
}

export function useDeleteEntry() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ rootId, relPath }: { rootId: string; relPath: string }) =>
			fsWorkspaceApi.deleteEntry(rootId, relPath),
		onSuccess: (_data, { rootId, relPath }) => {
			const parent = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '.';
			qc.invalidateQueries({ queryKey: queryKeys.fsDir(rootId, parent) });
		},
	});
}

export function useSaveDescription() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ rootId, relPath, text }: { rootId: string; relPath: string; text: string }) =>
			fsWorkspaceApi.saveDescription(rootId, relPath, text),
		onSuccess: (_data, { rootId, relPath }) => {
			qc.invalidateQueries({ queryKey: [...queryKeys.fsDir(rootId, relPath), 'description'] });
			const parent = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '.';
			qc.invalidateQueries({ queryKey: queryKeys.fsDir(rootId, parent) });
		},
	});
}

export function useAddWhitelistEntry() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (entry: FsWhitelistEntry) => fsWorkspaceApi.addWhitelistEntry(entry),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fsRoots }),
	});
}

export function useRemoveWhitelistEntry() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => fsWorkspaceApi.removeWhitelistEntry(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fsRoots }),
	});
}

export function useUpdateWhitelistEntry() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (entry: FsWhitelistEntry) => fsWorkspaceApi.updateWhitelistEntry(entry),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fsRoots }),
	});
}
