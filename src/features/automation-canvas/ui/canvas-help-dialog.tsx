/**
 * canvas-help-dialog.tsx
 * 流程编辑器操作指南对话框
 */

import { useTranslation } from 'react-i18next';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function CanvasHelpDialog({ open, onOpenChange }: Props) {
	const { t } = useTranslation('canvas');

	const sections = [
		{
			title: t('help.basic'),
			items: [
				{
					key: t('help.basicOps.addStep'),
					desc: t('help.basicOps.addStepDesc'),
				},
				{
					key: t('help.basicOps.selectNode'),
					desc: t('help.basicOps.selectNodeDesc'),
				},
				{
					key: t('help.basicOps.moveNode'),
					desc: t('help.basicOps.moveNodeDesc'),
				},
				{ key: t('help.basicOps.pan'), desc: t('help.basicOps.panDesc') },
				{ key: t('help.basicOps.zoom'), desc: t('help.basicOps.zoomDesc') },
				{
					key: t('help.basicOps.fitView'),
					desc: t('help.basicOps.fitViewDesc'),
				},
			],
		},
		{
			title: t('help.connections'),
			items: [
				{
					key: t('help.connectionOps.connect'),
					desc: t('help.connectionOps.connectDesc'),
				},
				{
					key: t('help.connectionOps.deleteEdge'),
					desc: t('help.connectionOps.deleteEdgeDesc'),
				},
				{
					key: t('help.connectionOps.changeOrder'),
					desc: t('help.connectionOps.changeOrderDesc'),
				},
				{
					key: t('help.connectionOps.startNode'),
					desc: t('help.connectionOps.startNodeDesc'),
				},
			],
		},
		{
			title: t('help.selection'),
			items: [
				{
					key: t('help.selectionOps.boxSelect'),
					desc: t('help.selectionOps.boxSelectDesc'),
				},
				{
					key: t('help.selectionOps.selectAll'),
					desc: t('help.selectionOps.selectAllDesc'),
				},
				{
					key: t('help.selectionOps.copy'),
					desc: t('help.selectionOps.copyDesc'),
				},
				{
					key: t('help.selectionOps.paste'),
					desc: t('help.selectionOps.pasteDesc'),
				},
				{
					key: t('help.selectionOps.duplicate'),
					desc: t('help.selectionOps.duplicateDesc'),
				},
				{
					key: t('help.selectionOps.deleteNode'),
					desc: t('help.selectionOps.deleteNodeDesc'),
				},
			],
		},
		{
			title: t('help.saveRun'),
			items: [
				{
					key: t('help.saveRunOps.manualSave'),
					desc: t('help.saveRunOps.manualSaveDesc'),
				},
				{
					key: t('help.saveRunOps.autoSave'),
					desc: t('help.saveRunOps.autoSaveDesc'),
				},
				{
					key: t('help.saveRunOps.closeWindow'),
					desc: t('help.saveRunOps.closeWindowDesc'),
				},
				{
					key: t('help.saveRunOps.runScript'),
					desc: t('help.saveRunOps.runScriptDesc'),
				},
				{
					key: t('help.saveRunOps.cancelRun'),
					desc: t('help.saveRunOps.cancelRunDesc'),
				},
			],
		},
		{
			title: t('help.properties'),
			items: [
				{
					key: t('help.propertyOps.editProps'),
					desc: t('help.propertyOps.editPropsDesc'),
				},
				{
					key: t('help.propertyOps.resizePanel'),
					desc: t('help.propertyOps.resizePanelDesc'),
				},
				{
					key: t('help.propertyOps.insertVar'),
					desc: t('help.propertyOps.insertVarDesc'),
				},
				{
					key: t('help.propertyOps.selectorType'),
					desc: t('help.propertyOps.selectorTypeDesc'),
				},
			],
		},
		{
			title: t('help.controlFlow'),
			items: [
				{
					key: t('help.controlFlowOps.condition'),
					desc: t('help.controlFlowOps.conditionDesc'),
				},
				{
					key: t('help.controlFlowOps.loop'),
					desc: t('help.controlFlowOps.loopDesc'),
				},
				{
					key: t('help.controlFlowOps.dialog'),
					desc: t('help.controlFlowOps.dialogDesc'),
				},
			],
		},
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 overflow-hidden">
				<DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
					<DialogTitle className="text-sm font-semibold">
						{t('help.title')}
					</DialogTitle>
				</DialogHeader>
				<ScrollArea className="flex-1 overflow-y-auto">
					<div className="px-5 py-4 space-y-5">
						{sections.map((section) => (
							<div key={section.title}>
								<h3 className="text-xs font-semibold text-foreground mb-2">
									{section.title}
								</h3>
								<div className="space-y-1.5">
									{section.items.map((item) => (
										<div key={item.key} className="flex gap-2 text-xs">
											<span className="font-medium text-primary shrink-0 w-28 text-right">
												{item.key}
											</span>
											<span className="text-muted-foreground">{item.desc}</span>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
