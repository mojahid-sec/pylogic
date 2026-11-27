import translationsJson from '../data/translations.json';
import {
  applyLanguagePreference,
  loadUserPreferences,
} from '../services/preferencesRepository';
import type { LanguageCode, LocalizedText } from '../types/pylogic';

export type TranslationDictionary = typeof translationsJson.en;

export const translations: Record<LanguageCode, TranslationDictionary> = translationsJson;

export function getInitialLanguage(): LanguageCode {
  return loadUserPreferences().language;
}

export function applyLanguage(lang: LanguageCode): void {
  applyLanguagePreference(lang);
}

export function getTranslations(lang: LanguageCode): TranslationDictionary {
  return translations[lang] ?? translations.en;
}

export function pickText(text: LocalizedText, lang: LanguageCode): string {
  return text[lang] ?? text.en;
}
