import { useTranslation } from 'react-i18next';

import { useChatStore } from '@/store/chat-store';

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

function formatElapsed(ms: number): string {
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(1)}s`;
	return `${Math.floor(s / 60)}m${Math.floor(s % 60)}s`;
}

export function GenerationProgress() {
	const { t } = useTranslation('chat');
	const phase = useChatStore((s) => s.generationPhase);
	const toolName = useChatStore((s) => s.currentToolName);
	const round = useChatStore((s) => s.currentRound);
	const maxRounds = useChatStore((s) => s.maxRounds);
	const elapsedMs = useChatStore((s) => s.elapsedMs);
	const promptTokens = useChatStore((s) => s.promptTokens);
	const completionTokens = useChatStore((s) => s.completionTokens);

	if (phase === 'idle' || phase === 'done') return null;

	const totalTokens = promptTokens + completionTokens;
	const phaseText =
		phase === 'thinking'
			? t('thinking', 'Thinking')
			: toolName
				? `${t('executing', 'Executing')} ${toolName}`
				: t('toolCalling', 'Calling tools');

	return (
		<div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
			{/* 动画点 */}
			<span className="flex gap-0.5">
				<span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: '0ms' }} />
				<span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: '150ms' }} />
				<span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: '300ms' }} />
			</span>

			{/* 阶段描述 */}
			<span className="truncate">{phaseText}</span>

			{/* 分隔符 */}
			<span className="text-muted-foreground/40">·</span>

			{/* 轮次 */}
			{round > 0 && (
				<span className="tabular-nums whitespace-nowrap">
					Round {round}/{maxRounds}
				</span>
			)}

			{/* 耗时 */}
			{elapsedMs > 0 && (
				<>
					<span className="text-muted-foreground/40">·</span>
					<span className="tabular-nums whitespace-nowrap">{formatElapsed(elapsedMs)}</span>
				</>
			)}

			{/* Token统计 */}
			{totalTokens > 0 && (
				<>
					<span className="text-muted-foreground/40">·</span>
					<span className="tabular-nums whitespace-nowrap">{formatTokens(totalTokens)} tokens</span>
				</>
			)}
		</div>
	);
}
