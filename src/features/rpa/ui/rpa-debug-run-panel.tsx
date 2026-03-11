import { Play, TestTubeDiagonal } from 'lucide-react';

import { Button, Card, Checkbox, Input, Textarea } from '@/components/ui';
import type { RpaFlowEditorModel } from '@/features/rpa/model/use-rpa-flow-editor';

type RpaDebugRunPanelProps = {
	editor: RpaFlowEditorModel;
};

export function RpaDebugRunPanel({ editor }: RpaDebugRunPanelProps) {
	return (
		<Card className="space-y-4 border-border/60 bg-card/88 p-4">
			<div className="flex items-center gap-2">
				<TestTubeDiagonal className="h-4 w-4 text-primary" />
				<div>
					<h2 className="text-sm font-semibold">临时调试运行</h2>
					<p className="text-xs text-muted-foreground">仅用于调试当前流程，正式运行请到“任务管理”执行。</p>
				</div>
			</div>

			<form className="space-y-4" onSubmit={editor.handleRunFlow}>
				<div className="space-y-2">
					<div className="text-xs font-medium text-muted-foreground">目标 Profile</div>
					<div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
						{editor.profiles.map((profile) => (
							<label
								htmlFor={`rpa-debug-target-${profile.id}`}
								key={profile.id}
								className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/60"
							>
								<Checkbox
									id={`rpa-debug-target-${profile.id}`}
									checked={editor.runTargetProfileIds.includes(profile.id)}
									onCheckedChange={(checked) =>
										editor.setRunTargetProfileIds((current) =>
											checked
												? [...new Set([...current, profile.id])]
												: current.filter((item) => item !== profile.id),
										)
									}
								/>
								<span>{profile.name}</span>
							</label>
						))}
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<label htmlFor="rpa-debug-concurrency" className="text-xs font-medium text-muted-foreground">
							运行并发
						</label>
						<Input
							id="rpa-debug-concurrency"
							type="number"
							min={1}
							max={5}
							className="cursor-pointer"
							{...editor.runForm.register('concurrencyLimit', { valueAsNumber: true })}
						/>
					</div>
				</div>

				<div className="space-y-2">
					<label htmlFor="rpa-debug-runtime-input" className="text-xs font-medium text-muted-foreground">
						运行时输入 JSON
					</label>
					<Textarea
						id="rpa-debug-runtime-input"
						rows={6}
						className="font-mono text-xs"
						{...editor.runForm.register('runtimeInputText')}
					/>
				</div>

				<Button
					type="submit"
					className="w-full cursor-pointer gap-2"
					disabled={!editor.selectedFlow || editor.selectedFlow.lifecycle !== 'active'}
				>
					<Play className="h-4 w-4" />
					调试运行
				</Button>
			</form>
		</Card>
	);
}
