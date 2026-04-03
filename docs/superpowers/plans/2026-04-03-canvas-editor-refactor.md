# Canvas Editor Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the automation canvas editor with: start node replacing index numbers, reliable auto-save with UI indicators, cleaned-up save logic, and improved layout.

**Architecture:** Replace `#N` step numbering with a dedicated "Start" node (virtual, not persisted as a step). Rewrite save logic to use a single debounced auto-save timer + manual save button + window-close flush, eliminating dual-save race conditions. Clean up stale closure issues by consolidating ref sync points.

**Tech Stack:** React 19, @xyflow/react, Tailwind CSS, Tauri v2, Zustand, sonner toast

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/features/automation-canvas/ui/step-node.tsx` | Modify | Remove `#{index+1}`, add StartNode component |
| `src/features/automation-canvas/ui/canvas-toolbar.tsx` | Modify | Add save button, improve save indicator |
| `src/features/automation-canvas/ui/automation-canvas-page.tsx` | Modify | Layout polish, window close save |
| `src/features/automation-canvas/model/use-canvas-state.ts` | Modify | Rewrite save logic: single auto-save, manual save, close flush |
| `src/features/automation-canvas/model/canvas-helpers.ts` | Modify | Start node injection/stripping in parse/serialize |
| `src/features/automation-canvas/ui/step-properties-panel.tsx` | Modify | Minor: remove index references |
| `src/features/automation-canvas/ui/step-palette.tsx` | No change | Already clean |

---

### Task 1: Add Start Node — Virtual Entry Point

**Files:**
- Modify: `src/features/automation-canvas/ui/step-node.tsx`

The Start node is a visual-only node rendered by ReactFlow. It is NOT a step in the steps array. It connects to the first step via an edge.

- [ ] **Step 1: Add StartNode component and register in NODE_TYPES**

In `step-node.tsx`, add a new component above the existing `StepNodeComponent`:

```tsx
/** 虚拟起点节点 — 标识流程入口，不参与步骤数组 */
function StartNodeComponent() {
	return (
		<div className="flex items-center gap-1.5 rounded-full border-2 border-primary bg-primary/10 px-3 py-1.5 shadow-sm">
			<div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
			<span className="text-xs font-semibold text-primary">Start</span>
			<Handle
				type="source"
				position={Position.Bottom}
				className={HANDLE_CLS}
			/>
		</div>
	);
}
```

Update `NODE_TYPES`:

```tsx
export const NODE_TYPES = {
	step: StepNodeComponent,
	start: StartNodeComponent,
};
```

- [ ] **Step 2: Remove `#{index + 1}` from StepNodeComponent**

In `StepNodeComponent`, find and remove the index display span (line ~81):

```tsx
// DELETE this line:
<span className="text-[10px] text-muted-foreground font-mono">#{index + 1}</span>
```

The first line of the node header should now just be the category badge and kind label without any number prefix.

- [ ] **Step 3: Build and verify**

Run: `pnpm -s build`
Expected: Clean build, no TS errors

- [ ] **Step 4: Commit**

```bash
git add src/features/automation-canvas/ui/step-node.tsx
git commit -m "feat(canvas): add StartNode component, remove step index numbers"
```

---

### Task 2: Inject/Strip Start Node in Canvas State

**Files:**
- Modify: `src/features/automation-canvas/model/use-canvas-state.ts`
- Modify: `src/features/automation-canvas/model/canvas-helpers.ts`

The Start node must be injected when building canvas nodes and stripped before saving. It has a fixed ID `"start"` and connects to the first root node (inDegree=0).

- [ ] **Step 1: Add start node helpers in canvas-helpers.ts**

Add at the end of `canvas-helpers.ts`:

```typescript
// ─── Start Node Helpers ──────────────────────────────────────────────────────

export const START_NODE_ID = 'start';

/** 默认起点节点位置：在第一个步骤左上方 */
export function defaultStartPosition(positions: PositionsMap): { x: number; y: number } {
	const firstPos = positions['step-0'];
	return firstPos
		? { x: firstPos.x + 60, y: firstPos.y - 100 }
		: { x: 180, y: 20 };
}

/** 创建起点节点对象 */
export function buildStartNode(position: { x: number; y: number }): Node {
	return {
		id: START_NODE_ID,
		type: 'start',
		position,
		data: {},
		deletable: false,
		selectable: false,
		draggable: true,
	};
}

/** 创建起点到第一个根节点的边 */
export function buildStartEdge(rootStepId: string): Edge {
	return {
		id: `e-start-${rootStepId}`,
		source: START_NODE_ID,
		target: rootStepId,
		type: 'smoothstep',
	};
}

/** 从节点/边数组中移除起点相关数据（保存前调用） */
export function stripStartNode(
	nodes: Node[],
	edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
	return {
		nodes: nodes.filter((n) => n.id !== START_NODE_ID),
		edges: edges.filter(
			(e) => e.source !== START_NODE_ID && e.target !== START_NODE_ID,
		),
	};
}

/** 从 positions map 中提取起点位置（可能在 canvasPositionsJson 中保存） */
export function extractStartPosition(positions: PositionsMap): { x: number; y: number } | null {
	return positions[START_NODE_ID] ?? null;
}
```

Add necessary imports at the top of `canvas-helpers.ts`:

```typescript
import type { Node, Edge } from '@xyflow/react';
```

- [ ] **Step 2: Inject Start node during canvas initialization in use-canvas-state.ts**

In the `useCanvasState` hook, after building the initial nodes (around line 100), inject the Start node:

```typescript
// After buildNodes() call, inject Start node
const [nodes, setNodes] = useState<Node[]>(() => {
	const stepNodes = buildNodes(initFlatSteps, initPos, {});
	const startPos = extractStartPosition(initPos) ?? defaultStartPosition(initPos);
	const startNode = buildStartNode(startPos);
	return [startNode, ...stepNodes];
});

// Also inject start edge into initial edges
const [edges, setEdges] = useState<Edge[]>(() => {
	const base = edgesFromSave ? canvasEdges : reconstructedEdges;
	// Find root node (first step with inDegree=0)
	const inDeg = new Map<string, number>();
	for (const e of base) {
		inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
	}
	const rootId = initFlatSteps.length > 0
		? `step-${Array.from({ length: initFlatSteps.length }, (_, i) => i).find((i) => !inDeg.has(`step-${i}`)) ?? 0}`
		: null;
	const startEdge = rootId ? buildStartEdge(rootId) : null;
	return startEdge ? [startEdge, ...base] : base;
});
```

- [ ] **Step 3: Strip Start node before saving**

In the `saveScript` function, strip start data before serialization. Find `serializeControlFlowGraph(newSteps, edgesRef.current, positionsRef.current)` and strip before:

```typescript
const { edges: stepEdges } = stripStartNode([], edgesRef.current);
const stepPositions = { ...positionsRef.current };
delete stepPositions[START_NODE_ID];

const { nestedSteps, flatSteps, orderedIds, remappedEdges, remappedPositions, orphanedCount } =
	serializeControlFlowGraph(newSteps, stepEdges, stepPositions);
```

After remapping, re-inject the Start node:

```typescript
// After setNodes/setEdges with remapped data, re-inject Start
setNodes((prev) => {
	const startNode = prev.find((n) => n.id === START_NODE_ID);
	const stepNodes = orderedIds.map(/* ... existing mapping ... */);
	return startNode ? [startNode, ...stepNodes] : stepNodes;
});

// Re-inject Start edge
setEdges((prev) => {
	const startEdge = prev.find((e) => e.source === START_NODE_ID);
	return startEdge ? [startEdge, ...remappedEdges] : remappedEdges;
});
```

- [ ] **Step 4: Update scheduleCanvasSave to include Start position**

In `scheduleCanvasSave`, include the Start node position so it persists:

```typescript
const scheduleCanvasSave = useCallback(
	(pos: PositionsMap, edgs: Edge[]) => {
		if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			const { edges: stepEdges } = stripStartNode([], edgs);
			const data = {
				positions: pos, // Start position included naturally via positionsRef
				edges: stepEdges.map((e) => ({
					id: e.id,
					source: e.source,
					target: e.target,
					sourceHandle: e.sourceHandle ?? null,
				})),
			};
			void updateScriptCanvasPositions(script.id, JSON.stringify(data));
		}, 500);
	},
	[script.id],
);
```

- [ ] **Step 5: Update onNodesChange to sync Start position**

In `onNodesChange`, ensure Start node position is synced to positionsRef:

```typescript
// Inside the position change handler, add:
if (c.id === START_NODE_ID && c.type === 'position' && c.position) {
	positionsRef.current = {
		...positionsRef.current,
		[START_NODE_ID]: c.position,
	};
	if (!c.dragging) {
		scheduleCanvasSave(positionsRef.current, edgesRef.current);
	}
	return; // Don't process as step node
}
```

- [ ] **Step 6: Update onConnect to handle Start node connections**

When user drags from Start to a step node, update the start edge:

```typescript
// In onConnect, add at the beginning:
if (connection.source === START_NODE_ID) {
	setEdges((prev) => {
		// Remove old start edge
		const filtered = prev.filter((e) => e.source !== START_NODE_ID);
		const next = addEdge({ ...connection, type: 'smoothstep' }, filtered);
		edgesRef.current = next;
		scheduleCanvasSave(positionsRef.current, next);
		return next;
	});
	return; // Don't trigger full saveScript for start edge changes
}
```

- [ ] **Step 7: Build and verify**

Run: `pnpm -s build`
Expected: Clean build

- [ ] **Step 8: Commit**

```bash
git add src/features/automation-canvas/model/canvas-helpers.ts src/features/automation-canvas/model/use-canvas-state.ts
git commit -m "feat(canvas): inject virtual Start node, strip before save"
```

---

### Task 3: Rewrite Save Logic — Single Auto-Save + Manual Save

**Files:**
- Modify: `src/features/automation-canvas/model/use-canvas-state.ts`
- Modify: `src/features/automation-canvas/ui/canvas-toolbar.tsx`

Current dual-save (`saveScript` + `scheduleCanvasSave`) causes race conditions. Replace with a single unified save flow:

1. **Auto-save:** 2-second debounce after ANY change (steps, edges, positions)
2. **Manual save:** Button in toolbar, calls save immediately
3. **Window close:** Flush pending save on unmount

- [ ] **Step 1: Replace dual-save with unified `scheduleSave` in use-canvas-state.ts**

Remove `scheduleCanvasSave` and replace with a single `scheduleSave` function. The key change: every mutation marks state as dirty, and a single debounced timer handles all saves.

```typescript
// Replace both saveTimerRef and the dual-save approach with:
const dirtyRef = useRef(false);
const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

/** 标记数据已变更，启动自动保存计时 */
const markDirty = useCallback(() => {
	dirtyRef.current = true;
	if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
	autoSaveTimerRef.current = setTimeout(() => {
		autoSaveTimerRef.current = null;
		void performSave();
	}, 2000);
}, [/* performSave */]);

/** 立即保存（手动触发或窗口关闭时调用） */
const saveNow = useCallback(async () => {
	if (autoSaveTimerRef.current) {
		clearTimeout(autoSaveTimerRef.current);
		autoSaveTimerRef.current = null;
	}
	await performSave();
}, [/* performSave */]);

/** 核心保存逻辑（原 saveScript 提取） */
const performSave = useCallback(async () => {
	if (!dirtyRef.current) return; // 无变更则跳过
	dirtyRef.current = false;
	setSaving(true);
	try {
		const currentSteps = pendingStepsRef.current ?? steps;
		pendingStepsRef.current = null;
		if (updateSaveTimerRef.current) {
			clearTimeout(updateSaveTimerRef.current);
			updateSaveTimerRef.current = null;
		}

		const { edges: stepEdges } = stripStartNode([], edgesRef.current);
		const stepPositions = { ...positionsRef.current };
		delete stepPositions[START_NODE_ID];

		const { nestedSteps, flatSteps, orderedIds, remappedEdges, remappedPositions, orphanedCount } =
			serializeControlFlowGraph(currentSteps, stepEdges, stepPositions);

		// ... (existing node/edge remapping logic from saveScript) ...

		await saveAutomationCanvasGraph(script.id, {
			steps: nestedSteps,
			positionsJson: buildCanvasJson(remappedPositions, remappedEdges),
			settings: buildNextSettings(),
		});
		void emitScriptUpdated(script.id);
		setSavedAt(Date.now());
	} catch (err) {
		dirtyRef.current = true; // 保存失败，重新标记脏
		console.error('[canvas] save failed:', err);
		toast.error('保存失败，请重试');
	} finally {
		setSaving(false);
	}
}, [steps, script.id, /* ... other deps */]);
```

- [ ] **Step 2: Update all mutation points to use `markDirty()`**

Replace all `scheduleCanvasSave(...)` and `void saveScript(...)` / `queueMicrotask(...)` calls with `markDirty()`:

In `onNodesChange` (position changes):
```typescript
// Replace: scheduleCanvasSave(positionsRef.current, edgesRef.current);
// With:
markDirty();
```

In `onEdgesChange`:
```typescript
// Replace the queueMicrotask block with:
markDirty();
```

In `onConnect`:
```typescript
// Replace the queueMicrotask block with:
markDirty();
```

In `updateStep`:
```typescript
// Replace the 300ms debounce timer with:
pendingStepsRef.current = newSteps;
markDirty();
// Remove updateSaveTimerRef usage entirely
```

In `addStep`, `deleteStep`, `pasteSteps`:
```typescript
// Replace: await saveScript(newSteps);
// With:
pendingStepsRef.current = newSteps;
dirtyRef.current = true;
await performSave(); // 结构变更立即保存
```

- [ ] **Step 3: Add window-close flush via useEffect cleanup**

```typescript
// Replace existing unmount cleanup with:
useEffect(() => {
	const handleBeforeUnload = () => {
		if (dirtyRef.current) {
			// Sync save on window close - fire and forget
			const currentSteps = pendingStepsRef.current ?? steps;
			const { edges: stepEdges } = stripStartNode([], edgesRef.current);
			const stepPositions = { ...positionsRef.current };
			delete stepPositions[START_NODE_ID];
			// Use navigator.sendBeacon or sync XHR as fallback
			void saveAutomationCanvasGraph(script.id, {
				steps: serializeControlFlowGraph(currentSteps, stepEdges, stepPositions).nestedSteps,
				positionsJson: buildCanvasJson(stepPositions, stepEdges),
				settings: buildNextSettings(),
			});
		}
	};
	window.addEventListener('beforeunload', handleBeforeUnload);
	return () => {
		window.removeEventListener('beforeunload', handleBeforeUnload);
		// Also flush on React unmount
		if (dirtyRef.current) {
			handleBeforeUnload();
		}
		if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
	};
}, [script.id, steps]);
```

- [ ] **Step 4: Export `saveNow` and `dirtyRef` from hook**

Add to the return value of `useCanvasState`:

```typescript
return {
	// ... existing exports
	saveNow,     // 手动保存
	isDirty: dirtyRef.current, // 未保存标记
};
```

Update `CanvasStateReturn` type to include:
```typescript
saveNow: () => Promise<void>;
```

- [ ] **Step 5: Build and verify**

Run: `pnpm -s build`
Expected: Clean build

- [ ] **Step 6: Commit**

```bash
git add src/features/automation-canvas/model/use-canvas-state.ts
git commit -m "refactor(canvas): unified auto-save with 2s debounce, manual save, window-close flush"
```

---

### Task 4: Toolbar — Add Save Button + Improve Status Indicator

**Files:**
- Modify: `src/features/automation-canvas/ui/canvas-toolbar.tsx`
- Modify: `src/features/automation-canvas/ui/automation-canvas-page.tsx`

- [ ] **Step 1: Add save button and pass saveNow to toolbar**

In `canvas-toolbar.tsx`, add a save button next to the save status indicator. Update the Props type:

```typescript
type Props = {
	// ... existing props
	onSave: () => void; // 新增：手动保存回调
};
```

Replace the save status section (around line 130) with:

```tsx
{/* 保存按钮 + 状态 */}
<div className="flex items-center gap-1.5">
	<Button
		variant="ghost"
		size="icon"
		className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
		title="保存 (Cmd+S)"
		onClick={onSave}
		disabled={saving}
	>
		{saving ? (
			<Loader2 className="h-3.5 w-3.5 animate-spin" />
		) : (
			<Save className="h-3.5 w-3.5" />
		)}
	</Button>
	<span className="text-[10px] text-muted-foreground w-10">
		{saving
			? '保存中'
			: savedAt && Date.now() - savedAt < 3000
				? '已保存'
				: null}
	</span>
</div>
```

Add `Save` to the lucide-react imports.

- [ ] **Step 2: Pass saveNow to toolbar in automation-canvas-page.tsx**

```tsx
<CanvasToolbar
	// ... existing props
	onSave={() => void saveNow()}
/>
```

- [ ] **Step 3: Add Cmd+S keyboard shortcut**

In `automation-canvas-page.tsx`, add to `handleKeyDown`:

```typescript
// Cmd/Ctrl+S: Save
if ((e.metaKey || e.ctrlKey) && e.key === 's') {
	e.preventDefault();
	void saveNow();
	return;
}
```

- [ ] **Step 4: Build and verify**

Run: `pnpm -s build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add src/features/automation-canvas/ui/canvas-toolbar.tsx src/features/automation-canvas/ui/automation-canvas-page.tsx
git commit -m "feat(canvas): add manual save button with Cmd+S shortcut"
```

---

### Task 5: Debug & Stabilize — Fix Known Race Conditions

**Files:**
- Modify: `src/features/automation-canvas/model/use-canvas-state.ts`

This task addresses the known issues found during exploration.

- [ ] **Step 1: Fix orphaned node handling — reliable detection and toast**

After `performSave` completes topology sort, if `orphanedCount > 0`, show toast with action:

```typescript
if (orphanedCount > 0) {
	const orphanedNames = flatSteps
		.slice(flatSteps.length - orphanedCount)
		.map((s) => KIND_LABELS[s.kind] || s.kind)
		.join('、');
	toast.warning(`${orphanedCount} 个步骤未连接到流程中：${orphanedNames}`, {
		duration: 8000,
		action: {
			label: '删除孤立步骤',
			onClick: () => {
				const kept = flatSteps.slice(0, flatSteps.length - orphanedCount);
				pendingStepsRef.current = kept;
				dirtyRef.current = true;
				void performSave();
			},
		},
	});
}
```

- [ ] **Step 2: Fix confirm_dialog button edge cleanup**

In `updateStep`, when a confirm_dialog step's buttons change, clean up orphaned edges immediately:

```typescript
if (step.kind === 'confirm_dialog' && step.button_branches) {
	const btnCount = step.button_branches.length;
	setEdges((prev) => {
		const cleaned = prev.filter((e) => {
			if (e.source !== `step-${index}`) return true;
			const handle = e.sourceHandle;
			if (!handle || !handle.startsWith('btn_')) return true;
			const btnIdx = parseInt(handle.replace('btn_', ''), 10);
			return !isNaN(btnIdx) && btnIdx < btnCount;
		});
		if (cleaned.length !== prev.length) {
			edgesRef.current = cleaned;
			markDirty();
		}
		return cleaned;
	});
}
```

- [ ] **Step 3: Add error boundary for save failures**

Ensure `performSave` catches all errors and re-marks dirty:

```typescript
} catch (err) {
	dirtyRef.current = true; // Re-mark dirty so next auto-save retries
	console.error('[canvas] save failed:', err);
	toast.error('保存失败，将在下次自动保存时重试');
} finally {
	setSaving(false);
}
```

- [ ] **Step 4: Build and verify**

Run: `pnpm -s build`
Expected: Clean build

- [ ] **Step 5: Commit**

```bash
git add src/features/automation-canvas/model/use-canvas-state.ts
git commit -m "fix(canvas): stabilize save logic, fix orphaned node handling and edge cleanup"
```

---

### Task 6: Layout Polish

**Files:**
- Modify: `src/features/automation-canvas/ui/automation-canvas-page.tsx`
- Modify: `src/features/automation-canvas/ui/step-node.tsx`

- [ ] **Step 1: Improve node visual styling — remove number, widen nodes**

In `step-node.tsx`, update the node container to allow slightly wider content now that index is gone:

```tsx
// Change min-w and max-w
className="relative min-w-[180px] max-w-[260px] rounded-lg border bg-background shadow-sm px-3 py-2.5 cursor-pointer"
```

Update the header to remove the gap where `#{index}` was. The header should be:

```tsx
<div className="flex items-center gap-1.5 mb-1">
	<span className={`text-[10px] font-medium px-1 rounded border ${colorClass}`}>
		{group}
	</span>
</div>
```

- [ ] **Step 2: Improve canvas background for dark mode**

In `automation-canvas-page.tsx`, update the Background component:

```tsx
<Background
	variant={BackgroundVariant.Dots}
	gap={20}
	size={1}
	className="!bg-transparent"
	color="var(--muted-foreground)"
	style={{ opacity: 0.3 }}
/>
```

- [ ] **Step 3: Build and verify**

Run: `pnpm -s build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add src/features/automation-canvas/ui/step-node.tsx src/features/automation-canvas/ui/automation-canvas-page.tsx
git commit -m "refactor(canvas): polish node styling and canvas background"
```

---

### Task 7: Final Integration Test

- [ ] **Step 1: Full build verification**

```bash
pnpm -s build && cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: Both clean

- [ ] **Step 2: Manual test checklist**

1. Open canvas editor → Start node visible at top, no `#N` numbers on steps
2. Connect Start → first step → edge draws correctly
3. Drag Start node → position saved after 2s
4. Edit step property → auto-saved after 2s, "保存中" → "已保存" in toolbar
5. Press Cmd+S → immediate save with status indicator
6. Delete an edge → orphaned step toast appears with delete button
7. Close canvas window → pending changes flushed (reopen to verify)
8. Add new step → immediately saved, Start edge maintained
9. Delete step → edges cleaned up, Start edge reconnected if needed

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "test(canvas): verify canvas editor refactor integration"
```
