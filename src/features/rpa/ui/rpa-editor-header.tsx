import { ArrowLeft, Bot, Plus, Save } from 'lucide-react';

import { Button, Card } from '@/components/ui';
import type { RpaFlowEditorModel } from '@/features/rpa/model/use-rpa-flow-editor';

type RpaEditorHeaderProps = {
	editor: RpaFlowEditorModel;
};

export function RpaEditorHeader({ editor }: RpaEditorHeaderProps) {
	return (
		<Card className="shrink-0 border-border/60 bg-card/90 p-4 backdrop-blur">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">RPA Editor</p>
					<h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
						<Bot className="h-5 w-5 text-primary" />
						{editor.selectedFlow?.name ?? '新流程草稿'}
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						这里只负责流程设计与临时调试，正式运行与记录请在主窗口任务中心操作。
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						className="cursor-pointer"
						onClick={() => void editor.requestLeaveToMain()}
					>
						<ArrowLeft className="h-4 w-4" />
						返回主界面
					</Button>
					<Button variant="outline" className="cursor-pointer" onClick={editor.handleStartNewDraft}>
						<Plus className="h-4 w-4" />
						新流程
					</Button>
					{editor.selectedFlow ? (
						<Button
							variant="outline"
							className="cursor-pointer"
							onClick={() => {
								const flow = editor.selectedFlow;
								if (!flow) {
									return;
								}

								if (flow.lifecycle === 'active') {
									void editor.actions.deleteFlow(flow.id);
									return;
								}

								void editor.actions.restoreFlow(flow.id);
							}}
						>
							{editor.selectedFlow?.lifecycle === 'active' ? '归档流程' : '恢复流程'}
						</Button>
					) : null}
					<Button className="cursor-pointer" onClick={() => void editor.saveFlowDraft()}>
						<Save className="h-4 w-4" />
						保存流程
					</Button>
				</div>
			</div>
		</Card>
	);
}
