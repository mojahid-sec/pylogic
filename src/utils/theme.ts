import {
  applyResolvedTheme,
  loadUserPreferences,
  resolveEffectiveTheme,
} from '../services/preferencesRepository';
import type { ThemeMode, ThemePreference } from '../types/pylogic';

export function getInitialThemePreference(): ThemePreference {
  return loadUserPreferences().themePreference;
}

export function getInitialTheme(): ThemeMode {
  return resolveEffectiveTheme(getInitialThemePreference());
}

export function applyThemePreference(preference: ThemePreference): ThemeMode {
  return applyResolvedTheme(preference);
}

export function applyTheme(theme: ThemeMode): void {
  applyResolvedTheme(theme);
}
