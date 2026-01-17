"use client";

import { useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";
import { getMessages } from "@/i18n/getMessages";
import type { Locale, LanguageCode } from "@/i18n/config";
import { defaultLocale, isValidLanguageCode } from "@/i18n/config";

// Import default messages synchronously for initial render
import enMessages from "@/i18n/messages/en.json";

interface I18nProviderProps {
  children: ReactNode;
}

// Detect system language
async function detectSystemLanguage(): Promise<LanguageCode> {
  try {
    // Try Tauri plugin first
    if (typeof window !== "undefined" && "__TAURI__" in window) {
      const { locale: osLocale } = await import("@tauri-apps/plugin-os");
      const detected = await osLocale();
      if (detected) {
        const langCode = detected.split("-")[0].toLowerCase();
        if (isValidLanguageCode(langCode)) {
          return langCode;
        }
      }
    }
  } catch {
    // Tauri not available
  }

  // Fallback to browser language
  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language.split("-")[0].toLowerCase();
    if (isValidLanguageCode(browserLang)) {
      return browserLang;
    }
  }

  return "en";
}

export function I18nProvider({ children }: I18nProviderProps) {
  const storeLocale = useUIStore((state) => state.settings.locale);
  const locale = storeLocale || defaultLocale;

  // Resolved language (actual language code, not "system")
  const [resolvedLanguage, setResolvedLanguage] = useState<LanguageCode>("en");
  const [messages, setMessages] = useState<Record<string, unknown>>(enMessages);
  const [isInitialized, setIsInitialized] = useState(false);

  // Resolve system language on mount and when locale changes
  useEffect(() => {
    async function resolveLanguage() {
      let lang: LanguageCode;

      if (locale === "system") {
        lang = await detectSystemLanguage();
      } else if (locale === "en" || locale === "de") {
        lang = locale;
      } else {
        lang = "en";
      }

      if (lang !== resolvedLanguage || !isInitialized) {
        const msgs = await getMessages(lang);
        setMessages(msgs);
        setResolvedLanguage(lang);
        setIsInitialized(true);
      }
    }

    resolveLanguage();
  }, [locale, resolvedLanguage, isInitialized]);

  return (
    <NextIntlClientProvider
      locale={resolvedLanguage}
      messages={messages}
      timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
      now={new Date()}
    >
      {children}
    </NextIntlClientProvider>
  );
}

// Hook to get current locale setting
export function useLocale(): Locale {
  return useUIStore((state) => state.settings.locale) || defaultLocale;
}

// Hook to change locale
export function useChangeLocale() {
  return useUIStore((state) => state.setLocale);
}
