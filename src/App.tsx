import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardView } from './components/DashboardView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';

const AboutDeveloperView = lazy(() =>
  import('./components/AboutDeveloperView').then((m) => ({
    default: m.AboutDeveloperView,
  }))
);
const LogicBuildingView = lazy(() =>
  import('./components/LogicBuildingView').then((m) => ({
    default: m.LogicBuildingView,
  }))
);
const NotFoundView = lazy(() =>
  import('./components/NotFoundView').then((m) => ({
    default: m.NotFoundView,
  }))
);
const ProgressView = lazy(() =>
  import('./components/ProgressView').then((m) => ({
    default: m.ProgressView,
  }))
);
const ProjectsView = lazy(() =>
  import('./components/ProjectsView').then((m) => ({
    default: m.ProjectsView,
  }))
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({
    default: m.SettingsView,
  }))
);
import {
  loadLocalBookmarks,
  loadLocalGeneralNotes,
  saveLocalBookmarks,
} from './services/bookmarksNotesRepository';
import {
  applyImportedBackupSnapshot,
  type PlatformBackupSnapshot,
} from './services/dataExportService';
import {
  clearLearningProgress,
  loadActivityLog,
  loadLastStudyState,
  loadProblemProgressMap,
  loadSolvedProblemIds,
  saveActivityLog,
  saveLastStudyState,
  saveProblemProgressMap,
} from './services/learningProgressRepository';
import {
  applyLanguagePreference,
  applyReadingDensity,
  applyResolvedTheme,
  loadUserPreferences,
  resetUserPreferences,
  saveUserPreferences,
} from './services/preferencesRepository';
import {
  clearAllProjectWorkspaces,
  loadProjectWorkspaceMap,
} from './services/projectWorkspaceRepository';
import type {
  ActivityEntry,
  CurriculumPhase,
  LastStudyState,
  LocalizedText,
  ProblemProgressRecord,
  ProjectChecklistState,
  ProjectPersonalNotes,
  ProjectStatus,
  ProjectWorkspaceMap,
  SectionId,
  ThemeMode,
  UserBookmark,
  UserNoteRecord,
  UserPreferences,
} from './types/pylogic';
import { getTranslations } from './utils/language';
import { resolveInitialRoute, scrollToTop, syncSectionHash } from './utils/navigation';
import { formatTwoDigits } from './utils/progress';
import {
  clearProjectWorkspaceEntry,
  getProjectEntry,
  updateProjectChecklist,
  updateProjectNotes,
  updateProjectStatus,
} from './utils/projectStorage';

export default function App() {
  const [routeState, setRouteState] = useState(() => resolveInitialRoute());

  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    loadUserPreferences()
  );
  const [resolvedTheme, setResolvedTheme] = useState<ThemeMode>(() =>
    applyResolvedTheme(loadUserPreferences().themePreference)
  );

  const [solvedIds, setSolvedIds] = useState<string[]>(() => loadSolvedProblemIds());
  const [problemProgressMap, setProblemProgressMap] = useState<
    Record<string, ProblemProgressRecord>
  >(() => loadProblemProgressMap());
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>(() => loadActivityLog());
  const [lastStudy, setLastStudy] = useState<LastStudyState | null>(() =>
    loadLastStudyState()
  );
  const [projectWorkspaceMap, setProjectWorkspaceMap] = useState<ProjectWorkspaceMap>(() =>
    loadProjectWorkspaceMap()
  );
  const [bookmarks, setBookmarks] = useState<UserBookmark[]>(() => loadLocalBookmarks());
  const [generalNotes, setGeneralNotes] = useState<UserNoteRecord[]>(() =>
    loadLocalGeneralNotes()
  );

  const [targetPartId, setTargetPartId] = useState<string | undefined>(undefined);
  const [targetProblemId, setTargetProblemId] = useState<string | undefined>(undefined);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [targetPhase, setTargetPhase] = useState<CurriculumPhase | 'All'>('All');
  const [openWorkspaceDirectly, setOpenWorkspaceDirectly] = useState(false);
  const [logicWorkspaceResetKey, setLogicWorkspaceResetKey] = useState(0);
  const [projectsCatalogResetKey, setProjectsCatalogResetKey] = useState(0);
  const [projectsResetKey, setProjectsResetKey] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  const language = preferences.language;
  const activeSection = routeState.section;
  const isNotFound = routeState.isNotFound;
  const t = getTranslations(language);

  const combinedNotes = useMemo<UserNoteRecord[]>(() => {
    const problemNotes: UserNoteRecord[] = Object.values(problemProgressMap)
      .filter((entry) => entry.problemNote.trim().length > 0)
      .map((entry) => ({
        entityType: 'problem',
        entityId: entry.problemId,
        title: `Part ${formatTwoDigits(entry.partNumber)} · ${entry.problemId}`,
        content: entry.problemNote,
        updatedAt: entry.lastActivityAt,
      }));

    return [...problemNotes, ...generalNotes].sort((a, b) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    );
  }, [problemProgressMap, generalNotes]);

  // Sync theme, language, and reading density to DOM + listen for OS color-scheme changes
  useEffect(() => {
    const applied = applyResolvedTheme(preferences.themePreference);
    setResolvedTheme(applied);
    applyLanguagePreference(preferences.language);
    applyReadingDensity(preferences.readingDensity);

    if (
      preferences.themePreference !== 'system' ||
      typeof window === 'undefined' ||
      !window.matchMedia
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      setResolvedTheme(applyResolvedTheme('system'));
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [preferences.themePreference, preferences.language, preferences.readingDensity]);

  // Keep hash synchronized cleanly for valid routes without altering pathname (GitHub Pages safe)
  useEffect(() => {
    syncSectionHash(activeSection, isNotFound);
  }, [activeSection, isNotFound]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleHashChange = () => {
      setRouteState(resolveInitialRoute());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!notification) {
      return;
    }
    const timer = window.setTimeout(() => {
      setNotification(null);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [notification]);

  const handleNavigate = useCallback(
    (
      section: SectionId,
      options?: {
        partId?: string;
        problemId?: string;
        projectId?: string;
        phase?: CurriculumPhase;
      }
    ) => {
      if (options?.partId) {
        setTargetPartId(options.partId);
        setOpenWorkspaceDirectly(true);
      } else if (section === 'logic-building') {
        setOpenWorkspaceDirectly(false);
        setLogicWorkspaceResetKey((prev) => prev + 1);
      }

      if (options?.problemId) {
        setTargetProblemId(options.problemId);
      } else if (options?.partId) {
        setTargetProblemId(undefined);
      }

      if (options?.projectId) {
        setTargetProjectId(options.projectId);
      } else if (section === 'projects') {
        setTargetProjectId(null);
        setProjectsCatalogResetKey((prev) => prev + 1);
      }

      if (options?.phase) {
        setTargetPhase(options.phase);
      } else if (section === 'logic-building' && !options?.phase && !options?.partId) {
        setTargetPhase('All');
      }

      setRouteState({ section, isNotFound: false, requestedRoute: section });
      scrollToTop();
    },
    []
  );

  const handleUpdatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences((prev) => saveUserPreferences({ ...prev, ...patch }));
  }, []);

  const handleResetPreferences = useCallback(() => {
    setPreferences(resetUserPreferences());
  }, []);

  const handleUpdateLastStudy = useCallback(
    (state: LastStudyState) => {
      if (!preferences.rememberLastPart) {
        return;
      }
      setLastStudy((prev) => {
        if (prev?.partId === state.partId && prev?.problemId === state.problemId) {
          return prev;
        }
        saveLastStudyState(state);
        return state;
      });
    },
    [preferences.rememberLastPart]
  );

  const handleToggleSolved = (
    problemId: string,
    partNumber: number,
    title: LocalizedText
  ) => {
    const alreadySolved = solvedIds.includes(problemId);
    const nextSolvedFlag = !alreadySolved;
    const nextSolved = alreadySolved
      ? solvedIds.filter((id) => id !== problemId)
      : [...solvedIds, problemId];

    const existing = problemProgressMap[problemId];
    const nowIso = new Date().toISOString();
    const updatedRecord: ProblemProgressRecord = {
      problemId,
      partNumber,
      isCompleted: nextSolvedFlag,
      attempts: Math.max(existing?.attempts ?? 0, nextSolvedFlag ? 1 : 0),
      problemNote: existing?.problemNote ?? '',
      lastActivityAt: nowIso,
    };

    const nextMap = { ...problemProgressMap, [problemId]: updatedRecord };
    setSolvedIds(nextSolved);
    setProblemProgressMap(nextMap);
    saveProblemProgressMap(nextMap);

    if (nextSolvedFlag) {
      const partStr = formatTwoDigits(partNumber);
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const entry: ActivityEntry = {
        id: `act-${Date.now()}`,
        timestamp: { en: `Today · ${timeStr}`, bn: `আজ · ${timeStr}` },
        reference: {
          en: `Part ${partStr} · ${problemId}`,
          bn: `পার্ট ${partStr} · ${problemId}`,
        },
        description: {
          en: `Solved ${title.en}.`,
          bn: `${title.bn} সমাধান সম্পন্ন।`,
        },
        type: 'Solved',
      };
      const nextLog = [entry, ...activityLog].slice(0, 6);
      setActivityLog(nextLog);
      saveActivityLog(nextLog);
      setNotification(t.controls.markedSolved);
    } else {
      setNotification(t.controls.markedUnsolved);
    }
  };

  const handleRecordProblemAttempt = (problemId: string, partNumber: number) => {
    const existing = problemProgressMap[problemId];
    const updatedRecord: ProblemProgressRecord = {
      problemId,
      partNumber,
      isCompleted: existing?.isCompleted ?? solvedIds.includes(problemId),
      attempts: (existing?.attempts ?? 0) + 1,
      problemNote: existing?.problemNote ?? '',
      lastActivityAt: new Date().toISOString(),
    };
    const nextMap = { ...problemProgressMap, [problemId]: updatedRecord };
    setProblemProgressMap(nextMap);
    saveProblemProgressMap(nextMap);
    setNotification(t.notes.attemptRecordedNotice);
  };

  const handleSaveProblemNote = (
    problemId: string,
    partNumber: number,
    noteText: string
  ) => {
    const existing = problemProgressMap[problemId];
    const updatedRecord: ProblemProgressRecord = {
      problemId,
      partNumber,
      isCompleted: existing?.isCompleted ?? solvedIds.includes(problemId),
      attempts: existing?.attempts ?? 0,
      problemNote: noteText,
      lastActivityAt: new Date().toISOString(),
    };
    const nextMap = { ...problemProgressMap, [problemId]: updatedRecord };
    setProblemProgressMap(nextMap);
    saveProblemProgressMap(nextMap);
    setNotification(t.notes.noteSavedNotice);
  };

  const handleToggleBookmark = (bookmark: UserBookmark) => {
    const exists = bookmarks.some(
      (b) => b.itemType === bookmark.itemType && b.itemId === bookmark.itemId
    );
    const nextBookmarks = exists
      ? bookmarks.filter(
          (b) => !(b.itemType === bookmark.itemType && b.itemId === bookmark.itemId)
        )
      : [{ ...bookmark, createdAt: new Date().toISOString() }, ...bookmarks];

    setBookmarks(nextBookmarks);
    saveLocalBookmarks(nextBookmarks);
    setNotification(exists ? t.bookmarks.removedNotice : t.bookmarks.addedNotice);
  };

  const handleUpdateProjectStatus = (projectId: string, status: ProjectStatus) => {
    const existing = getProjectEntry(projectWorkspaceMap, projectId);
    if (status === 'Completed' && !existing.checklist?.finalProjectReviewed) {
      setNotification(t.projects.completeAllWarning);
      return;
    }
    setProjectWorkspaceMap(updateProjectStatus(projectWorkspaceMap, projectId, status));
    setNotification(t.projects.statusUpdated);
  };

  const handleUpdateProjectChecklist = (
    projectId: string,
    checklist: ProjectChecklistState
  ) => {
    const existing = getProjectEntry(projectWorkspaceMap, projectId);
    const nextMap = updateProjectChecklist(projectWorkspaceMap, projectId, checklist);
    setProjectWorkspaceMap(nextMap);
    if (existing.status === 'Completed' && !checklist.finalProjectReviewed) {
      setNotification(t.projects.checklistDowngradedNotice);
    } else {
      setNotification(t.projects.checklistUpdated);
    }
  };

  const handleUpdateProjectNotes = (
    projectId: string,
    projectNotes: ProjectPersonalNotes
  ) => {
    setProjectWorkspaceMap(
      updateProjectNotes(projectWorkspaceMap, projectId, projectNotes)
    );
  };

  const handleClearProjectNotes = (projectId: string) => {
    setProjectWorkspaceMap(clearProjectWorkspaceEntry(projectWorkspaceMap, projectId));
    setNotification(t.projects.notesResetNotice);
  };

  const handleResetProgress = () => {
    const cleared = clearLearningProgress();
    setSolvedIds(cleared.solvedIds);
    setProblemProgressMap(cleared.problemProgressMap);
    setActivityLog(cleared.activityLog);
    setLastStudy(null);
  };

  const handleResetProjectWorkspaces = () => {
    clearAllProjectWorkspaces();
    setProjectWorkspaceMap({});
    setProjectsResetKey((prev) => prev + 1);
  };

  const handleImportBackup = (snapshot: PlatformBackupSnapshot) => {
    const applied = applyImportedBackupSnapshot(snapshot);
    setPreferences(applied.preferences);
    setSolvedIds(applied.solvedIds);
    setProblemProgressMap(applied.problemProgressMap);
    setActivityLog(applied.activityLog);
    setLastStudy(applied.lastStudy);
    setProjectWorkspaceMap(applied.projectWorkspaceMap);
    setBookmarks(applied.bookmarks);
    setGeneralNotes(applied.notes);
    setProjectsResetKey((prev) => prev + 1);
    setLogicWorkspaceResetKey((prev) => prev + 1);
  };

  const handleToggleSidebarCollapse = useCallback(() => {
    setPreferences((prev) =>
      saveUserPreferences({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed })
    );
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] flex flex-col md:flex-row">
      <Sidebar
        activeSection={activeSection}
        isNotFound={isNotFound}
        isCollapsed={preferences.sidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        onNavigate={(section) => handleNavigate(section)}
        language={language}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 ease-out ${
          preferences.sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-64'
        }`}
      >
        <main className="flex-1 w-full max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 py-6 sm:py-8 lg:py-10">
          <TopBar
            activeSection={activeSection}
            isNotFound={isNotFound}
            language={language}
            onOpenSettings={() => handleNavigate('settings')}
          />

          {isNotFound ? (
            <Suspense
              fallback={
                <div className="surface-card rounded-lg p-8 text-sm text-[var(--text-secondary)]">
                  {t.controls.loadingView}
                </div>
              }
            >
              <NotFoundView
                language={language}
                requestedRoute={routeState.requestedRoute}
                onNavigate={(section) => handleNavigate(section)}
              />
            </Suspense>
          ) : activeSection === 'dashboard' ? (
            <DashboardView
              language={language}
              solvedIds={solvedIds}
              activityLog={activityLog}
              onNavigate={handleNavigate}
            />
          ) : (
            <Suspense
              fallback={
                <div className="surface-card rounded-lg p-8 text-sm text-[var(--text-secondary)]">
                  {t.controls.loadingView}
                </div>
              }
            >
              {activeSection === 'logic-building' && (
                <LogicBuildingView
                  language={language}
                  solvedIds={solvedIds}
                  onToggleSolved={handleToggleSolved}
                  problemProgressMap={problemProgressMap}
                  bookmarks={bookmarks}
                  onToggleBookmark={handleToggleBookmark}
                  onSaveProblemNote={handleSaveProblemNote}
                  onRecordProblemAttempt={handleRecordProblemAttempt}
                  preferences={preferences}
                  lastStudy={lastStudy}
                  onUpdateLastStudy={handleUpdateLastStudy}
                  initialPartId={targetPartId}
                  initialProblemId={targetProblemId}
                  initialPhase={targetPhase}
                  openWorkspaceDirectly={openWorkspaceDirectly}
                  workspaceResetKey={logicWorkspaceResetKey}
                />
              )}

              {activeSection === 'projects' && (
                <ProjectsView
                  key={projectsResetKey}
                  language={language}
                  workspaceMap={projectWorkspaceMap}
                  bookmarks={bookmarks}
                  initialProjectId={targetProjectId}
                  catalogResetKey={projectsCatalogResetKey}
                  onUpdateProjectStatus={handleUpdateProjectStatus}
                  onUpdateProjectChecklist={handleUpdateProjectChecklist}
                  onUpdateProjectNotes={handleUpdateProjectNotes}
                  onClearProjectNotes={handleClearProjectNotes}
                  onToggleBookmark={handleToggleBookmark}
                  onOpenCurriculumPart={(partNum) =>
                    handleNavigate('logic-building', {
                      partId: `part-${formatTwoDigits(partNum)}`,
                    })
                  }
                  onNavigate={handleNavigate}
                />
              )}

              {activeSection === 'my-progress' && (
                <ProgressView
                  language={language}
                  solvedIds={solvedIds}
                  bookmarks={bookmarks}
                  notes={combinedNotes}
                  onOpenPart={handleNavigate}
                  onResetProgress={handleResetProgress}
                />
              )}

              {activeSection === 'about-developer' && (
                <AboutDeveloperView language={language} />
              )}

              {activeSection === 'settings' && (
                <SettingsView
                  preferences={preferences}
                  resolvedTheme={resolvedTheme}
                  solvedCount={solvedIds.length}
                  projectWorkspaceMap={projectWorkspaceMap}
                  onUpdatePreferences={handleUpdatePreferences}
                  onResetPreferences={handleResetPreferences}
                  onResetLogicProgress={handleResetProgress}
                  onResetProjectWorkspaces={handleResetProjectWorkspaces}
                  onImportBackup={handleImportBackup}
                  onNavigate={(section) => handleNavigate(section)}
                  onNotify={(message) => setNotification(message)}
                />
              )}
            </Suspense>
          )}
        </main>

        <footer className="w-full max-w-[1160px] mx-auto px-5 sm:px-8 lg:px-12 py-6 border-t surface-divider flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <span>{t.brand.footerTitle}</span>
          <span className="font-code">{t.brand.footerPhase}</span>
        </footer>
      </div>

      {/* Subtle Bilingual Status Notification */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 surface-card rounded-md px-4 py-2.5 text-xs font-medium text-[var(--text-primary)] shadow-sm"
        >
          {notification}
        </div>
      )}
    </div>
  );
}
