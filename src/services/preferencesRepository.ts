import type {
  LanguageCode,
  ReadingDensity,
  ThemeMode,
  ThemePreference,
  UserPreferences,
} from '../types/pylogic';
import { browserStorageAdapter } from './storageAdapter';

const PREFERENCES_KEY = 'pylogic-preferences';
const LEGACY_THEME_KEY = 'pylogic-theme';
const LEGACY_LANG_KEY = 'pylogic-lang';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  themePreference: 'system',
  language: 'en',
  readingDensity: 'comfortable',
  rememberLastPart: true,
  autoScrollOnStep: true,
  wrapSolutionCode: false,
  showSolvedIndicators: true,
  sidebarCollapsed: false,
};

function getDefaultSidebarCollapsed(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
  } catch {
    // Fallback cleanly in SSR
  }
  return false;
}

function getSystemThemeMode(): ThemeMode {
  try {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // Fallback cleanly in SSR or restricted environments
  }
  return 'light';
}

export function resolveEffectiveTheme(preference: ThemePreference): ThemeMode {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return getSystemThemeMode();
}

export function applyResolvedTheme(preference: ThemePreference): ThemeMode {
  const effective = resolveEffectiveTheme(preference);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (effective === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', effective);
    root.setAttribute('data-theme-preference', preference);
  }
  if (preference === 'system') {
    browserStorageAdapter.removeItem(LEGACY_THEME_KEY);
  } else {
    browserStorageAdapter.setItem(LEGACY_THEME_KEY, preference);
  }
  return effective;
}

export function applyLanguagePreference(lang: LanguageCode): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lang);
  }
  browserStorageAdapter.setItem(LEGACY_LANG_KEY, lang);
}

export function applyReadingDensity(density: ReadingDensity): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-density', density);
  }
}

export function sanitizeUserPreferences(raw: unknown): UserPreferences {
  const legacyTheme = browserStorageAdapter.getItem(LEGACY_THEME_KEY);
  const legacyLang = browserStorageAdapter.getItem(LEGACY_LANG_KEY);

  const fallbackTheme: ThemePreference =
    legacyTheme === 'light' || legacyTheme === 'dark' ? legacyTheme : 'system';
  const fallbackLang: LanguageCode = legacyLang === 'bn' ? 'bn' : 'en';

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...DEFAULT_USER_PREFERENCES,
      themePreference: fallbackTheme,
      language: fallbackLang,
      sidebarCollapsed: getDefaultSidebarCollapsed(),
    };
  }

  const parsed = raw as Partial<UserPreferences>;
  const themePreference: ThemePreference =
    parsed.themePreference === 'light' ||
    parsed.themePreference === 'dark' ||
    parsed.themePreference === 'system'
      ? parsed.themePreference
      : fallbackTheme;
  const language: LanguageCode =
    parsed.language === 'bn' || parsed.language === 'en' ? parsed.language : fallbackLang;
  const readingDensity: ReadingDensity =
    parsed.readingDensity === 'compact' ? 'compact' : 'comfortable';

  return {
    themePreference,
    language,
    readingDensity,
    rememberLastPart:
      typeof parsed.rememberLastPart === 'boolean'
        ? parsed.rememberLastPart
        : DEFAULT_USER_PREFERENCES.rememberLastPart,
    autoScrollOnStep:
      typeof parsed.autoScrollOnStep === 'boolean'
        ? parsed.autoScrollOnStep
        : DEFAULT_USER_PREFERENCES.autoScrollOnStep,
    wrapSolutionCode:
      typeof parsed.wrapSolutionCode === 'boolean'
        ? parsed.wrapSolutionCode
        : DEFAULT_USER_PREFERENCES.wrapSolutionCode,
    showSolvedIndicators:
      typeof parsed.showSolvedIndicators === 'boolean'
        ? parsed.showSolvedIndicators
        : DEFAULT_USER_PREFERENCES.showSolvedIndicators,
    sidebarCollapsed:
      typeof parsed.sidebarCollapsed === 'boolean'
        ? parsed.sidebarCollapsed
        : getDefaultSidebarCollapsed(),
  };
}

export function loadUserPreferences(): UserPreferences {
  const raw = browserStorageAdapter.getItem(PREFERENCES_KEY);
  if (!raw) {
    return sanitizeUserPreferences(null);
  }
  try {
    return sanitizeUserPreferences(JSON.parse(raw));
  } catch {
    return sanitizeUserPreferences(null);
  }
}

export function saveUserPreferences(prefs: UserPreferences): UserPreferences {
  browserStorageAdapter.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  applyResolvedTheme(prefs.themePreference);
  applyLanguagePreference(prefs.language);
  applyReadingDensity(prefs.readingDensity);
  return prefs;
}

export function resetUserPreferences(): UserPreferences {
  browserStorageAdapter.removeItem(PREFERENCES_KEY);
  browserStorageAdapter.removeItem(LEGACY_THEME_KEY);
  browserStorageAdapter.removeItem(LEGACY_LANG_KEY);
  const defaults = { ...DEFAULT_USER_PREFERENCES };
  applyResolvedTheme(defaults.themePreference);
  applyLanguagePreference(defaults.language);
  applyReadingDensity(defaults.readingDensity);
  return defaults;
}
