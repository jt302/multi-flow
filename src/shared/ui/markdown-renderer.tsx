import { createContext, memo, useContext, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';
import { MarkdownCodeBlock } from './markdown-code-block';

// ── Context ──────────────────────────────────────────────────────────────────
// 通过 context 透传，避免把闭包写入 components map 导致 ReactMarkdown 管道重建
export type MarkdownCtxValue = {
	onImageClick?: (src: string) => void;
	streaming?: boolean;
};
export const MarkdownCtx = createContext<MarkdownCtxValue>({});

// ── 模块级稳定引用（绝不移入组件内部）────────────────────────────────────────
// 每次引用变化都会触发 ReactMarkdown 重初始化整个 unified pipeline
const REMARK_PLUGINS = [remarkGfm];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REHYPE_PLUGINS: any[] = [[rehypeHighlight, { detect: true, ignoreMissing: true }]];

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
	return (
		<MarkdownCodeBlock className={className}>
			{child?.props?.children}
		</MarkdownCodeBlock>
	);
}

// ────────────────────────────────────────────────────────────────────────────
// 表格：外包 overflow-x-auto 容器
// ────────────────────────────────────────────────────────────────────────────
function MdTable({ children, ...rest }: React.ComponentPropsWithoutRef<'table'>) {
	return (
		<div className="overflow-x-auto my-3">
			<table className="min-w-full text-sm" {...rest}>
				{children}
			</table>
		</div>
	);
}

// ────────────────────────────────────────────────────────────────────────────
// 图片：连接 lightbox
// ────────────────────────────────────────────────────────────────────────────
function MdImage({ src, alt, ...rest }: React.ComponentPropsWithoutRef<'img'>) {
	const { onImageClick } = useContext(MarkdownCtx);
	return (
		// eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
		<img
			{...rest}
			src={src}
			alt={alt}
			loading="lazy"
			decoding="async"
			className={cn(
				'rounded-lg max-h-80 object-contain',
				onImageClick && 'cursor-zoom-in',
			)}
			onClick={() => src && onImageClick?.(src)}
		/>
	);
}

// ── 模块级 components map（稳定引用）─────────────────────────────────────────
const BASE_COMPONENTS: Components = {
	a: MdLink,
	code: MdCode,
	pre: MdPre,
	table: MdTable,
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
		return fences % 2 !== 0 ? content + '\n```' : content;
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
