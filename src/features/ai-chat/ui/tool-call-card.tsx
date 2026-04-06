import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

import { ChevronDown, ChevronRight, Clock, Wrench } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ChatMessageRecord } from '@/entities/chat/model/types';

type Props = { message: ChatMessageRecord };

const SCREENSHOT_TOOLS = new Set(['cdp_screenshot', 'magic_capture_app_shell']);

export function ToolCallCard({ message, onImageClick }: Props & { onImageClick?: (src: string) => void }) {
	const { t } = useTranslation('chat');
	const isError = message.toolStatus === 'failed';
	const [open, setOpen] = useState(isError);
	const args = message.toolArgsJson ? tryParseJson(message.toolArgsJson) : null;
	const imageSrc = message.imageRef
		? convertFileSrc(message.imageRef)
		: message.imageBase64
			? (message.imageBase64.startsWith('data:')
				? message.imageBase64
				: `data:image/png;base64,${message.imageBase64}`)
			: null;
	const isScreenshot = message.toolName ? SCREENSHOT_TOOLS.has(message.toolName) : false;

	return (
		<div
			className={cn(
				'rounded-lg border text-xs',
				isError
					? 'border-destructive bg-destructive/10'
					: 'border-border bg-muted/30',
			)}
		>
			<button
				type="button"
				className="flex w-full items-center gap-2 px-3 py-2 text-left cursor-pointer"
				onClick={() => setOpen((v) => !v)}
			>
				<Wrench className="size-3 shrink-0 text-muted-foreground" />
				<span className="font-mono font-medium truncate">
					{message.toolName}
				</span>
				<Badge
					variant={isError ? 'destructive' : 'secondary'}
					className="ml-auto shrink-0 text-[10px] h-4"
				>
					{message.toolStatus ?? t('toolExecuting')}
				</Badge>
				{message.toolDurationMs != null && (
					<span className="flex items-center gap-0.5 text-muted-foreground shrink-0">
						<Clock className="size-2.5" />
						{message.toolDurationMs}ms
					</span>
				)}
				{isScreenshot && imageSrc && !open && (
					<span className="shrink-0 text-[10px] text-muted-foreground">
						{t('expandToViewScreenshot')}
					</span>
				)}
				{open ? (
					<ChevronDown className="size-3 shrink-0" />
				) : (
					<ChevronRight className="size-3 shrink-0" />
				)}
			</button>
			{open && (
				<div className="border-t border-border px-3 py-2 space-y-2">
					{args && (
						<div>
							<p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
								{t('toolArgs')}
							</p>
							<pre className="whitespace-pre-wrap break-all text-[11px] bg-muted/50 rounded p-2 font-mono">
								{JSON.stringify(args, null, 2)}
							</pre>
						</div>
					)}
					{imageSrc && (
						<img
							src={imageSrc}
							alt="tool result screenshot"
							className={cn(
								'max-w-full rounded border',
								onImageClick && 'cursor-zoom-in',
							)}
							loading="lazy"
							decoding="async"
							onClick={() => onImageClick?.(imageSrc)}
						/>
					)}
					{message.toolResult && !imageSrc && (
						<div>
							<p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
								{t('toolResult')}
							</p>
							<pre className="whitespace-pre-wrap break-all text-[11px] max-h-40 overflow-y-auto bg-muted/50 rounded p-2 font-mono">
								{formatToolResult(message.toolResult)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function tryParseJson(s: string) {
	try {
		return JSON.parse(s);
	} catch {
		return null;
	}
}

function formatToolResult(text: string): string {
	// 尝试格式化 JSON 结果
	const parsed = tryParseJson(text);
	if (parsed) return JSON.stringify(parsed, null, 2);
	return text;
}
