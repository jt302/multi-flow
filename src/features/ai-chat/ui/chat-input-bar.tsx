import { useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Send, Square, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
	value: string;
	onChange: (v: string) => void;
	onSend: () => void;
	onStop: () => void;
	isGenerating: boolean;
	disabled?: boolean;
	/** 覆盖发送按钮的 disabled 状态（优先于内部的 !value.trim() 判断） */
	sendDisabled?: boolean;
	/** 当前已使用的上下文 token 数（估算值） */
	contextUsed?: number;
	/** 粘贴的图片 base64（含 data: 前缀） */
	imageBase64?: string | null;
	/** 图片变更回调 */
	onImageChange?: (img: string | null) => void;
};

/** 将 token 数格式化为 "Xk" 形式，保留一位小数（不足 1k 时直接显示整数） */
function fmtK(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

export function ChatInputBar({
	value,
	onChange,
	onSend,
	onStop,
	isGenerating,
	disabled,
	sendDisabled,
	contextUsed = 0,
	imageBase64,
	onImageChange,
}: Props) {
	const { t } = useTranslation('chat');
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const compositionRef = useRef(false);

	// 根据内容自动调整 textarea 高度
	const adjustHeight = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}, []);

	useEffect(() => {
		adjustHeight();
	}, [value, adjustHeight]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		const nativeEvent = e.nativeEvent as React.KeyboardEvent<HTMLTextAreaElement>['nativeEvent'] & {
			keyCode?: number;
		};
		const isComposing =
			compositionRef.current
			|| e.nativeEvent.isComposing
			|| nativeEvent.keyCode === 229;
		if (isComposing) return;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (!isGenerating && (value.trim() || imageBase64)) onSend();
		}
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		if (!onImageChange) return;
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of Array.from(items)) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (!file) continue;
				const reader = new FileReader();
				reader.onload = () => {
					onImageChange(reader.result as string);
				};
				reader.readAsDataURL(file);
				return;
			}
		}
	};

	const canSend = !isGenerating && (!!value.trim() || !!imageBase64) && !disabled;

	return (
		<div className="shrink-0 border-t bg-background px-4 py-3">
			<div className="max-w-3xl mx-auto flex flex-col gap-2">
				{/* 图片预览 */}
				{imageBase64 && (
					<div className="relative w-20 h-20">
						<img
							src={imageBase64}
							alt="paste preview"
							className="w-20 h-20 rounded object-cover border"
							loading="lazy"
							decoding="async"
						/>
						<button
							type="button"
							onClick={() => onImageChange?.(null)}
							className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 cursor-pointer hover:bg-accent"
						>
							<X className="size-3" />
						</button>
					</div>
				)}
				<div className="flex gap-2 items-end">
					<div className="relative flex-1">
						<Textarea
							ref={textareaRef}
							value={value}
							onChange={(e) => onChange(e.target.value)}
							onCompositionStart={() => {
								compositionRef.current = true;
							}}
							onCompositionEnd={() => {
								compositionRef.current = false;
							}}
							onKeyDown={handleKeyDown}
							onPaste={handlePaste}
							placeholder={t('inputPlaceholder')}
							className="min-h-[44px] max-h-40 resize-none overflow-y-auto w-full"
							disabled={disabled || isGenerating}
							rows={1}
						/>
						{/* 上下文用量：叠在 textarea 右下角内部，不占空间 */}
						{contextUsed > 0 && (
							<span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] text-muted-foreground/60 tabular-nums">
								{fmtK(contextUsed)}
							</span>
						)}
					</div>
					{isGenerating ? (
						<Button type="button" size="icon" variant="destructive" onClick={onStop}>
							<Square className="size-4" />
						</Button>
					) : (
						<Button
							type="button"
							size="icon"
							onClick={onSend}
							disabled={sendDisabled ?? !canSend}
						>
							<Send className="size-4" />
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
