import type { FieldErrors } from 'react-hook-form';

import type { ProfileFormValues } from '../model/profile-form';

type FormErrorListProps = {
	errors: FieldErrors<ProfileFormValues>;
	submitError: string | null;
};

const ERROR_FIELDS: Array<keyof ProfileFormValues> = [
	'name',
	'browserVersion',
	'platform',
	'devicePresetId',
	'browserBgColor',
	'startupUrl',
	'webrtcIpOverride',
	'customFontListText',
	'latitude',
	'longitude',
	'accuracy',
];

export function FormErrorList({ errors, submitError }: FormErrorListProps) {
	return (
		<>
			{submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
			{ERROR_FIELDS.map((field) => {
				const message = errors[field]?.message;
				return typeof message === 'string' ? (
					<p key={field} className="text-xs text-destructive">
						{message}
					</p>
				) : null;
			})}
		</>
	);
}
