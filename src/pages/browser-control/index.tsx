/**
 * 浏览器控制页面 — 窗口管理、标签页管理、文本输入
 * 从窗口同步页面拆分而来，独立为主导航入口
 */

import { WORKSPACE_SECTIONS } from '@/app/model/workspace-sections';
import { ActiveSectionCard } from '@/widgets/active-section-card/ui/active-section-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppWindow, LayoutList, Type } from 'lucide-react';

const section = WORKSPACE_SECTIONS['browser-control'];

export function BrowserControlRoutePage() {
	return (
		<div className="flex h-full min-h-0 w-full flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
			<ActiveSectionCard
				label="浏览器控制"
				title={section.title}
				description={section.desc}
			/>

			<Tabs defaultValue="window" className="flex-1 min-h-0">
				<TabsList className="h-9 bg-muted/40">
					<TabsTrigger value="window" className="text-xs h-7 px-3 cursor-pointer gap-1.5">
						<AppWindow className="h-3 w-3" />
						窗口管理
					</TabsTrigger>
					<TabsTrigger value="tab" className="text-xs h-7 px-3 cursor-pointer gap-1.5">
						<LayoutList className="h-3 w-3" />
						标签页管理
					</TabsTrigger>
					<TabsTrigger value="text" className="text-xs h-7 px-3 cursor-pointer gap-1.5">
						<Type className="h-3 w-3" />
						文本输入
					</TabsTrigger>
				</TabsList>

				<TabsContent value="window" className="mt-3">
					<Card className="border-border/40 bg-card/60 backdrop-blur-md">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm">窗口管理</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								窗口管理功能正在从窗口同步页面迁移中。
								当前可在「窗口同步」页面的配置标签页中使用完整的窗口管理功能。
							</p>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="tab" className="mt-3">
					<Card className="border-border/40 bg-card/60 backdrop-blur-md">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm">标签页管理</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								标签页批量操作功能正在从窗口同步页面迁移中。
								当前可在「窗口同步」页面的配置标签页中使用完整的标签页管理功能。
							</p>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="text" className="mt-3">
					<Card className="border-border/40 bg-card/60 backdrop-blur-md">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm">文本输入</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								文本广播输入功能正在从窗口同步页面迁移中。
								当前可在「窗口同步」页面的配置标签页中使用完整的文本输入功能。
							</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
