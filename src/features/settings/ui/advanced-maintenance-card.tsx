import { Trash2 } from 'lucide-react';

import { Button, Card, CardContent, CardHeader, CardTitle, Icon } from '@/components/ui';

type AdvancedMaintenanceCardProps = {
  onOpenRecycleBin?: () => void;
};

export function AdvancedMaintenanceCard({ onOpenRecycleBin }: AdvancedMaintenanceCardProps) {
  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm transition-all duration-300">
      <CardHeader className="p-4 pb-2 border-b border-border/40">
        <CardTitle className="text-sm font-medium">高级维护</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">回收站</p>
          <p className="text-xs text-muted-foreground">恢复或彻底删除已归档的数据</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer border-border/40 bg-background/50 hover:bg-accent hover:text-accent-foreground backdrop-blur-sm transition-all hover:scale-105"
          onClick={onOpenRecycleBin}
          disabled={!onOpenRecycleBin}
        >
          <Icon icon={Trash2} size={14} className="mr-1" />
          打开回收站
        </Button>
      </CardContent>
    </Card>
  );
}
