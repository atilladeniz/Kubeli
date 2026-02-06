// Re-export everything for easy imports
export { locales, localeNames, defaultLocale, isValidLocale } from "./config";
export type { Locale } from "./config";
export { getMessages } from "./getMessages";

// Re-export intl hooks for convenience
export { useTranslations, useLocale, useFormatter } from "next-intl";
