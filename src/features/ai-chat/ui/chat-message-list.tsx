import { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatMessageRecord } from '@/entities/chat/model/types';
import { GenerationProgress } from './generation-progress';
import { ThinkingBlock } from './thinking-block';
import { ToolCallCard } from './tool-call-card';
import './chat-message-list-lightbox.css';

type Props = {
	messages: ChatMessageRecord[];
	isGenerating: boolean;
};

export function ChatMessageList({ messages, isGenerating }: Props) {
	const { t } = useTranslation('chat');
	const bottomRef = useRef<HTMLDivElement>(null);
	const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
	const slides = lightboxSrc ? [{ src: lightboxSrc, alt: t('imagePreview') }] : [];

	// 进入聊天时立即滚动到底部（instant，不抖动）
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'instant' });
	}, []);

	// 生成过程中新消息出现时平滑滚动
	useEffect(() => {
		if (messages.length > 0 || isGenerating) {
			bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
		}
	}, [messages.length, isGenerating]);

	const closeLightbox = () => {
		setLightboxSrc(null);
	};

	return (
		<>
			<ScrollArea className="flex-1 min-h-0">
				<div className="px-4 py-4 space-y-4 max-w-5xl mx-auto w-full">
					{messages.map((msg) => (
						<MessageItem key={msg.id} message={msg} onImageClick={setLightboxSrc} />
					))}
					{isGenerating && <GenerationProgress />}
					<div ref={bottomRef} />
				</div>
			</ScrollArea>

			<Lightbox
				open={!!lightboxSrc}
				close={closeLightbox}
				slides={slides}
				index={0}
				plugins={[Zoom]}
				className="ai-chat-lightbox"
				controller={{ closeOnBackdropClick: true }}
				carousel={{ finite: slides.length <= 1, padding: '64px', spacing: '10%', imageFit: 'contain' }}
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
					container: {
						'--yarl__color_backdrop': 'rgba(15, 23, 42, 0.68)',
					},
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
					icon: {
						'--yarl__icon_size': '18px',
					},
				}}
				render={{
					buttonZoom: () => null,
					buttonPrev: slides.length <= 1 ? () => null : undefined,
					buttonNext: slides.length <= 1 ? () => null : undefined,
					iconClose: () => <X className="size-[18px]" strokeWidth={2.25} />,
				}}
			/>
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
			onClick={handleCopy}
			title={t('copyMessage')}
			className={`cursor-pointer p-1 rounded hover:bg-accent transition-colors ${className ?? ''}`}
		>
			{copied
				? <Check className="size-3.5 text-green-500" />
				: <Copy className="size-3.5 text-muted-foreground" />
			}
		</button>
	);
}

function MessageItem({ message, onImageClick }: { message: ChatMessageRecord; onImageClick: (src: string) => void }) {
	if (message.role === 'user') {
		return (
			<div className="flex justify-end items-end gap-1 group">
				{message.contentText && (
					<CopyButton
						text={message.contentText}
						className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mb-0.5"
					/>
				)}
				<div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground break-words whitespace-pre-wrap space-y-2">
					{message.imageBase64 && (
						<img
							src={message.imageBase64.startsWith('data:') ? message.imageBase64 : `data:image/png;base64,${message.imageBase64}`}
							alt="user upload"
							className="max-w-full rounded-lg object-contain max-h-64 cursor-pointer"
							loading="lazy"
							decoding="async"
							onClick={() => onImageClick(message.imageBase64!.startsWith('data:') ? message.imageBase64! : `data:image/png;base64,${message.imageBase64}`)}
						/>
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
			const calls = JSON.parse(message.toolCallsJson) as Array<{ function?: { name?: string }; name?: string }>;
			toolNames = calls.map((c) => c.function?.name ?? c.name ?? '').filter(Boolean);
		} catch {
			// ignore
		}
		return (
			<div className="flex justify-start">
				<div className="text-xs text-muted-foreground/60 italic px-1">
					{toolNames.length > 0 ? toolNames.join(', ') : '调用工具中...'}
				</div>
			</div>
		);
	}

	if (message.role === 'assistant' && message.contentText) {
		return (
			<div className="flex flex-col justify-start gap-1 group">
				{message.thinkingText && (
					<ThinkingBlock
						thinkingText={message.thinkingText}
						thinkingTokens={message.thinkingTokens ?? undefined}
					/>
				)}
				<div className="flex items-end gap-1">
					{/* 外层 div 控制最大宽度，内层 div 负责 prose 排版，两者不冲突 */}
					<div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm break-words">
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{message.contentText}
							</ReactMarkdown>
						</div>
					</div>
					<CopyButton
						text={message.contentText}
						className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mb-0.5"
					/>
				</div>
			</div>
		);
	}

	if (message.role === 'system' && message.contentText) {
		return (
			<div className="text-center text-xs text-muted-foreground py-1">
				{message.contentText}
			</div>
		);
	}

	return null;
}
