import { useTranslation } from 'react-i18next';

import type { AiChatTabId } from './ai-chat-tab-constants';

interface AiChatPlaceholderProps {
	tab: Exclude<AiChatTabId, 'sessions'>;
}

export function AiChatPlaceholder({ tab }: AiChatPlaceholderProps) {
	const { t } = useTranslation('chat');

	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
			<p className="text-base font-medium">{t(`placeholder.${tab}.title`)}</p>
			<p className="text-sm">{t(`placeholder.${tab}.description`)}</p>
		</div>
	);
}
