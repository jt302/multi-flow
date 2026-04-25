import { createContext } from 'react';

export type MarkdownCtxValue = {
	onImageClick?: (src: string) => void;
	streaming?: boolean;
};

export const MarkdownCtx = createContext<MarkdownCtxValue>({});
