import {
  ArrowRight,
  Download,
  HardDrive,
  Monitor,
  Moon,
  Sun,
  Upload,
} from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import {
  type BackupImportSummary,
  downloadPlatformBackupJson,
  MAX_BACKUP_FILE_BYTES,
  parseAndValidateBackupJson,
  type PlatformBackupSnapshot,
} from '../services/dataExportService';
import type {
  LanguageCode,
  ProjectWorkspaceMap,
  ReadingDensity,
  SectionId,
  ThemeMode,
  ThemePreference,
  UserPreferences,
} from '../types/pylogic';
import { getTranslations, pickText } from '../utils/language';
import { curriculumData } from '../utils/progress';

interface SettingsViewProps {
  preferences: UserPreferences;
  resolvedTheme: ThemeMode;
  solvedCount: number;
  projectWorkspaceMap: ProjectWorkspaceMap;
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void;
  onResetPreferences: () => void;
  onResetLogicProgress: () => void;
  onResetProjectWorkspaces: () => void;
  onImportBackup: (snapshot: PlatformBackupSnapshot) => void;
  onNavigate: (section: SectionId) => void;
  onNotify: (message: string) => void;
}

type ConfirmTarget = 'preferences' | 'logic' | 'projects' | null;

interface PendingBackupImport {
  snapshot: PlatformBackupSnapshot;
  summary: BackupImportSummary;
}

export function SettingsView({
  preferences,
  resolvedTheme,
  solvedCount,
  projectWorkspaceMap,
  onUpdatePreferences,
  onResetPreferences,
  onResetLogicProgress,
  onResetProjectWorkspaces,
  onImportBackup,
  onNavigate,
  onNotify,
}: SettingsViewProps) {
  const language: LanguageCode = preferences.language;
  const t = getTranslations(language);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [pendingImport, setPendingImport] = useState<PendingBackupImport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeProjectCount = Object.values(projectWorkspaceMap).filter(
    (entry) =>
      entry.status !== 'Not Started' ||
      Object.values(entry.notes).some(
        (val) => typeof val === 'string' && val.trim().length > 0
      ) ||
      Boolean(entry.checklist && Object.values(entry.checklist).some(Boolean))
  ).length;

  const handleThemeChange = (themePreference: ThemePreference) => {
    onUpdatePreferences({ themePreference });
  };

  const handleLanguageChange = (nextLang: LanguageCode) => {
    if (nextLang === preferences.language) {
      return;
    }
    onUpdatePreferences({ language: nextLang });
    const nextT = getTranslations(nextLang);
    onNotify(nextT.controls.languageSwitched);
  };

  const handleDensityChange = (readingDensity: ReadingDensity) => {
    onUpdatePreferences({ readingDensity });
  };

  const handleToggleBoolean = (
    key: 'rememberLastPart' | 'autoScrollOnStep' | 'wrapSolutionCode' | 'showSolvedIndicators'
  ) => {
    onUpdatePreferences({ [key]: !preferences[key] });
  };

  const handleExportJson = () => {
    const ok = downloadPlatformBackupJson();
    onNotify(ok ? t.settings.exportSuccessNotice : t.settings.exportErrorNotice);
  };

  const handleSelectBackupFile = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleBackupFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setPendingImport(null);
      setImportError(t.settings.importFileTooLargeError);
      return;
    }

    try {
      const rawText = await file.text();
      const result = parseAndValidateBackupJson(rawText);
      if (!result.ok) {
        setPendingImport(null);
        setImportError(
          result.errorCode === 'file_too_large'
            ? t.settings.importFileTooLargeError
            : result.errorCode === 'invalid_json'
              ? t.settings.importInvalidJsonError
              : t.settings.importInvalidSchemaError
        );
        return;
      }

      setImportError(null);
      setPendingImport({
        snapshot: result.snapshot,
        summary: result.summary,
      });
    } catch {
      setPendingImport(null);
      setImportError(t.settings.importInvalidJsonError);
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImport) {
      return;
    }
    onImportBackup(pendingImport.snapshot);
    setPendingImport(null);
    setImportError(null);
    onNotify(t.settings.importSuccessNotice);
  };

  const handleCancelImport = () => {
    setPendingImport(null);
    setImportError(null);
  };

  const handleConfirmReset = (target: Exclude<ConfirmTarget, null>) => {
    if (target === 'preferences') {
      onResetPreferences();
      onNotify(t.settings.preferencesResetNotice);
    } else if (target === 'logic') {
      onResetLogicProgress();
      onNotify(t.settings.logicProgressResetNotice);
    } else if (target === 'projects') {
      onResetProjectWorkspaces();
      onNotify(t.settings.projectWorkspacesResetNotice);
    }
    setConfirmTarget(null);
  };

  const themeOptions: Array<{
    value: ThemePreference;
    label: string;
    icon: typeof Sun;
  }> = [
    { value: 'light', label: t.settings.themeLight, icon: Sun },
    { value: 'dark', label: t.settings.themeDark, icon: Moon },
    { value: 'system', label: t.settings.themeSystem, icon: Monitor },
  ];

  const booleanToggles: Array<{
    key: 'rememberLastPart' | 'autoScrollOnStep' | 'wrapSolutionCode' | 'showSolvedIndicators';
    label: string;
    description: string;
  }> = [
    {
      key: 'rememberLastPart',
      label: t.settings.rememberLastPartLabel,
      description: t.settings.rememberLastPartDesc,
    },
    {
      key: 'autoScrollOnStep',
      label: t.settings.autoScrollLabel,
      description: t.settings.autoScrollDesc,
    },
    {
      key: 'wrapSolutionCode',
      label: t.settings.wrapCodeLabel,
      description: t.settings.wrapCodeDesc,
    },
    {
      key: 'showSolvedIndicators',
      label: t.settings.showSolvedLabel,
      description: t.settings.showSolvedDesc,
    },
  ];

  const formattedImportDate = pendingImport?.summary.exportedAt
    ? (() => {
        const ms = Date.parse(pendingImport.summary.exportedAt);
        if (Number.isNaN(ms)) {
          return pendingImport.summary.exportedAt;
        }
        return new Date(ms).toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
      })()
    : '';

  return (
    <div className="view-enter space-y-8">
      {/* Header */}
      <section className="max-w-3xl">
        <p className="text-xs font-code text-[var(--text-secondary)]">
          {t.settings.kicker}
        </p>
        <h1 className="mt-2 font-editorial text-3xl sm:text-4xl font-normal tracking-[-0.02em] text-[var(--text-primary)]">
          {t.settings.heading}
        </h1>
        <p className="mt-3 text-[15px] text-[var(--text-secondary)] leading-relaxed">
          {t.settings.intro}
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Appearance, Language, Display Preferences */}
        <div className="lg:col-span-7 space-y-6">
          {/* A. Appearance */}
          <section
            aria-labelledby="settings-appearance-heading"
            className="surface-card rounded-lg p-6 space-y-5"
          >
            <div>
              <h2
                id="settings-appearance-heading"
                className="font-editorial text-xl font-normal text-[var(--text-primary)]"
              >
                {t.settings.sectionAppearanceTitle}
              </h2>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                {t.settings.sectionAppearanceDesc}
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label={t.settings.sectionAppearanceTitle}
              className="grid grid-cols-3 gap-2.5"
            >
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const selected = preferences.themePreference === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleThemeChange(option.value)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      selected ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs font-code text-[var(--text-muted)]">
              {t.settings.effectiveThemePrefix}:{' '}
              <span className="text-[var(--text-primary)]">
                {resolvedTheme === 'dark' ? t.settings.themeDark : t.settings.themeLight}
              </span>
            </p>
          </section>

          {/* B. Language */}
          <section
            aria-labelledby="settings-language-heading"
            className="surface-card rounded-lg p-6 space-y-5"
          >
            <div>
              <h2
                id="settings-language-heading"
                className="font-editorial text-xl font-normal text-[var(--text-primary)]"
              >
                {t.settings.sectionLanguageTitle}
              </h2>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                {t.settings.sectionLanguageDesc}
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label={t.settings.sectionLanguageTitle}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {(
                [
                  {
                    code: 'en' as const,
                    title: t.settings.languageEnglishLabel,
                    note: t.settings.languageEnglishNote,
                  },
                  {
                    code: 'bn' as const,
                    title: t.settings.languageBanglaLabel,
                    note: t.settings.languageBanglaNote,
                  },
                ] as const
              ).map((langOption) => {
                const selected = preferences.language === langOption.code;
                return (
                  <button
                    key={langOption.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleLanguageChange(langOption.code)}
                    className={`p-4 rounded-md border text-left transition-colors ${
                      selected
                        ? 'border-[var(--accent)] bg-[var(--bg-subtle)]'
                        : 'border-[var(--border-color)] hover:bg-[var(--hover-surface)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {langOption.title}
                      </span>
                      {selected && (
                        <span
                          aria-hidden="true"
                          className="w-2 h-2 bg-[var(--accent)] shrink-0"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {langOption.note}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* C. Display & Study Preferences */}
          <section
            aria-labelledby="settings-display-heading"
            className="surface-card rounded-lg p-6 space-y-5"
          >
            <div>
              <h2
                id="settings-display-heading"
                className="font-editorial text-xl font-normal text-[var(--text-primary)]"
              >
                {t.settings.sectionDisplayTitle}
              </h2>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                {t.settings.sectionDisplayDesc}
              </p>
            </div>

            {/* Reading Density */}
            <div className="pt-4 border-t surface-divider flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {t.settings.densityLabel}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {t.settings.densityDesc}
                </p>
              </div>
              <div
                role="radiogroup"
                aria-label={t.settings.densityLabel}
                className="inline-flex items-center gap-1 p-1 rounded-md bg-[var(--bg-subtle)] shrink-0"
              >
                {(
                  [
                    { value: 'comfortable', label: t.settings.densityComfortable },
                    { value: 'compact', label: t.settings.densityCompact },
                  ] as const
                ).map((d) => {
                  const selected = preferences.readingDensity === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleDensityChange(d.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                        selected
                          ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Study Behavior Toggles */}
            <div className="divide-y divide-[var(--border-color)] border-t surface-divider">
              {booleanToggles.map((item) => {
                const enabled = preferences[item.key];
                return (
                  <div
                    key={item.key}
                    className="py-4 first:pt-4 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={item.label}
                      onClick={() => handleToggleBoolean(item.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                        enabled
                          ? 'bg-[var(--accent)] border-[var(--accent)]'
                          : 'bg-[var(--bg-subtle)] border-[var(--border-color)]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full transition-transform ${
                          enabled
                            ? 'translate-x-6 bg-[var(--accent-contrast)]'
                            : 'translate-x-1 bg-[var(--text-secondary)]'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Column 2: Local Browser Storage, Backup & Privacy, About */}
        <div className="lg:col-span-5 space-y-6">
          {/* D. Local Browser Storage */}
          <section
            aria-labelledby="settings-storage-heading"
            className="surface-card rounded-lg p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="settings-storage-heading"
                className="font-editorial text-xl font-normal text-[var(--text-primary)] flex items-center gap-2"
              >
                <HardDrive className="w-4 h-4 text-[var(--text-secondary)] shrink-0" aria-hidden="true" />
                <span>{t.settings.sectionStorageTitle}</span>
              </h2>
              <span className="font-code text-[11px] px-2 py-0.5 border surface-divider rounded text-[var(--text-secondary)] whitespace-nowrap shrink-0">
                {t.settings.storageStatusBadge}
              </span>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {t.settings.sectionStorageDesc}
            </p>

            <div className="pt-3 border-t surface-divider space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--text-muted)]">
                  {t.settings.storageModeLabel}
                </span>
                <span className="font-code text-[var(--text-primary)] text-right">
                  {t.settings.storageModeValue}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {t.settings.storagePrivacyNote}
              </p>
            </div>
          </section>

          {/* E. Backup & Privacy */}
          <section
            aria-labelledby="settings-data-heading"
            className="surface-card rounded-lg p-6 space-y-5"
          >
            <div>
              <h2
                id="settings-data-heading"
                className="font-editorial text-xl font-normal text-[var(--text-primary)]"
              >
                {t.settings.sectionDataTitle}
              </h2>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                {t.settings.sectionDataDesc}
              </p>
            </div>

            {/* Saved Data Metrics */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-md bg-[var(--bg-subtle)] border surface-divider">
              <div>
                <p className="text-[11px] font-code text-[var(--text-muted)]">
                  {t.settings.storageSolvedCountLabel}
                </p>
                <p className="mt-1 font-editorial text-xl text-[var(--text-primary)] tabular-nums">
                  {solvedCount} / 400
                </p>
              </div>
              <div>
                <p className="text-[11px] font-code text-[var(--text-muted)]">
                  {t.settings.storageProjectsCountLabel}
                </p>
                <p className="mt-1 font-editorial text-xl text-[var(--text-primary)] tabular-nums">
                  {activeProjectCount} / 20
                </p>
              </div>
            </div>

            {/* Export & Import JSON Backup */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{t.settings.exportBackupBtn}</span>
              </button>

              <button
                type="button"
                onClick={handleSelectBackupFile}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{t.settings.importBackupBtn}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleBackupFileChange(e)}
                aria-label={t.settings.importBackupBtn}
                className="sr-only"
              />
            </div>

            {importError && (
              <p
                role="alert"
                className="p-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-subtle)] text-xs text-[var(--text-primary)] leading-relaxed"
              >
                {importError}
              </p>
            )}

            {pendingImport && (
              <div
                role="region"
                aria-label={t.settings.importConfirmTitle}
                className="p-4 rounded-md border border-[var(--accent)] bg-[var(--bg-subtle)] space-y-3"
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[var(--text-primary)]">
                    {t.settings.importConfirmTitle}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {t.settings.importConfirmBody}
                  </p>
                </div>

                <div className="text-[11px] font-code text-[var(--text-primary)] tabular-nums space-y-1 pt-1 border-t surface-divider">
                  <p>
                    {pendingImport.summary.solvedCount} {t.settings.importSummarySolved} ·{' '}
                    {pendingImport.summary.projectsCount} {t.settings.importSummaryProjects} ·{' '}
                    {pendingImport.summary.notesCount} {t.settings.importSummaryNotes} ·{' '}
                    {pendingImport.summary.bookmarksCount} {t.settings.importSummaryBookmarks}
                  </p>
                  {formattedImportDate && (
                    <p className="text-[var(--text-muted)]">
                      {t.settings.importSummaryExportedAt}: {formattedImportDate}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-3.5 py-2 text-xs font-medium rounded-md btn-primary whitespace-nowrap"
                  >
                    {t.settings.importConfirmBtn}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelImport}
                    className="px-3.5 py-2 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
                  >
                    {t.settings.importCancelBtn}
                  </button>
                </div>
              </div>
            )}

            {/* Safe Confirmed Reset Controls */}
            <div className="pt-4 border-t surface-divider space-y-2.5">
              <p className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                {t.settings.resetZoneLabel}
              </p>

              {(
                [
                  { id: 'preferences', label: t.settings.resetPreferencesBtn },
                  { id: 'logic', label: t.settings.resetLogicProgressBtn },
                  { id: 'projects', label: t.settings.resetProjectsBtn },
                ] as const
              ).map((action) => {
                const isConfirming = confirmTarget === action.id;
                return (
                  <div
                    key={action.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    {!isConfirming ? (
                      <button
                        type="button"
                        onClick={() => setConfirmTarget(action.id)}
                        className="w-full text-left px-3.5 py-2 text-xs font-medium rounded-md btn-secondary"
                      >
                        {action.label}
                      </button>
                    ) : (
                      <div className="w-full flex items-center gap-2 p-2 rounded-md border surface-divider bg-[var(--bg-subtle)]">
                        <span className="flex-1 text-xs font-medium text-[var(--text-primary)] truncate">
                          {action.label}?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmReset(action.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded btn-primary whitespace-nowrap"
                        >
                          {t.settings.confirmActionBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmTarget(null)}
                          className="px-3 py-1.5 text-xs font-medium rounded btn-secondary whitespace-nowrap"
                        >
                          {t.settings.cancelActionBtn}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* F. About PYLOGIC */}
          <section
            aria-labelledby="settings-about-heading"
            className="surface-card rounded-lg p-6 space-y-4"
          >
            <div>
              <h2
                id="settings-about-heading"
                className="font-editorial text-xl font-normal text-[var(--text-primary)]"
              >
                {t.settings.sectionAboutTitle}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
                {t.settings.sectionAboutDesc}
              </p>
            </div>

            <dl className="pt-3 border-t surface-divider space-y-2.5 text-xs">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[var(--text-muted)]">{t.settings.versionLabel}</dt>
                <dd className="font-code text-[var(--text-primary)]">
                  {t.settings.versionValue}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[var(--text-muted)]">{t.settings.taglineLabel}</dt>
                <dd className="text-[var(--text-primary)] text-right">
                  {t.brand.tagline}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[var(--text-muted)]">{t.settings.scopeLabel}</dt>
                <dd className="text-[var(--text-primary)] text-right">
                  {t.settings.scopeValue}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[var(--text-muted)]">{t.settings.developerLabel}</dt>
                <dd className="text-[var(--text-primary)] text-right">
                  {pickText(curriculumData.developer.name, language)}
                </dd>
              </div>
            </dl>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('about-developer')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] hover:underline underline-offset-4"
              >
                <span>{t.settings.openDeveloperBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
