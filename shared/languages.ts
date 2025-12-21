/**
 * Common languages for translation projects
 * Format: { code: string, name: string, nativeName: string, rtl: boolean }
 */

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
}

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English", rtl: false },
  { code: "es", name: "Spanish", nativeName: "Español", rtl: false },
  { code: "fr", name: "French", nativeName: "Français", rtl: false },
  { code: "de", name: "German", nativeName: "Deutsch", rtl: false },
  { code: "it", name: "Italian", nativeName: "Italiano", rtl: false },
  { code: "pt", name: "Portuguese", nativeName: "Português", rtl: false },
  { code: "ru", name: "Russian", nativeName: "Русский", rtl: false },
  { code: "ja", name: "Japanese", nativeName: "日本語", rtl: false },
  { code: "ko", name: "Korean", nativeName: "한국어", rtl: false },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", rtl: false },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "繁體中文", rtl: false },
  { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true },
  { code: "he", name: "Hebrew", nativeName: "עברית", rtl: true },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", rtl: false },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", rtl: false },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", rtl: false },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", rtl: false },
  { code: "pl", name: "Polish", nativeName: "Polski", rtl: false },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", rtl: false },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", rtl: false },
  { code: "th", name: "Thai", nativeName: "ไทย", rtl: false },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", rtl: false },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", rtl: false },
  { code: "fa", name: "Persian", nativeName: "فارسی", rtl: true },
  { code: "ur", name: "Urdu", nativeName: "اردو", rtl: true },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", rtl: false },
];

/**
 * Get language by code
 */
export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES.find(lang => lang.code === code);
}

/**
 * Check if a language is RTL (right-to-left)
 */
export function isRTL(languageCode: string): boolean {
  const lang = getLanguageByCode(languageCode);
  return lang?.rtl || false;
}

/**
 * Detect browser language and return matching language code
 * Falls back to 'es' if no match found
 */
export function detectBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return 'es';
  
  const browserLang = navigator.language || (navigator as any).userLanguage;
  if (!browserLang) return 'es';
  
  // Try exact match first
  const exactMatch = LANGUAGES.find(lang => lang.code === browserLang);
  if (exactMatch) return exactMatch.code;
  
  // Try matching just the language part (e.g., 'en' from 'en-US')
  const langCode = browserLang.split('-')[0];
  const partialMatch = LANGUAGES.find(lang => lang.code === langCode);
  if (partialMatch) return partialMatch.code;
  
  // Default to Spanish
  return 'es';
}
