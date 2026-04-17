import { tauriInvoke } from '@/shared/api/tauri-invoke';
import type {
	AiSkillFull,
	AiSkillMeta,
	CreateSkillRequest,
	InstallSkillRequest,
	InstallSkillResult,
	UpdateSkillRequest,
} from '../model/types';

export const aiSkillApi = {
	list: () => tauriInvoke<AiSkillMeta[]>('list_ai_skills'),
	read: (slug: string) => tauriInvoke<AiSkillFull>('read_ai_skill', { slug }),
	create: (payload: CreateSkillRequest) => tauriInvoke<AiSkillFull>('create_ai_skill', { payload }),
	update: (slug: string, payload: UpdateSkillRequest) =>
		tauriInvoke<AiSkillFull>('update_ai_skill', { slug, payload }),
	delete: (slug: string) => tauriInvoke<void>('delete_ai_skill', { slug }),
	install: (payload: InstallSkillRequest) =>
		tauriInvoke<InstallSkillResult>('install_ai_skill', { payload }),
	setSessionSkills: (sessionId: string, skillSlugs: string[]) =>
		tauriInvoke<void>('set_session_skills', { sessionId, skillSlugs }),
};
