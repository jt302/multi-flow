import { memo, useRef, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Send, Square, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
	onSubmit: (text: string, imageBase64: string | null) => void;
	onStop: () => void;
	isGenerating: boolean;
	disabled?: boolean;
	/** false = 始终可点（父层会处理后续逻辑）；undefined = 使用内部 canSend 判断 */
	sendDisabled?: boolean;
	contextUsed?: number;
};

/** 将 token 数格式化为 "Xk" 形式，保留一位小数（不足 1k 时直接显示整数） */
function fmtK(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

export const ChatInputBar = memo(function ChatInputBar({
	onSubmit,
	onStop,
	isGenerating,
	disabled,
	sendDisabled,
	contextUsed = 0,
}: Props) {
	const { t } = useTranslation('chat');
	const [value, setValue] = useState('');
	const [imageBase64, setImageBase64] = useState<string | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const compositionRef = useRef(false);

	const adjustHeight = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}, []);

	useEffect(() => {
		adjustHeight();
	}, [value, adjustHeight]);

	const handleSend = useCallback(() => {
		if (isGenerating) return;
		const text = value;
		const img = imageBase64;
		setValue('');
		setImageBase64(null);
		onSubmit(text, img);
	}, [isGenerating, value, imageBase64, onSubmit]);

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
			if (!isGenerating && (value.trim() || imageBase64)) handleSend();
		}
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of Array.from(items)) {
			if (item.type.startsWith('image/')) {
				e.preventDefault();
				const file = item.getAsFile();
				if (!file) continue;
				const reader = new FileReader();
				reader.onload = () => {
					setImageBase64(reader.result as string);
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
							onClick={() => setImageBase64(null)}
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
							onChange={(e) => setValue(e.target.value)}
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
							onClick={handleSend}
							disabled={sendDisabled ?? !canSend}
						>
							<Send className="size-4" />
						</Button>
					)}
				</div>
			</div>
		</div>
	);
});
