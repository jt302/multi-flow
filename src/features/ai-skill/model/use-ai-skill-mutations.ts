import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiSkillApi } from '@/entities/ai-skill/api/ai-skill-api';
import { queryKeys } from '@/shared/config/query-keys';

export function useCreateAiSkill() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: aiSkillApi.create,
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiSkills }),
	});
}

export function useUpdateAiSkill() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ slug, payload }: { slug: string; payload: Parameters<typeof aiSkillApi.update>[1] }) =>
			aiSkillApi.update(slug, payload),
		onSuccess: (_, { slug }) => {
			qc.invalidateQueries({ queryKey: queryKeys.aiSkills });
			qc.invalidateQueries({ queryKey: queryKeys.aiSkill(slug) });
		},
	});
}

export function useDeleteAiSkill() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: aiSkillApi.delete,
		onSuccess: (_, slug) => {
			qc.invalidateQueries({ queryKey: queryKeys.aiSkills });
			qc.invalidateQueries({ queryKey: queryKeys.aiSkill(slug) });
		},
	});
}

export function useSetSessionSkills() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ sessionId, skillSlugs }: { sessionId: string; skillSlugs: string[] }) =>
			aiSkillApi.setSessionSkills(sessionId, skillSlugs),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.chatSessions }),
	});
}
