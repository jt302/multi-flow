import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Textarea,
} from '@/components/ui';
import {
	readAiChatGlobalPrompt,
	updateAiChatGlobalPrompt,
} from '@/entities/chat/api/chat-api';

export function AiChatGlobalPromptCard() {
	const { t } = useTranslation('settings');
	const [draft, setDraft] = useState('');
	const [dirty, setDirty] = useState(false);

	const { data: saved } = useQuery({
		queryKey: ['ai-chat-global-prompt'],
		queryFn: readAiChatGlobalPrompt,
	});

	useEffect(() => {
		if (saved !== undefined) {
			setDraft(saved ?? '');
			setDirty(false);
		}
	}, [saved]);

	const handleChange = (v: string) => {
		setDraft(v);
		setDirty(v !== (saved ?? ''));
	};

	const handleSave = async () => {
		await updateAiChatGlobalPrompt(draft.trim() || null);
		setDirty(false);
		toast.success(t('aiChatGlobalPrompt.saved'));
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					{t('aiChatGlobalPrompt.title')}
				</CardTitle>
				<p className="text-xs text-muted-foreground">
					{t('aiChatGlobalPrompt.desc')}
				</p>
			</CardHeader>
			<CardContent className="space-y-3">
				<Textarea
					value={draft}
					onChange={(e) => handleChange(e.target.value)}
					placeholder={t('aiChatGlobalPrompt.placeholder')}
					className="min-h-[100px] resize-y text-sm"
					rows={4}
				/>
				<div className="flex justify-end">
					<Button
						type="button"
						size="sm"
						disabled={!dirty}
						onClick={handleSave}
					>
						{t('aiChatGlobalPrompt.save')}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
