import { AiChatGlobalPromptCard } from './ai-chat-global-prompt-card';
import { AiChatSettingsCard } from './ai-chat-settings-card';
import { AiProviderConfigCard } from './ai-provider-config-card';
import { CaptchaSolverConfigCard } from './captcha-solver-config-card';
import { ToolPermissionsCard } from './tool-permissions-card';

export function AiSettingsPanel() {
	return (
		<div className="space-y-4">
			<AiProviderConfigCard />
			<AiChatSettingsCard />
			<AiChatGlobalPromptCard />
			<CaptchaSolverConfigCard />
			<ToolPermissionsCard />
		</div>
	);
}
