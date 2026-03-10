import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from '@/components/ui';
import type { RpaFlowEditorModel } from '@/features/rpa/model/use-rpa-flow-editor';

type RpaLeaveDialogProps = {
	editor: RpaFlowEditorModel;
};

export function RpaLeaveDialog({ editor }: RpaLeaveDialogProps) {
	return (
		<AlertDialog open={editor.leaveDialogOpen} onOpenChange={editor.setLeaveDialogOpen}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>关闭编辑窗口前先处理草稿</AlertDialogTitle>
					<AlertDialogDescription>
						当前流程还有未保存修改。你可以先保存，再关闭编辑窗口回到主界面；也可以直接放弃修改。
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<Button
						type="button"
						variant="ghost"
						className="cursor-pointer"
						disabled={editor.leavePending}
						onClick={() => editor.setLeaveDialogOpen(false)}
					>
						继续编辑
					</Button>
					<Button
						type="button"
						variant="outline"
						className="cursor-pointer"
						disabled={editor.leavePending}
						onClick={() => {
							editor.setLeaveDialogOpen(false);
							void editor.leaveToMain();
						}}
					>
						放弃修改并关闭
					</Button>
					<Button
						type="button"
						className="cursor-pointer"
						disabled={editor.leavePending}
						onClick={() => {
							void (async () => {
								editor.setLeavePending(true);
								try {
									const saved = await editor.saveFlowDraft();
									if (!saved) {
										editor.setLeaveDialogOpen(false);
										return;
									}
									editor.setLeaveDialogOpen(false);
									await editor.leaveToMain();
								} finally {
									editor.setLeavePending(false);
								}
							})();
						}}
					>
						保存并关闭
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
