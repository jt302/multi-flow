import { openUrl } from '@tauri-apps/plugin-opener';
import { memo, useContext, useMemo } from 'react';
import type { Components, Options as ReactMarkdownOptions } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { MarkdownCodeBlock } from './markdown-code-block';
import { MarkdownCtx, type MarkdownCtxValue } from './markdown-context';

// ── 模块级稳定引用（绝不移入组件内部）────────────────────────────────────────
// 每次引用变化都会触发 ReactMarkdown 重初始化整个 unified pipeline
const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS: NonNullable<ReactMarkdownOptions['rehypePlugins']> = [
	[rehypeHighlight, { detect: true, ignoreMissing: true }],
];

// ────────────────────────────────────────────────────────────────────────────
// 链接组件：用 tauri-opener 打开外链，降级到 window.open
// ────────────────────────────────────────────────────────────────────────────
function MdLink({ href, children, ...rest }: React.ComponentPropsWithoutRef<'a'>) {
	const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
		if (!href) return;
		e.preventDefault();
		openUrl(href).catch(() => {
			window.open(href, '_blank', 'noopener,noreferrer');
		});
	};
	return (
		<a
			{...rest}
			href={href}
			onClick={handleClick}
			target="_blank"
			rel="noopener noreferrer"
			className="text-primary underline underline-offset-2 hover:opacity-80 cursor-pointer"
		>
			{children}
		</a>
	);
}

// ────────────────────────────────────────────────────────────────────────────
// 代码块容器：区分 inline code 与 fenced block
// ────────────────────────────────────────────────────────────────────────────
function MdCode({ className, children, ...rest }: React.ComponentPropsWithoutRef<'code'>) {
	const isBlock = className?.startsWith('language-');
	if (isBlock) {
		// 块级代码由 MdPre 包裹，这里透传给 MarkdownCodeBlock
		return (
			<code className={className} {...rest}>
				{children}
			</code>
		);
	}
	// 行内代码
	return (
		<code
			className="rounded bg-muted px-1.5 py-0.5 text-[0.875em] font-mono text-foreground/90"
			{...rest}
		>
			{children}
		</code>
	);
}

// ────────────────────────────────────────────────────────────────────────────
// pre 容器：包裹 MarkdownCodeBlock
// ────────────────────────────────────────────────────────────────────────────
function MdPre({ children }: React.ComponentPropsWithoutRef<'pre'>) {
	// children 应为 <code className="language-xxx">
	const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
	const className = child?.props?.className;
	return <MarkdownCodeBlock className={className}>{child?.props?.children}</MarkdownCodeBlock>;
}

// ────────────────────────────────────────────────────────────────────────────
// 表格：外包 overflow-x-auto 容器
// ────────────────────────────────────────────────────────────────────────────
function MdTable({ children, ...rest }: React.ComponentPropsWithoutRef<'table'>) {
	// `[word-break:keep-all]` 阻止 CJK 字符在字符之间任意断行（中文/日文/韩文），
	// 否则当 LLM 生成"求解耗时 | 约 44 秒"这种短标签表格时，首列会被 auto-size 到
	// 很窄并强制把 "求解耗时" 拆成 "求解耗"+"时"。CJK 不断字 + 空格仍然允许换行，
	// 长英文段落不受影响。
	return (
		<div className="overflow-x-auto my-3">
			<table className="min-w-full text-sm [word-break:keep-all]" {...rest}>
				{children}
			</table>
		</div>
	);
}

// ────────────────────────────────────────────────────────────────────────────
// 表头单元格：禁止换行，保证 LLM 用作"label | value"风格表格时标签整体显示
// ────────────────────────────────────────────────────────────────────────────
function MdTh({ className, children, ...rest }: React.ComponentPropsWithoutRef<'th'>) {
	return (
		<th className={cn('whitespace-nowrap', className)} {...rest}>
			{children}
		</th>
	);
}

// ────────────────────────────────────────────────────────────────────────────
// 图片：连接 lightbox
// ────────────────────────────────────────────────────────────────────────────
function MdImage({ src, alt, ...rest }: React.ComponentPropsWithoutRef<'img'>) {
	const { onImageClick } = useContext(MarkdownCtx);
	return (
		<img
			{...rest}
			src={src}
			alt={alt}
			loading="lazy"
			decoding="async"
			className={cn('rounded-lg max-h-80 object-contain', onImageClick && 'cursor-zoom-in')}
			role={onImageClick ? 'button' : undefined}
			tabIndex={onImageClick ? 0 : undefined}
			onClick={() => src && onImageClick?.(src)}
			onKeyDown={(event) => {
				if (!src || !onImageClick) return;
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					onImageClick(src);
				}
			}}
		/>
	);
}

// ── 模块级 components map（稳定引用）─────────────────────────────────────────
const BASE_COMPONENTS: Components = {
	a: MdLink,
	code: MdCode,
	pre: MdPre,
	table: MdTable,
	th: MdTh,
	img: MdImage,
};

// ── Props ─────────────────────────────────────────────────────────────────────
type MarkdownRendererProps = {
	content: string;
	streaming?: boolean;
	onImageClick?: (src: string) => void;
	className?: string;
};

// ── 主组件 ────────────────────────────────────────────────────────────────────
export const MarkdownRenderer = memo(function MarkdownRenderer({
	content,
	streaming,
	onImageClick,
	className,
}: MarkdownRendererProps) {
	// 流式时补齐未闭合 code fence，避免 markdown 解析中途报错
	const displayText = useMemo(() => {
		if (!streaming) return content;
		const fences = (content.match(/^```|^~~~/gm) ?? []).length;
		return fences % 2 !== 0 ? `${content}\n\`\`\`` : content;
	}, [content, streaming]);

	// context value 稳定引用，仅在依赖变化时重建
	const ctx = useMemo<MarkdownCtxValue>(
		() => ({ onImageClick, streaming }),
		[onImageClick, streaming],
	);

	return (
		<MarkdownCtx.Provider value={ctx}>
			<div className={cn('prose prose-sm dark:prose-invert max-w-none break-words', className)}>
				<ReactMarkdown
					remarkPlugins={REMARK_PLUGINS}
					rehypePlugins={REHYPE_PLUGINS}
					components={BASE_COMPONENTS}
				>
					{displayText}
				</ReactMarkdown>
			</div>
		</MarkdownCtx.Provider>
	);
});
