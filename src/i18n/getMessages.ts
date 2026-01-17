import type { LanguageCode } from "./config";

export async function getMessages(lang: LanguageCode) {
  try {
    return (await import(`./messages/${lang}.json`)).default;
  } catch {
    // Fallback to English
    return (await import("./messages/en.json")).default;
  }
}
