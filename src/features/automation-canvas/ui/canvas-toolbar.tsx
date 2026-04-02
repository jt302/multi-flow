/**
 * canvas-toolbar.tsx
 * 画布顶部工具栏，包含：返回按钮、脚本名称、步骤数、变量按钮、步骤延迟设置、
 * 保存状态指示器、运行/取消按钮以及运行状态徽章。
 */

import {
	ArrowLeft,
	CheckCircle,
	Loader2,
	Play,
	Square,
	Variable,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type { ScriptVarDef } from '@/entities/automation/model/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
	/** 脚本名称，显示在工具栏中 */
	scriptName: string;
	/** 当前步骤总数 */
	stepCount: number;
	/** 是否正在保存 */
	saving: boolean;
	/** 上次保存时间戳（毫秒），null 表示尚未保存 */
	savedAt: number | null;
	/** 当前步骤延迟（毫秒） */
	stepDelayMs: number;
	/** 步骤延迟变更回调，外层负责持久化 */
	onStepDelayChange: (val: number) => void;
	/** 脚本是否正在运行 */
	isRunning: boolean;
	/** 当前活跃运行 ID（用于显示运行状态徽章） */
	activeRunId: string | null;
	/** 点击"运行"按钮时的回调（打开运行对话框） */
	onOpenRunDialog: () => void;
	/** 点击"取消"按钮时的回调 */
	onCancel: () => void;
	/** 点击"变量"按钮时的回调（打开变量对话框） */
	onOpenVariables: () => void;
	/** 当前脚本变量定义列表，用于显示变量数量 */
	varsDefs: ScriptVarDef[];
};

/**
 * 画布顶部工具栏组件
 * - 独立窗口时（history.length <= 1）隐藏返回按钮
 * - savedAt 超过 3 秒后不再显示"已保存"状态
 */
export function CanvasToolbar({
	scriptName,
	stepCount,
	saving,
	savedAt,
	stepDelayMs,
	onStepDelayChange,
	isRunning,
	activeRunId,
	onOpenRunDialog,
	onCancel,
	onOpenVariables,
	varsDefs,
}: Props) {
	const navigate = useNavigate();
	// 当页面在独立新窗口中（history 只有一条记录）时隐藏返回按钮
	const isStandaloneWindow = window.history.length <= 1;

	return (
		<div className="flex items-center gap-2 px-4 h-12 border-b flex-shrink-0 bg-background z-10">
			{/* 返回按钮（独立窗口中隐藏） */}
			{!isStandaloneWindow && (
				<Button
					size="sm"
					variant="ghost"
					className="h-8 px-2 cursor-pointer"
					onClick={() => navigate('/automation')}
				>
					<ArrowLeft className="h-3.5 w-3.5 mr-1" />
					返回
				</Button>
			)}

			{/* 脚本名称 */}
			<div className="flex-1 min-w-0 flex items-center gap-2">
				<span className="text-sm font-semibold truncate">{scriptName}</span>
			</div>

			{/* 步骤数 */}
			<span className="text-xs text-muted-foreground">{stepCount} 个步骤</span>

			{/* 变量按钮 */}
			<Button
				size="sm"
				variant="ghost"
				className="h-8 px-2 cursor-pointer"
				onClick={onOpenVariables}
				title="脚本变量"
			>
				<Variable className="h-3.5 w-3.5 mr-1" />
				变量{varsDefs.length > 0 && ` (${varsDefs.length})`}
			</Button>

			{/* 步骤延迟设置 */}
			<div className="flex items-center gap-1.5">
				<Label className="text-xs text-muted-foreground whitespace-nowrap">
					步骤延迟
				</Label>
				<Input
					type="number"
					min={0}
					max={9999}
					value={stepDelayMs}
					onChange={(e) => {
						const raw = Number(e.target.value);
						const val = Number.isFinite(raw)
							? Math.min(9999, Math.max(0, raw))
							: 0;
						onStepDelayChange(val);
					}}
					className="h-7 w-20 text-xs"
				/>
				<span className="text-xs text-muted-foreground">ms</span>
			</div>

			{/* 保存状态（固定宽度，防止内容切换时导致相邻元素抖动） */}
			<span className="flex items-center gap-1 text-xs text-muted-foreground w-16">
				{saving ? (
					<>
						<Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
						保存中...
					</>
				) : savedAt && Date.now() - savedAt < 3000 ? (
					<>
						<CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
						已保存
					</>
				) : null}
			</span>

			{/* 运行 / 取消按钮 */}
			{isRunning ? (
				<Button
					size="sm"
					variant="destructive"
					className="h-8 cursor-pointer"
					onClick={onCancel}
				>
					<Square className="h-3.5 w-3.5 mr-1" />
					取消
				</Button>
			) : (
				<Button
					size="sm"
					className="h-8 cursor-pointer"
					disabled={stepCount === 0}
					onClick={onOpenRunDialog}
				>
					<Play className="h-3.5 w-3.5 mr-1" />
					运行
				</Button>
			)}

			{/* 运行状态徽章 */}
			{activeRunId && (
				<Badge variant="outline" className="text-xs font-mono">
					{isRunning ? (
						<>
							<Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
							运行中
						</>
					) : (
						'已完成'
					)}
				</Badge>
			)}
		</div>
	);
}
