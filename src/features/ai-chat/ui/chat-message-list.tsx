import { Check, Copy, StopCircle, TriangleAlert, X } from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

import { useTranslation } from 'react-i18next';
import type { ChatMessageRecord } from '@/entities/chat/model/types';
import { MarkdownRenderer } from '@/shared/ui/markdown-renderer';
import type { TerminalState } from '@/store/chat-store';
import { GenerationProgress } from './generation-progress';
import { ThinkingBlock } from './thinking-block';
import { ToolCallCard } from './tool-call-card';
import './chat-message-list-lightbox.css';

type Props = {
	messages: ChatMessageRecord[];
	isGenerating: boolean;
	terminalState?: TerminalState;
	terminalError?: string | null;
	sessionId?: string | null;
	onContinue?: () => void;
};

export function ChatMessageList({
	messages,
	isGenerating,
	terminalState,
	terminalError,
	onContinue,
}: Props) {
	const { t } = useTranslation('chat');
	const virtuosoRef = useRef<VirtuosoHandle>(null);
	const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

	// Lightbox 数据和组件只在 lightboxSrc 变化时重建
	const slides = useMemo(
		() => (lightboxSrc ? [{ src: lightboxSrc, alt: t('imagePreview') }] : []),
		[lightboxSrc, t],
	);
	const lightboxEl = useMemo(
		() => (
			<Lightbox
				open={!!lightboxSrc}
				close={() => setLightboxSrc(null)}
				slides={slides}
				index={0}
				plugins={[Zoom]}
				className="ai-chat-lightbox"
				controller={{ closeOnBackdropClick: true }}
				carousel={{
					finite: slides.length <= 1,
					padding: '64px',
					spacing: '10%',
					imageFit: 'contain',
				}}
				toolbar={{ buttons: ['close'] }}
				zoom={{ maxZoomPixelRatio: 3, doubleClickMaxStops: 4, scrollToZoom: true }}
				labels={{
					Close: t('closePreview'),
					Lightbox: t('imagePreview'),
					Carousel: t('imagePreview'),
					Slide: t('imagePreview'),
					'Photo gallery': t('imagePreview'),
					'Zoom in': t('zoomInPreview'),
					'Zoom out': t('zoomOutPreview'),
				}}
				styles={{
					container: { '--yarl__color_backdrop': 'rgba(15, 23, 42, 0.68)' },
					toolbar: {
						'--yarl__button_filter': 'none',
						'--yarl__toolbar_padding': '12px',
					},
					button: {
						'--yarl__button_background_color': 'rgba(255, 255, 255, 0.94)',
						'--yarl__button_border': '1px solid rgba(148, 163, 184, 0.28)',
						'--yarl__button_filter': 'none',
						'--yarl__button_padding': '6px',
						color: '#0f172a',
					},
					icon: { '--yarl__icon_size': '18px' },
				}}
				render={{
					buttonZoom: () => null,
					buttonPrev: slides.length <= 1 ? () => null : undefined,
					buttonNext: slides.length <= 1 ? () => null : undefined,
					iconClose: () => <X className="size-[18px]" strokeWidth={2.25} />,
				}}
			/>
		),
		[lightboxSrc, slides, t],
	);

	return (
		<>
			<Virtuoso
				ref={virtuosoRef}
				className="flex-1 min-h-0"
				data={messages}
				initialTopMostItemIndex={Math.max(0, messages.length - 1)}
				// followOutput: 仅当用户已在底部附近时才自动跟随新内容，不打断向上滚动查看历史
				followOutput={isGenerating ? 'auto' : false}
				atBottomThreshold={120}
				itemContent={(_, msg) => (
					<div className="px-4 py-2 max-w-5xl mx-auto w-full">
						<MessageItem key={msg.id} message={msg} onImageClick={setLightboxSrc} />
					</div>
				)}
				components={{
					Header: () => <div className="h-2" />,
					Footer: () =>
						isGenerating ? (
							<div className="px-4 pb-2 max-w-5xl mx-auto w-full">
								<GenerationProgress />
							</div>
						) : terminalState && terminalState !== 'success' ? (
							<div className="px-4 pb-3 max-w-5xl mx-auto w-full">
								<TerminalNotice
									state={terminalState}
									error={terminalError}
									onContinue={onContinue}
								/>
							</div>
						) : (
							<div className="h-2" />
						),
				}}
			/>
			{lightboxEl}
		</>
	);
}

function CopyButton({ text, className }: { text: string; className?: string }) {
	const { t } = useTranslation('chat');
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			title={t('copyMessage')}
			className={`cursor-pointer p-1 rounded hover:bg-accent transition-colors ${className ?? ''}`}
		>
			{copied ? (
				<Check className="size-3.5 text-green-500" />
			) : (
				<Copy className="size-3.5 text-muted-foreground" />
			)}
		</button>
	);
}

// React.memo 确保历史消息在流式期间不重渲：appendTextChunk 只替换流式那一条，
// 其他消息对象引用不变，浅比较可以正确跳过。
// 注意：onImageClick 必须是稳定引用（useState setter），否则 memo 会失效。
const MessageItem = memo(function MessageItem({
	message,
	onImageClick,
}: {
	message: ChatMessageRecord;
	onImageClick: (src: string) => void;
}) {
	const { t } = useTranslation('chat');
	if (message.role === 'user') {
		const imageSrc = message.imageBase64
			? message.imageBase64.startsWith('data:')
				? message.imageBase64
				: `data:image/png;base64,${message.imageBase64}`
			: null;
		return (
			<div className="flex justify-end items-end gap-1 group">
				{message.contentText && (
					<CopyButton
						text={message.contentText}
						className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mb-0.5"
					/>
				)}
				<div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground break-words whitespace-pre-wrap space-y-2">
					{imageSrc && (
						<button
							type="button"
							className="block max-w-full cursor-pointer"
							onClick={() => onImageClick(imageSrc)}
						>
							<img
								src={imageSrc}
								alt="user upload"
								className="max-h-64 max-w-full rounded-lg object-contain"
								loading="lazy"
								decoding="async"
							/>
						</button>
					)}
					{message.contentText && <span>{message.contentText}</span>}
				</div>
			</div>
		);
	}

	if (message.role === 'tool') {
		return (
			<div className="max-w-[90%]">
				<ToolCallCard message={message} onImageClick={onImageClick} />
			</div>
		);
	}

	if (message.role === 'assistant' && !message.contentText && message.toolCallsJson) {
		// assistant 消息只有 tool_calls 没有文本时，显示紧凑占位行
		let toolNames: string[] = [];
		try {
			const calls = JSON.parse(message.toolCallsJson) as Array<{
				function?: { name?: string };
				name?: string;
			}>;
			toolNames = calls.map((c) => c.function?.name ?? c.name ?? '').filter(Boolean);
		} catch {
			// ignore
		}
		return (
			<div className="flex justify-start">
				<div className="text-xs text-muted-foreground/60 italic px-1">
					{toolNames.length > 0 ? toolNames.join(', ') : t('toolCallingFallback')}
				</div>
			</div>
		);
	}

	if (message.role === 'assistant' && (message.contentText || message.status === 'streaming')) {
		const isStreaming = message.status === 'streaming';
		const displayText = message.contentText ?? '';
		// 正在流式但尚无内容时，显示 loading 三点动画而非空气泡
		if (isStreaming && !displayText) {
			return (
				<div className="flex justify-start px-1 py-1">
					<span className="inline-flex gap-1 items-center">
						<span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
						<span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
						<span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
					</span>
				</div>
			);
		}
		return (
			<div className="flex flex-col justify-start gap-1 group">
				{message.thinkingText && (
					<ThinkingBlock
						thinkingText={message.thinkingText}
						thinkingTokens={message.thinkingTokens ?? undefined}
					/>
				)}
				{/* 流式工具占位 */}
				{isStreaming && message.streamingToolNames && message.streamingToolNames.length > 0 && (
					<div className="text-xs text-muted-foreground/60 italic px-1">
						{message.streamingToolNames.map((n) => t('toolCallPending', { name: n })).join(' · ')}
					</div>
				)}
				<div className="flex items-start gap-2 w-full">
					<div className="min-w-0 flex-1 text-sm text-foreground">
						<MarkdownRenderer
							content={displayText}
							streaming={isStreaming}
							onImageClick={onImageClick}
						/>
						{isStreaming && (
							<span className="inline-block w-0.5 h-4 bg-foreground/70 animate-pulse ml-0.5 align-middle" />
						)}
					</div>
					{!isStreaming && message.contentText && (
						<CopyButton
							text={message.contentText}
							className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
						/>
					)}
				</div>
			</div>
		);
	}

	if (message.role === 'system' && message.contentText) {
		return (
			<div className="text-center text-xs text-muted-foreground py-1">{message.contentText}</div>
		);
	}

	return null;
});

function TerminalNotice({
	state,
	error,
	onContinue,
}: {
	state: TerminalState;
	error?: string | null;
	onContinue?: () => void;
}) {
	const { t } = useTranslation('chat');

	if (state === 'stalled' || state === 'max_rounds') {
		const title = state === 'stalled' ? t('terminal.stalled.title') : t('terminal.maxRounds.title');
		const desc =
			state === 'stalled' ? t('terminal.stalled.description') : t('terminal.maxRounds.description');
		return (
			<div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm dark:border-yellow-900/50 dark:bg-yellow-950/30">
				<TriangleAlert className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
				<div className="min-w-0 flex-1">
					<p className="font-medium text-yellow-800 dark:text-yellow-300">{title}</p>
					<p className="mt-0.5 text-yellow-700 dark:text-yellow-400/80">{desc}</p>
				</div>
				{onContinue && (
					<button
						type="button"
						onClick={onContinue}
						className="cursor-pointer shrink-0 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-200 transition-colors dark:border-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 dark:hover:bg-yellow-900"
					>
						{t('terminal.continue')}
					</button>
				)}
			</div>
		);
	}

	if (state === 'error') {
		return (
			<div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-900/50 dark:bg-red-950/30">
				<StopCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
				<div className="min-w-0 flex-1">
					<p className="font-medium text-red-800 dark:text-red-300">{t('terminal.error.title')}</p>
					{error && <p className="mt-0.5 text-red-700 dark:text-red-400/80 break-words">{error}</p>}
				</div>
				{onContinue && (
					<button
						type="button"
						onClick={onContinue}
						className="cursor-pointer shrink-0 rounded-md border border-red-300 bg-red-100 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-200 transition-colors dark:border-red-800 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
					>
						{t('terminal.retry')}
					</button>
				)}
			</div>
		);
	}

	return null;
}
