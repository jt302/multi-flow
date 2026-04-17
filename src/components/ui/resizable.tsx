import * as React from 'react';

import { GripVertical } from 'lucide-react';
import {
	Group,
	Panel,
	Separator,
} from 'react-resizable-panels';

import { cn } from '@/lib/utils';

type ResizablePanelGroupProps = Omit<React.ComponentProps<typeof Group>, 'orientation'> & {
	direction?: 'horizontal' | 'vertical';
	orientation?: 'horizontal' | 'vertical';
};

const ResizablePanelGroup = ({
	className,
	direction,
	orientation,
	...props
}: ResizablePanelGroupProps) => (
	<Group
		orientation={orientation ?? direction}
		className={cn('flex h-full w-full', className)}
		{...(props as React.ComponentProps<typeof Group>)}
	/>
);

type ResizablePanelProps = React.ComponentProps<typeof Panel>;

function normalizeSize(size: ResizablePanelProps['defaultSize']) {
	return typeof size === 'number' ? `${size}%` : size;
}

const ResizablePanel = ({
	defaultSize,
	minSize,
	maxSize,
	collapsedSize,
	...props
}: ResizablePanelProps) => (
	<Panel
		defaultSize={normalizeSize(defaultSize)}
		minSize={normalizeSize(minSize)}
		maxSize={normalizeSize(maxSize)}
		collapsedSize={normalizeSize(collapsedSize)}
		{...props}
	/>
);

const ResizableHandle = ({
	withHandle = true,
	className,
	...props
}: React.ComponentProps<typeof Separator> & {
	withHandle?: boolean;
}) => (
	<Separator
		className={cn(
			'relative flex w-px items-center justify-center bg-border/70 transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 hover:bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:-translate-y-1/2 aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:[&>div]:rotate-90',
			className,
		)}
		{...props}
	>
		{withHandle && (
			<div className="z-10 flex h-5 w-3 items-center justify-center rounded-full border border-border/80 bg-background shadow-sm">
				<GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
			</div>
		)}
	</Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
