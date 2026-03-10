import {
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	type Node,
	ReactFlow,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';

import { Badge, Button, Card, Checkbox, Input, Textarea } from '@/components/ui';
import type { RpaFlowEditorModel } from '@/features/rpa/model/use-rpa-flow-editor';

type RpaFlowCanvasPanelProps = {
	editor: RpaFlowEditorModel;
};

export function RpaFlowCanvasPanel({ editor }: RpaFlowCanvasPanelProps) {
	return (
		<div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
			<Card className="space-y-4 border-border/60 bg-card/88 p-4">
				<div>
					<h2 className="text-sm font-semibold">流程元信息</h2>
					<p className="text-xs text-muted-foreground">这里维护名称、备注、并发和默认目标。</p>
				</div>
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						void editor.saveFlowDraft();
					}}
				>
					<div className="space-y-2">
						<label htmlFor="rpa-flow-name" className="text-xs font-medium text-muted-foreground">
							流程名称
						</label>
						<Input id="rpa-flow-name" className="cursor-pointer" {...editor.flowForm.register('name')} />
						{editor.flowForm.formState.errors.name ? (
							<p className="text-xs text-destructive">{editor.flowForm.formState.errors.name.message}</p>
						) : null}
					</div>
					<div className="space-y-2">
						<label htmlFor="rpa-flow-note" className="text-xs font-medium text-muted-foreground">
							备注
						</label>
						<Textarea id="rpa-flow-note" rows={3} {...editor.flowForm.register('note')} />
					</div>
					<div className="space-y-2">
						<label htmlFor="rpa-flow-concurrency" className="text-xs font-medium text-muted-foreground">
							默认并发
						</label>
						<Input
							id="rpa-flow-concurrency"
							type="number"
							min={1}
							max={5}
							{...editor.flowForm.register('concurrencyLimit', { valueAsNumber: true })}
						/>
					</div>
					<div className="space-y-2">
						<label htmlFor="rpa-flow-variables" className="text-xs font-medium text-muted-foreground">
							变量定义（`key|label|required|default`）
						</label>
						<Textarea id="rpa-flow-variables" rows={6} {...editor.flowForm.register('variablesText')} />
					</div>
					<div className="space-y-2">
						<div className="text-xs font-medium text-muted-foreground">默认目标 Profile</div>
						<div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-2">
							{editor.profiles.map((profile) => (
								<label
									key={profile.id}
									htmlFor={`rpa-default-target-${profile.id}`}
									className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/60"
								>
									<Checkbox
										id={`rpa-default-target-${profile.id}`}
										checked={editor.defaultTargetProfileIds.includes(profile.id)}
										onCheckedChange={(checked) =>
											editor.setDefaultTargetProfileIds((current) =>
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
					<Button type="submit" className="w-full cursor-pointer">
						保存当前流程
					</Button>
				</form>
			</Card>

			<div className="space-y-4">
				<Card className="space-y-3 border-border/60 bg-card/88 p-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-sm font-semibold">节点画布</h2>
							<p className="text-xs text-muted-foreground">先拖动和连线，再在下方编辑当前节点的 JSON 配置。</p>
						</div>
						<Badge variant="secondary">{editor.nodes.length} 个节点</Badge>
					</div>
					<div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-background/70 p-3">
						{editor.nodeLibrary.map((item) => (
							<Button
								key={item.kind}
								type="button"
								variant="outline"
								size="sm"
								className="cursor-pointer"
								onClick={() => editor.handleAddNode(item.kind)}
							>
								{item.label}
							</Button>
						))}
					</div>
					<div className="h-[520px] overflow-hidden rounded-2xl border border-border/60 bg-background/80">
						<ReactFlow
							nodes={editor.nodes}
							edges={editor.edges}
							onNodesChange={editor.onNodesChange}
							onEdgesChange={editor.onEdgesChange}
							onConnect={editor.handleConnect}
							onNodeClick={(_, node: Node) => editor.setSelectedNodeId(node.id)}
							fitView
						>
							<Controls />
							<MiniMap />
							<Background variant={BackgroundVariant.Dots} gap={16} size={1} />
						</ReactFlow>
					</div>
				</Card>

				<Card className="border-border/60 bg-card/88 p-4">
					<div className="mb-3 flex items-center justify-between">
						<div>
							<h3 className="text-sm font-semibold">节点配置</h3>
							<p className="text-xs text-muted-foreground">首版继续使用 JSON 面板，保持节点能力接入速度。</p>
						</div>
						{editor.selectedNode ? (
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="cursor-pointer"
								onClick={() => {
									editor.setNodes((current) =>
										current.filter((item) => item.id !== editor.selectedNode?.id),
									);
									editor.setEdges((current) =>
										current.filter(
											(item) =>
												item.source !== editor.selectedNode?.id &&
												item.target !== editor.selectedNode?.id,
										),
									);
									editor.setSelectedNodeId(null);
								}}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						) : null}
					</div>
					{editor.selectedNode ? (
						<form className="space-y-3" onSubmit={editor.handleApplyNodeConfig}>
							<div className="rounded-xl border border-border/60 bg-card/70 p-3">
								<p className="text-sm font-medium">
									{(editor.selectedNode.data as { label?: string })?.label ?? editor.selectedNode.id}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									类型：{(editor.selectedNode.data as { kind?: string })?.kind}
								</p>
							</div>
							<Textarea rows={14} {...editor.nodeConfigForm.register('configText')} />
							{editor.nodeConfigForm.formState.errors.configText ? (
								<p className="text-xs text-destructive">
									{editor.nodeConfigForm.formState.errors.configText.message}
								</p>
							) : null}
							<Button type="submit" className="w-full cursor-pointer">
								应用节点配置
							</Button>
						</form>
					) : (
						<div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
							点击画布中的任意节点后，在这里编辑它的 JSON 配置。
						</div>
					)}
				</Card>
			</div>
		</div>
	);
}
