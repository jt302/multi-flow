import { useEffect, useState } from 'react';

import { Bug, Minus, Play, Plus } from 'lucide-react';

import type { ProfileItem } from '@/entities/profile/model/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

type VarEntry = { key: string; value: string };

type Props = {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	activeProfiles: ProfileItem[];
	allProfiles?: ProfileItem[];
	associatedProfileIds?: string[];
	isRunning: boolean;
	disabled: boolean;
	defaultVars?: VarEntry[];
	onRun: (profileIds: string[], initialVars: Record<string, string>) => void;
	onDebugRun: (profileId: string, initialVars: Record<string, string>) => void;
};

export function RunDialog({
	open,
	onOpenChange,
	activeProfiles,
	allProfiles = [],
	associatedProfileIds = [],
	isRunning,
	disabled,
	defaultVars,
	onRun,
	onDebugRun,
}: Props) {
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [varEntries, setVarEntries] = useState<VarEntry[]>(() => defaultVars ?? []);
	const [varsOpen, setVarsOpen] = useState(false);

	// 每次弹窗打开时重置为脚本默认变量 & 预选关联环境
	useEffect(() => {
		if (!open) return;
		setVarEntries(defaultVars ?? []);
		setVarsOpen((defaultVars ?? []).length > 0);
		if (associatedProfileIds.length > 0) {
			setSelectedIds([...associatedProfileIds]);
		} else {
			setSelectedIds([]);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- 只在 open 变化时触发
	}, [open]);

	const runningIds = new Set(activeProfiles.map((p) => p.id));
	const associatedButOffline = allProfiles.filter(
		(p) => associatedProfileIds.includes(p.id) && !runningIds.has(p.id)
	);
	const displayProfiles = [...activeProfiles, ...associatedButOffline];
	const allSelected = displayProfiles.length > 0 && selectedIds.length === displayProfiles.length;

	function toggleAll() {
		setSelectedIds(allSelected ? [] : displayProfiles.map((p) => p.id));
	}

	function toggleProfile(id: string) {
		setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
	}

	function addVar() {
		setVarEntries((prev) => [...prev, { key: '', value: '' }]);
		setVarsOpen(true);
	}

	function removeVar(i: number) {
		setVarEntries((prev) => prev.filter((_, idx) => idx !== i));
	}

	function setVarKey(i: number, key: string) {
		setVarEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, key } : e)));
	}

	function setVarValue(i: number, value: string) {
		setVarEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, value } : e)));
	}

	function buildVars(): Record<string, string> {
		const result: Record<string, string> = {};
		for (const { key, value } of varEntries) {
			if (key.trim()) result[key.trim()] = value;
		}
		return result;
	}

	function handleRun() {
		if (selectedIds.length === 0) return;
		onRun(selectedIds, buildVars());
		onOpenChange(false);
	}

	function handleDebugRun() {
		const profileId = selectedIds[0] ?? displayProfiles[0]?.id;
		if (!profileId) return;
		onDebugRun(profileId, buildVars());
		onOpenChange(false);
	}

	const canRun = selectedIds.length > 0 && !isRunning && !disabled;
	const canDebug = (selectedIds.length > 0 || displayProfiles.length > 0) && !isRunning && !disabled;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>运行脚本</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-1">
					{/* 环境选择 */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label className="text-sm font-medium">选择运行环境</Label>
							{displayProfiles.length > 1 && (
								<button
									type="button"
									onClick={toggleAll}
									className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
								>
									{allSelected ? '取消全选' : '全选'}
								</button>
							)}
						</div>
						{displayProfiles.length === 0 ? (
							<p className="text-sm text-muted-foreground py-2">没有可用的环境</p>
						) : (
							<ScrollArea className="max-h-48">
								<div className="space-y-1 pr-1">
									{displayProfiles.map((p) => {
										const isOffline = !runningIds.has(p.id);
										return (
											<label
												key={p.id}
												className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
											>
												<Checkbox
													checked={selectedIds.includes(p.id)}
													onCheckedChange={() => toggleProfile(p.id)}
													className="cursor-pointer"
												/>
												<span className="text-sm truncate flex-1">{p.name}</span>
												{isOffline && (
													<span className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/30 px-1 rounded flex-shrink-0">
														将自动启动
													</span>
												)}
											</label>
										);
									})}
								</div>
							</ScrollArea>
						)}
					</div>

					{/* 初始变量 */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<button
								type="button"
								onClick={() => setVarsOpen((v) => !v)}
								className="text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer"
							>
								初始变量 {varEntries.length > 0 && `(${varEntries.length})`}
							</button>
							<button
								type="button"
								onClick={addVar}
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
							>
								<Plus className="h-3 w-3" />
								添加
							</button>
						</div>
						{(varsOpen || varEntries.length > 0) && varEntries.length > 0 && (
							<div className="space-y-1.5">
								{varEntries.map((entry, i) => (
									<div key={i} className="flex items-center gap-1.5">
										<Input
											placeholder="变量名"
											value={entry.key}
											onChange={(e) => setVarKey(i, e.target.value)}
											className="h-7 text-xs font-mono"
										/>
										<span className="text-muted-foreground text-xs flex-shrink-0">=</span>
										<Input
											placeholder="初始值"
											value={entry.value}
											onChange={(e) => setVarValue(i, e.target.value)}
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
					</div>

					{/* 批量提示 */}
					{selectedIds.length > 1 && (
						<p className="text-xs text-muted-foreground">
							将并行在 {selectedIds.length} 个环境中运行
						</p>
					)}
				</div>

				<DialogFooter className="gap-2">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="cursor-pointer"
					>
						取消
					</Button>
					<Button
						variant="outline"
						onClick={handleDebugRun}
						disabled={!canDebug}
						className="cursor-pointer"
					>
						<Bug className="h-3.5 w-3.5 mr-1.5" />
						调试运行
					</Button>
					<Button
						onClick={handleRun}
						disabled={!canRun}
						className="cursor-pointer"
					>
						<Play className="h-3.5 w-3.5 mr-1.5" />
						{selectedIds.length > 1 ? `运行 (${selectedIds.length})` : '运行'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
