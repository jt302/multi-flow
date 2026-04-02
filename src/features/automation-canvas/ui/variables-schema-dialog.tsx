/**
 * variables-schema-dialog.tsx
 * 脚本变量定义对话框，用于新建/编辑脚本级别的预设变量。
 * 变量在步骤中通过 {{变量名}} 语法引用，运行时会预填到初始变量栏。
 */

import { useEffect, useState } from 'react';

import { Minus, Plus } from 'lucide-react';

import type { ScriptVarDef } from '@/entities/automation/model/types';
import { updateScriptVariablesSchema } from '@/entities/automation/api/automation-api';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Props = {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	/** 脚本 ID，用于持久化变量定义 */
	scriptId: string;
	/** 初始变量列表（对话框每次打开时重置为此值） */
	initialVars: ScriptVarDef[];
	/** 保存成功后的回调，传入更新后的变量列表 */
	onSaved: (vars: ScriptVarDef[]) => void;
};

/**
 * 脚本变量 Schema 编辑对话框
 * 支持添加、删除、编辑变量名和默认值。
 * 保存时会过滤掉空名称的条目，并持久化到后端。
 */
export function VariablesSchemaDialog({
	open,
	onOpenChange,
	scriptId,
	initialVars,
	onSaved,
}: Props) {
	const [vars, setVars] = useState<ScriptVarDef[]>(initialVars);
	const [saving, setSaving] = useState(false);

	// 每次打开对话框时重置为最新的 initialVars
	useEffect(() => {
		if (open) setVars(initialVars);
	}, [open, initialVars]);

	function addVar() {
		setVars((prev) => [...prev, { name: '', defaultValue: '' }]);
	}

	function removeVar(i: number) {
		setVars((prev) => prev.filter((_, idx) => idx !== i));
	}

	function setName(i: number, name: string) {
		setVars((prev) => prev.map((v, idx) => (idx === i ? { ...v, name } : v)));
	}

	function setDefault(i: number, defaultValue: string) {
		setVars((prev) =>
			prev.map((v, idx) => (idx === i ? { ...v, defaultValue } : v)),
		);
	}

	async function handleSave() {
		setSaving(true);
		try {
			// 过滤掉名称为空的变量
			const cleaned = vars.filter((v) => v.name.trim());
			await updateScriptVariablesSchema(scriptId, JSON.stringify(cleaned));
			onSaved(cleaned);
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>脚本变量</DialogTitle>
				</DialogHeader>
				<div className="space-y-2 py-1">
					<p className="text-xs text-muted-foreground">
						定义脚本预期的变量名和默认值，运行时会自动预填到初始变量栏。在步骤中使用{' '}
						<code className="bg-muted px-1 rounded">{'{{变量名}}'}</code> 引用。
					</p>
					{vars.length > 0 && (
						<div className="space-y-1.5">
							{vars.map((v, i) => (
								<div key={i} className="flex items-center gap-1.5">
									<Input
										placeholder="变量名"
										value={v.name}
										onChange={(e) => setName(i, e.target.value)}
										className="h-7 text-xs font-mono"
									/>
									<span className="text-muted-foreground text-xs flex-shrink-0">
										=
									</span>
									<Input
										placeholder="默认值（可选）"
										value={v.defaultValue}
										onChange={(e) => setDefault(i, e.target.value)}
										className="h-7 text-xs"
									/>
									<button
										type="button"
										onClick={() => removeVar(i)}
										className="text-muted-foreground hover:text-destructive cursor-pointer flex-shrink-0"
									>
										<Minus className="h-3.5 w-3.5" />
									</button>
								</div>
							))}
						</div>
					)}
					<button
						type="button"
						onClick={addVar}
						className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
					>
						<Plus className="h-3 w-3" />
						添加变量
					</button>
				</div>
				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="cursor-pointer"
					>
						取消
					</Button>
					<Button
						onClick={() => void handleSave()}
						disabled={saving}
						className="cursor-pointer"
					>
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
