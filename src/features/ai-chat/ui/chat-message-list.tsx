import { useEffect, useRef, useState } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatMessageRecord } from '@/entities/chat/model/types';
import { GenerationProgress } from './generation-progress';
import { ThinkingBlock } from './thinking-block';
import { ToolCallCard } from './tool-call-card';

type Props = {
	messages: ChatMessageRecord[];
	isGenerating: boolean;
};

export function ChatMessageList({ messages, isGenerating }: Props) {
	const bottomRef = useRef<HTMLDivElement>(null);
	const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

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

			{/* 图片放大 Dialog，通过 Portal 挂到根节点，不受父级布局影响 */}
			<Dialog open={!!lightboxSrc} onOpenChange={(open) => !open && setLightboxSrc(null)}>
				<DialogContent className="max-w-[90vw] max-h-[90vh] w-fit h-fit p-2 bg-transparent border-none shadow-none flex items-center justify-center overflow-hidden">
					{lightboxSrc && (
						<img
							src={lightboxSrc}
							alt="enlarged"
							className="max-w-[88vw] max-h-[86vh] rounded-lg object-contain"
						/>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

function MessageItem({ message, onImageClick }: { message: ChatMessageRecord; onImageClick: (src: string) => void }) {
	if (message.role === 'user') {
		return (
			<div className="flex justify-end">
				<div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground break-words whitespace-pre-wrap space-y-2">
					{message.imageBase64 && (
						<img
							src={message.imageBase64.startsWith('data:') ? message.imageBase64 : `data:image/png;base64,${message.imageBase64}`}
							alt="user upload"
							className="max-w-full rounded-lg object-contain max-h-64 cursor-pointer"
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
			<div className="flex flex-col justify-start gap-1">
				{message.thinkingText && (
					<ThinkingBlock
						thinkingText={message.thinkingText}
						thinkingTokens={message.thinkingTokens ?? undefined}
					/>
				)}
				{/* 外层 div 控制最大宽度，内层 div 负责 prose 排版，两者不冲突 */}
				<div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm break-words">
					<div className="prose prose-sm dark:prose-invert max-w-none">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>
							{message.contentText}
						</ReactMarkdown>
					</div>
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
