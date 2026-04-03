/**
 * canvas-help-dialog.tsx
 * 流程编辑器操作指南对话框
 */

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

const sections = [
	{
		title: '基本操作',
		items: [
			{ key: '添加步骤', desc: '从左侧面板点击步骤类型，新步骤将出现在画布中心' },
			{ key: '选中节点', desc: '左键点击节点，右侧弹出属性编辑面板' },
			{ key: '移动节点', desc: '左键拖拽节点到新位置' },
			{ key: '画布平移', desc: '鼠标中键或右键拖拽画布' },
			{ key: '画布缩放', desc: '鼠标滚轮缩放，或使用左下角 +/- 按钮' },
			{ key: '适应视图', desc: '点击左下角「适应」按钮，所有节点居中显示' },
		],
	},
	{
		title: '连接与流程',
		items: [
			{ key: '连接节点', desc: '从节点底部圆点拖拽到另一个节点顶部圆点' },
			{ key: '删除连线', desc: '点击连线使其高亮，按 Backspace 或 Delete 键删除' },
			{ key: '更改流程顺序', desc: '删除旧连线，重新从源节点拖拽到目标节点' },
			{ key: 'Start 节点', desc: '绿色起点标记，拖拽其连线到任意步骤节点设置流程入口' },
		],
	},
	{
		title: '选择与批量操作',
		items: [
			{ key: '框选节点', desc: '在画布空白处左键拖拽创建选择框，框内节点被选中' },
			{ key: '全选', desc: 'Cmd/Ctrl + A 选中所有节点' },
			{ key: '复制节点', desc: '选中节点后 Cmd/Ctrl + C 复制' },
			{ key: '粘贴节点', desc: 'Cmd/Ctrl + V 粘贴已复制的节点' },
			{ key: '复制当前节点', desc: 'Cmd/Ctrl + D 快速复制当前选中的步骤' },
			{ key: '删除节点', desc: '选中节点后按 Backspace 或 Delete 键' },
		],
	},
	{
		title: '保存与运行',
		items: [
			{ key: '手动保存', desc: '点击工具栏保存按钮或 Cmd/Ctrl + S' },
			{ key: '自动保存', desc: '编辑后 2 秒自动保存，工具栏显示保存状态' },
			{ key: '关闭窗口', desc: '关闭时自动保存未持久化的变更' },
			{ key: '运行脚本', desc: '点击工具栏「运行」按钮，选择环境后执行' },
			{ key: '取消运行', desc: '运行中点击「取消」按钮终止执行' },
		],
	},
	{
		title: '步骤属性',
		items: [
			{ key: '编辑属性', desc: '点击节点后在右侧面板修改参数' },
			{ key: '调整面板宽度', desc: '拖拽面板左侧边缘调整宽度' },
			{ key: '变量插入', desc: '文本字段右侧的变量按钮可插入 {{变量名}}' },
			{ key: '选择器类型', desc: '支持 CSS、XPath、Text 三种元素定位方式' },
		],
	},
	{
		title: '条件与循环',
		items: [
			{ key: '条件分支', desc: '条件节点有 then/else 两个输出口，连接到不同步骤' },
			{ key: '循环', desc: '循环节点有 body（循环体）和 next（循环后）两个输出口' },
			{ key: '对话框分支', desc: '确认对话框节点可定义多个按钮，每个按钮对应一条分支' },
		],
	},
];

export function CanvasHelpDialog({ open, onOpenChange }: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
				<DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
					<DialogTitle className="text-sm font-semibold">流程编辑器操作指南</DialogTitle>
				</DialogHeader>
				<ScrollArea className="flex-1 min-h-0">
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
