import { useEffect, useRef } from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
		<ScrollArea className="flex-1 min-h-0">
			<div className="px-4 py-4 space-y-4 max-w-5xl mx-auto w-full">
				{messages.map((msg) => (
					<MessageItem key={msg.id} message={msg} />
				))}
				{isGenerating && <GenerationProgress />}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}

function MessageItem({ message }: { message: ChatMessageRecord }) {
	if (message.role === 'user') {
		return (
			<div className="flex justify-end">
				{/* max-w-[75%] 限制宽度，break-words 长文本自动换行 */}
				<div className="max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground break-words whitespace-pre-wrap">
					{message.contentText}
				</div>
			</div>
		);
	}

	if (message.role === 'tool') {
		return (
			<div className="max-w-[90%]">
				<ToolCallCard message={message} />
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
