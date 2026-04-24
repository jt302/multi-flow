import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { TIMEZONE_LIST } from '@/shared/lib/timezone-list';

type TimezoneComboboxProps = {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
};

export function TimezoneCombobox({
	value,
	onChange,
	disabled = false,
	placeholder,
}: TimezoneComboboxProps) {
	const { t } = useTranslation('profile');
	const [open, setOpen] = useState(false);
	const displayPlaceholder = placeholder ?? t('locale.timezonePlaceholder');

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className={cn(
						'h-9 w-full cursor-pointer justify-between px-3 font-normal',
						!value && 'text-muted-foreground',
					)}
				>
					<span className="truncate">{value || displayPlaceholder}</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
				<Command>
					<CommandInput placeholder={t('locale.timezoneSearch')} />
					<CommandList>
						<CommandEmpty>{t('locale.timezoneNotFound')}</CommandEmpty>
						<CommandGroup>
							{TIMEZONE_LIST.map((tz) => (
								<CommandItem
									key={tz}
									value={tz}
									onSelect={(selected) => {
										onChange(selected === value ? '' : selected);
										setOpen(false);
									}}
								>
									<Check
										className={cn('mr-2 h-4 w-4', value === tz ? 'opacity-100' : 'opacity-0')}
									/>
									{tz}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
