import { AlertTriangle, CheckCircle, Loader2, XCircle } from 'lucide-react';

export function StepStatusIcon({ status }: { status: string }) {
	if (status === 'success') return <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />;
	if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
	if (status === 'interrupted')
		return <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
	if (status === 'running')
		return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />;
	return <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0" />;
}
