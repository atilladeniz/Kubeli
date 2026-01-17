export const locales = ["system", "en", "de"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "system";

export const localeNames: Record<Locale, string> = {
  system: "System",
  en: "English",
  de: "Deutsch",
};

// Actual language codes (excluding "system")
export const languageCodes = ["en", "de"] as const;
export type LanguageCode = (typeof languageCodes)[number];

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function isValidLanguageCode(code: string): code is LanguageCode {
  return languageCodes.includes(code as LanguageCode);
}
