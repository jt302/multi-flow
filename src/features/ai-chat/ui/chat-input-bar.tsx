import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Send, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
	value: string;
	onChange: (v: string) => void;
	onSend: () => void;
	onStop: () => void;
	isGenerating: boolean;
	disabled?: boolean;
};

export function ChatInputBar({
	value,
	onChange,
	onSend,
	onStop,
	isGenerating,
	disabled,
}: Props) {
	const { t } = useTranslation('chat');
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			if (!isGenerating && value.trim()) onSend();
		}
	};

	return (
		<div className="shrink-0 border-t bg-background px-4 py-3">
			<div className="max-w-3xl mx-auto flex gap-2 items-end">
				<Textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={t('inputPlaceholder')}
					className="min-h-[44px] max-h-40 resize-none"
					disabled={disabled || isGenerating}
					rows={1}
				/>
				{isGenerating ? (
					<Button
						type="button"
						size="icon"
						variant="destructive"
						onClick={onStop}
					>
						<Square className="size-4" />
					</Button>
				) : (
					<Button
						type="button"
						size="icon"
						onClick={onSend}
						disabled={!value.trim() || disabled}
					>
						<Send className="size-4" />
					</Button>
				)}
			</div>
		</div>
	);
}
