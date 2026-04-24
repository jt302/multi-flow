import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type { FsEntry, FsRoot, FsWhitelistEntry } from '../model/types';

export const fsWorkspaceApi = {
	listRoots: () => tauriInvoke<FsRoot[]>('fs_list_roots'),
	listDir: (rootId: string, relPath: string) =>
		tauriInvoke<FsEntry[]>('fs_list_dir', { rootId, relPath }),
	createFolder: (rootId: string, relPath: string) =>
		tauriInvoke<void>('fs_create_folder', { rootId, relPath }),
	deleteEntry: (rootId: string, relPath: string) =>
		tauriInvoke<void>('fs_delete_entry', { rootId, relPath }),
	readDescription: (rootId: string, relPath: string) =>
		tauriInvoke<string | null>('fs_read_description', { rootId, relPath }),
	saveDescription: (rootId: string, relPath: string, text: string) =>
		tauriInvoke<void>('fs_save_description', { rootId, relPath, text }),
	getSandboxRoot: () => tauriInvoke<string | null>('fs_get_sandbox_root'),
	setSandboxRoot: (path: string | null) => tauriInvoke<void>('fs_set_sandbox_root', { path }),
	getWhitelist: () => tauriInvoke<FsWhitelistEntry[]>('fs_get_whitelist'),
	addWhitelistEntry: (entry: FsWhitelistEntry) =>
		tauriInvoke<void>('fs_add_whitelist_entry', { entry }),
	updateWhitelistEntry: (entry: FsWhitelistEntry) =>
		tauriInvoke<void>('fs_update_whitelist_entry', { entry }),
	removeWhitelistEntry: (id: string) => tauriInvoke<void>('fs_remove_whitelist_entry', { id }),
};
