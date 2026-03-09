type SectionTitleProps = {
	title: string;
	description: string;
};

export function SectionTitle({ title, description }: SectionTitleProps) {
	return (
		<div className="mb-2">
			<p className="text-sm font-semibold">{title}</p>
			<p className="text-xs text-muted-foreground">{description}</p>
		</div>
	);
}
