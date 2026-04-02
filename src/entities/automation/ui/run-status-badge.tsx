import { Badge } from '@/components/ui/badge';

export function RunStatusBadge({ status }: { status: string }) {
  const variantMap: Record<
    string,
    'default' | 'secondary' | 'destructive' | 'outline'
  > = {
    success: 'default',
    failed: 'destructive',
    running: 'secondary',
    pending: 'outline',
    cancelled: 'outline',
  };
  return (
    <Badge variant={variantMap[status] ?? 'outline'} className="text-xs h-5">
      {status}
    </Badge>
  );
}
