import { Card, CardContent } from '@/components/ui';

export function GeneralSettingsPlaceholder() {
  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-md">
      <CardContent className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">语言、通知等通用设置即将推出</p>
      </CardContent>
    </Card>
  );
}
