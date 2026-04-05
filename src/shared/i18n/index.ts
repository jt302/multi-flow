import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCommon from './locales/zh-CN/common.json';
import zhNav from './locales/zh-CN/nav.json';
import zhProfile from './locales/zh-CN/profile.json';
import zhProxy from './locales/zh-CN/proxy.json';
import zhGroup from './locales/zh-CN/group.json';
import zhWindow from './locales/zh-CN/window.json';
import zhAutomation from './locales/zh-CN/automation.json';
import zhSettings from './locales/zh-CN/settings.json';
import zhRecycle from './locales/zh-CN/recycle.json';
import zhDevice from './locales/zh-CN/device.json';
import zhDashboard from './locales/zh-CN/dashboard.json';
import zhLog from './locales/zh-CN/log.json';
import zhPlugin from './locales/zh-CN/plugin.json';
import zhCanvas from './locales/zh-CN/canvas.json';
import zhChat from './locales/zh-CN/chat.json';

import enCommon from './locales/en-US/common.json';
import enNav from './locales/en-US/nav.json';
import enProfile from './locales/en-US/profile.json';
import enProxy from './locales/en-US/proxy.json';
import enGroup from './locales/en-US/group.json';
import enWindow from './locales/en-US/window.json';
import enAutomation from './locales/en-US/automation.json';
import enSettings from './locales/en-US/settings.json';
import enRecycle from './locales/en-US/recycle.json';
import enDevice from './locales/en-US/device.json';
import enDashboard from './locales/en-US/dashboard.json';
import enLog from './locales/en-US/log.json';
import enPlugin from './locales/en-US/plugin.json';
import enCanvas from './locales/en-US/canvas.json';
import enChat from './locales/en-US/chat.json';

export const defaultNS = 'common';
export const resources = {
	'zh-CN': {
		common: zhCommon,
		nav: zhNav,
		profile: zhProfile,
		proxy: zhProxy,
		group: zhGroup,
		window: zhWindow,
		automation: zhAutomation,
		settings: zhSettings,
		recycle: zhRecycle,
		device: zhDevice,
		dashboard: zhDashboard,
		log: zhLog,
		plugin: zhPlugin,
		canvas: zhCanvas,
		chat: zhChat,
	},
	'en-US': {
		common: enCommon,
		nav: enNav,
		profile: enProfile,
		proxy: enProxy,
		group: enGroup,
		window: enWindow,
		automation: enAutomation,
		settings: enSettings,
		recycle: enRecycle,
		device: enDevice,
		dashboard: enDashboard,
		log: enLog,
		plugin: enPlugin,
		canvas: enCanvas,
		chat: enChat,
	},
} as const;

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		defaultNS,
		fallbackLng: 'zh-CN',
		interpolation: {
			escapeValue: false,
		},
		nsSeparator: ':',
		keySeparator: '.',
		detection: {
			order: ['localStorage', 'navigator'],
			lookupLocalStorage: 'i18nextLng',
			caches: ['localStorage'],
		},
	});

export default i18n;
