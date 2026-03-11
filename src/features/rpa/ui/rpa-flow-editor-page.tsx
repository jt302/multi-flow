import '@xyflow/react/dist/style.css';

import { ArrowLeft, Bot, Plus } from 'lucide-react';

import { Button, Card, Toaster } from '@/components/ui';
import { resolveSonnerTheme } from '@/entities/theme/model/sonner-theme';
import { useThemeSettings } from '@/entities/theme/model/use-theme-settings';
import { useRpaFlowEditor } from '@/features/rpa/model/use-rpa-flow-editor';
import { RpaEditorHeader } from './rpa-editor-header';
import { RpaDebugRunPanel } from './rpa-debug-run-panel';
import { RpaFlowCanvasPanel } from './rpa-flow-canvas-panel';
import { RpaLeaveDialog } from './rpa-leave-dialog';

export function RpaFlowEditorPage() {
	const editor = useRpaFlowEditor();
	const { resolvedMode } = useThemeSettings();

	if (editor.flowMissing && !editor.isCreateMode) {
		return (
			<div className="h-dvh overflow-hidden bg-background p-4 md:p-6">
				<Card className="mx-auto flex h-full max-w-3xl items-center justify-center border-border/60 bg-card/90 p-8 text-center backdrop-blur">
					<div className="flex flex-col gap-4">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<Bot className="h-6 w-6" />
						</div>
						<div className="flex flex-col gap-2">
							<h1 className="text-2xl font-semibold">流程不存在</h1>
							<p className="text-sm text-muted-foreground">
								当前窗口指定的流程已被删除或不存在。你可以返回主界面，或者直接开始一个新流程草稿。
							</p>
						</div>
						<div className="flex justify-center gap-3">
							<Button
								variant="outline"
								onClick={() => void editor.requestLeaveToMain()}
							>
								<ArrowLeft data-icon="inline-start" />
								返回主界面
							</Button>
							<Button onClick={editor.handleStartNewDraft}>
								<Plus data-icon="inline-start" />
								新建流程
							</Button>
						</div>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className="h-dvh overflow-hidden bg-background p-4 md:p-6">
			<div className="mx-auto flex h-full max-w-[1680px] flex-col gap-4">
				<RpaEditorHeader editor={editor} />
				<div className="min-h-0 flex-1 space-y-3 overflow-auto">
					<RpaFlowCanvasPanel editor={editor} />
					<RpaDebugRunPanel editor={editor} />
				</div>
			</div>

			<RpaLeaveDialog editor={editor} />
			<Toaster theme={resolveSonnerTheme(resolvedMode)} />
		</div>
	);
}
