import { Brain, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

type ThinkingBlockProps = {
	thinkingText: string;
	thinkingTokens?: number;
	defaultOpen?: boolean;
};

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

export function ThinkingBlock({ thinkingText, thinkingTokens, defaultOpen = false }: ThinkingBlockProps) {
	const [open, setOpen] = useState(defaultOpen);

	if (!thinkingText) return null;

	return (
		<div className="my-2 rounded-md border border-dashed border-muted-foreground/30">
			<button
				type="button"
				className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
				onClick={() => setOpen(!open)}
			>
				<Brain className="h-3.5 w-3.5 shrink-0" />
				<span className="font-medium">Thinking</span>
				{thinkingTokens != null && thinkingTokens > 0 && (
					<span className="text-muted-foreground/60">({formatTokens(thinkingTokens)} tokens)</span>
				)}
				<ChevronDown
					className={cn(
						'ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200',
						open && 'rotate-180',
					)}
				/>
			</button>
			{open && (
				<div className="max-h-[200px] overflow-auto border-t border-dashed border-muted-foreground/30 px-3 py-2">
					<pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
						{thinkingText}
					</pre>
				</div>
			)}
		</div>
	);
}
