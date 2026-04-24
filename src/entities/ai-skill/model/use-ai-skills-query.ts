import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/shared/config/query-keys';
import { aiSkillApi } from '../api/ai-skill-api';

export function useAiSkillsQuery() {
	return useQuery({
		queryKey: queryKeys.aiSkills,
		queryFn: () => aiSkillApi.list(),
		staleTime: 0,
	});
}

export function useAiSkillQuery(slug: string | null) {
	return useQuery({
		queryKey: queryKeys.aiSkill(slug ?? ''),
		queryFn: () => aiSkillApi.read(slug ?? ''),
		enabled: !!slug,
	});
}
