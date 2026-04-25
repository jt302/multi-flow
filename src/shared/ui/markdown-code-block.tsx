import { Check, Copy } from 'lucide-react';
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MarkdownCtx } from './markdown-context';

type Props = {
	children?: React.ReactNode;
	className?: string;
};

function extractLang(className?: string): string {
	const match = className?.match(/language-(\S+)/);
	return match ? match[1] : '';
}

function extractText(node: React.ReactNode): string {
	if (typeof node === 'string') return node;
	if (typeof node === 'number') return String(node);
	if (!node) return '';
	if (Array.isArray(node)) return node.map(extractText).join('');
	if (node !== null && typeof node === 'object' && 'props' in node) {
		return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
	}
	return '';
}

export function MarkdownCodeBlock({ children, className }: Props) {
	const { t } = useTranslation('chat');
	const { streaming } = useContext(MarkdownCtx);
	const [copied, setCopied] = useState(false);

	const lang = extractLang(className);

	// 缓存代码文本，避免每个 token 重算
	const codeText = useMemo(() => extractText(children), [children]);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(codeText);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="relative my-3 rounded-lg overflow-hidden border border-border/50 bg-zinc-950 dark:bg-zinc-900">
			{/* 顶部语言标签栏 */}
			<div className="flex items-center justify-between px-4 py-1.5 bg-zinc-900/80 dark:bg-zinc-800/60 border-b border-white/8">
				<span className="text-xs text-zinc-400 font-mono select-none">{lang || 'text'}</span>
				{!streaming && (
					<button
						type="button"
						onClick={handleCopy}
						title={t('copyCode')}
						className={cn(
							'cursor-pointer flex items-center gap-1 text-xs px-2 py-0.5 rounded',
							'text-zinc-400 hover:text-zinc-200 hover:bg-white/8 transition-colors',
						)}
					>
						{copied ? (
							<>
								<Check className="size-3 text-green-400" />
								{t('codeCopied')}
							</>
						) : (
							<>
								<Copy className="size-3" />
								{t('copyCode')}
							</>
						)}
					</button>
				)}
			</div>
			{/* 代码区域 */}
			<div className="overflow-x-auto">
				<code
					className={cn(
						'block px-4 py-3 text-xs leading-relaxed font-mono text-zinc-100',
						className,
					)}
				>
					{children}
				</code>
			</div>
		</div>
	);
}
