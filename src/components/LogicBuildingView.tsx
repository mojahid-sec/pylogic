import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Save,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_USER_PREFERENCES } from '../services/preferencesRepository';
import type {
  CurriculumPhase,
  CurriculumProblem,
  LanguageCode,
  LastStudyState,
  LearningPart,
  LocalizedText,
  PartProblemData,
  ProblemDifficulty,
  ProblemProgressRecord,
  UserBookmark,
  UserPreferences,
} from '../types/pylogic';
import { getTranslations, pickText } from '../utils/language';
import { scrollToTop } from '../utils/navigation';
import { loadPartProblems } from '../utils/partLoader';
import {
  curriculumData,
  formatTwoDigits,
  getPartSolvedCount,
  getPartStatus,
} from '../utils/progress';

interface LogicBuildingViewProps {
  language: LanguageCode;
  solvedIds: string[];
  onToggleSolved: (problemId: string, partNumber: number, title: LocalizedText) => void;
  problemProgressMap?: Record<string, ProblemProgressRecord>;
  bookmarks?: UserBookmark[];
  onToggleBookmark?: (bookmark: UserBookmark) => void;
  onSaveProblemNote?: (problemId: string, partNumber: number, note: string) => void;
  onRecordProblemAttempt?: (problemId: string, partNumber: number) => void;
  preferences?: UserPreferences;
  lastStudy?: LastStudyState | null;
  onUpdateLastStudy?: (state: LastStudyState) => void;
  initialPartId?: string;
  initialProblemId?: string;
  initialPhase?: CurriculumPhase | 'All';
  openWorkspaceDirectly?: boolean;
  workspaceResetKey?: number;
}

const PHASE_FILTERS: Array<CurriculumPhase | 'All'> = [
  'All',
  'Foundations',
  'Core Logic',
  'Algorithms',
  'Systems & Security',
];

const DIFFICULTY_FILTERS: Array<ProblemDifficulty | 'All'> = [
  'All',
  'Very Easy',
  'Easy',
  'Medium',
  'Hard',
  'Challenge',
];

export function LogicBuildingView({
  language,
  solvedIds,
  onToggleSolved,
  problemProgressMap = {},
  bookmarks = [],
  onToggleBookmark,
  onSaveProblemNote,
  onRecordProblemAttempt,
  preferences = DEFAULT_USER_PREFERENCES,
  lastStudy = null,
  onUpdateLastStudy,
  initialPartId,
  initialProblemId,
  initialPhase = 'All',
  openWorkspaceDirectly = false,
  workspaceResetKey = 0,
}: LogicBuildingViewProps) {
  const t = getTranslations(language);
  const [selectedPhase, setSelectedPhase] = useState<CurriculumPhase | 'All'>(initialPhase);
  const [selectedDifficulty, setSelectedDifficulty] = useState<ProblemDifficulty | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Accordion starts with ALL 20 Parts collapsed by default ([])
  const [expandedPartIds, setExpandedPartIds] = useState<string[]>([]);

  const [selectedPartId, setSelectedPartId] = useState<string>(
    initialPartId ?? (preferences.rememberLastPart && lastStudy?.partId ? lastStudy.partId : 'part-01')
  );
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState<boolean>(
    Boolean(openWorkspaceDirectly && initialPartId)
  );
  const [selectedProblemId, setSelectedProblemId] = useState<string | undefined>(
    initialProblemId ?? (preferences.rememberLastPart ? lastStudy?.problemId : undefined)
  );

  // Lazy in-memory cache of loaded Parts (populated on accordion expand, workspace open, or global search/difficulty filter)
  const [partCache, setPartCache] = useState<Record<number, PartProblemData>>({});
  const partCacheRef = useRef<Record<number, PartProblemData>>({});
  partCacheRef.current = partCache;
  const solvedIdsRef = useRef<string[]>(solvedIds);
  solvedIdsRef.current = solvedIds;
  const copyTimerRef = useRef<number | null>(null);

  const [loadingParts, setLoadingParts] = useState<Record<number, boolean>>({});
  const [partLoadErrors, setPartLoadErrors] = useState<Record<number, boolean>>({});
  const [isIndexingSearch, setIsIndexingSearch] = useState(false);

  // Collapsible disclosure states — ALWAYS hidden by default when opening/switching problems
  const [showHint1, setShowHint1] = useState(false);
  const [showHint2, setShowHint2] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialPhase) {
      setSelectedPhase(initialPhase);
    }
  }, [initialPhase]);

  useEffect(() => {
    if (initialPartId) {
      setSelectedPartId(initialPartId);
      const targetPart = curriculumData.parts.find((p) => p.id === initialPartId);
      if (openWorkspaceDirectly && targetPart?.contentReady) {
        setIsWorkspaceOpen(true);
      } else if (!openWorkspaceDirectly) {
        setIsWorkspaceOpen(false);
      }
    }
  }, [initialPartId, openWorkspaceDirectly]);

  useEffect(() => {
    if (initialProblemId) {
      setSelectedProblemId(initialProblemId);
    }
  }, [initialProblemId]);

  useEffect(() => {
    if (workspaceResetKey > 0) {
      setIsWorkspaceOpen(false);
    }
  }, [workspaceResetKey]);

  const ensurePartLoaded = useCallback(
    async (partNumber: number): Promise<PartProblemData | null> => {
      const cached = partCacheRef.current[partNumber];
      if (cached) {
        return cached;
      }
      setLoadingParts((prev) => ({ ...prev, [partNumber]: true }));
      setPartLoadErrors((prev) => ({ ...prev, [partNumber]: false }));
      try {
        const data = await loadPartProblems(partNumber);
        if (data) {
          setPartCache((prev) => ({ ...prev, [partNumber]: data }));
        } else {
          setPartLoadErrors((prev) => ({ ...prev, [partNumber]: true }));
        }
        return data;
      } catch {
        setPartLoadErrors((prev) => ({ ...prev, [partNumber]: true }));
        return null;
      } finally {
        setLoadingParts((prev) => ({ ...prev, [partNumber]: false }));
      }
    },
    []
  );

  // Load all 20 Parts on demand when user enters a search query or difficulty filter
  const needsAllPartsIndexed =
    searchQuery.trim().length > 0 || selectedDifficulty !== 'All';

  useEffect(() => {
    if (!needsAllPartsIndexed) {
      return;
    }
    const missingParts = curriculumData.parts.filter(
      (part) => part.contentReady && !partCache[part.number]
    );
    if (missingParts.length === 0) {
      return;
    }

    let cancelled = false;
    setIsIndexingSearch(true);

    Promise.all(
      missingParts.map(async (part) => {
        const data = await loadPartProblems(part.number).catch(() => null);
        return { partNumber: part.number, data };
      })
    )
      .then((results) => {
        if (cancelled) {
          return;
        }
        setPartCache((prev) => {
          const next = { ...prev };
          for (const item of results) {
            if (item.data) {
              next[item.partNumber] = item.data;
            }
          }
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsIndexingSearch(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [needsAllPartsIndexed, partCache]);

  const filteredPartEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return curriculumData.parts
      .map((part) => {
        if (selectedPhase !== 'All' && part.phase !== selectedPhase) {
          return null;
        }

        const cachedData = partCache[part.number];
        const partProblems = cachedData?.problems ?? [];

        const partMetadataMatches =
          query.length === 0 ||
          part.title.en.toLowerCase().includes(query) ||
          part.title.bn.toLowerCase().includes(query) ||
          part.summary.en.toLowerCase().includes(query) ||
          part.summary.bn.toLowerCase().includes(query) ||
          `part ${formatTwoDigits(part.number)}`.includes(query) ||
          part.concepts.some(
            (concept) =>
              concept.en.toLowerCase().includes(query) ||
              concept.bn.toLowerCase().includes(query)
          );

        const matchingProblems = partProblems.filter((problem) => {
          const matchesDifficulty =
            selectedDifficulty === 'All' || problem.difficulty === selectedDifficulty;
          if (!matchesDifficulty) {
            return false;
          }
          if (query.length === 0 || partMetadataMatches) {
            return true;
          }
          return (
            problem.id.toLowerCase().includes(query) ||
            problem.title.en.toLowerCase().includes(query) ||
            problem.title.bn.toLowerCase().includes(query)
          );
        });

        // If searching with loaded problem sets, include Part if metadata matches OR any problem matches
        if (query.length > 0) {
          if (cachedData) {
            if (matchingProblems.length === 0) {
              return null;
            }
          } else if (!partMetadataMatches) {
            return null;
          }
        }

        // If difficulty filter is active and Part problems are loaded, hide Parts with 0 matching problems
        if (selectedDifficulty !== 'All' && cachedData && matchingProblems.length === 0) {
          return null;
        }

        return {
          part,
          problemsToDisplay: matchingProblems,
          partMetadataMatches,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [selectedPhase, selectedDifficulty, searchQuery, partCache]);

  const activePart: LearningPart = useMemo(() => {
    if (isWorkspaceOpen) {
      return (
        curriculumData.parts.find((p) => p.id === selectedPartId) ??
        curriculumData.parts[0]
      );
    }
    return (
      filteredPartEntries.find((e) => e.part.id === selectedPartId)?.part ??
      filteredPartEntries[0]?.part ??
      curriculumData.parts[0]
    );
  }, [filteredPartEntries, selectedPartId, isWorkspaceOpen]);

  // Load activePart problems whenever Mode A is open
  useEffect(() => {
    if (!isWorkspaceOpen || !activePart.contentReady) {
      return;
    }

    let cancelled = false;
    ensurePartLoaded(activePart.number).then((data) => {
      if (cancelled || !data || data.problems.length === 0) {
        return;
      }
      setSelectedProblemId((currentId) => {
        if (currentId && data.problems.some((p) => p.id === currentId)) {
          return currentId;
        }
        const firstUnsolved = data.problems.find(
          (p) => !solvedIdsRef.current.includes(p.id)
        );
        return (firstUnsolved ?? data.problems[0]).id;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isWorkspaceOpen, activePart.number, activePart.contentReady, ensurePartLoaded]);

  // Reset all progressive disclosure toggles whenever active problem changes
  useEffect(() => {
    setShowHint1(false);
    setShowHint2(false);
    setShowBreakdown(false);
    setShowSolution(false);
    setShowExplanation(false);
    setCopiedCode(false);
  }, [selectedProblemId, activePart.id]);

  const activePartData = partCache[activePart.number] ?? null;
  const isLoadingActivePart = Boolean(loadingParts[activePart.number]);
  const activePartLoadError = Boolean(partLoadErrors[activePart.number]);

  const activeSolvedCount = getPartSolvedCount(activePart.number, solvedIds);
  const activeStatus = getPartStatus(activePart, activeSolvedCount);
  const activePercent = Math.round((activeSolvedCount / activePart.problemCount) * 100);

  const problems = activePartData?.problems ?? [];
  const rawProblemIndex = problems.findIndex((p) => p.id === selectedProblemId);
  const activeProblemIndex =
    problems.length > 0 ? (rawProblemIndex >= 0 ? rawProblemIndex : 0) : -1;
  const activeProblem: CurriculumProblem | undefined =
    activeProblemIndex >= 0 ? problems[activeProblemIndex] : undefined;

  const activeProblemSavedNote = activeProblem
    ? problemProgressMap[activeProblem.id]?.problemNote ?? ''
    : '';
  const activeProblemAttempts = activeProblem
    ? problemProgressMap[activeProblem.id]?.attempts ?? 0
    : 0;

  useEffect(() => {
    setNoteDraft(activeProblemSavedNote);
  }, [activeProblem?.id, activeProblemSavedNote]);

  // Record last opened Part / Problem cleanly when workspace is open
  useEffect(() => {
    if (!isWorkspaceOpen || !onUpdateLastStudy || !activePart) {
      return;
    }
    onUpdateLastStudy({
      partId: activePart.id,
      problemId: activeProblem?.id,
    });
  }, [isWorkspaceOpen, activePart, activeProblem?.id, onUpdateLastStudy]);

  const handleTogglePartAccordion = (part: LearningPart) => {
    setSelectedPartId(part.id);
    const isCurrentlyExpanded = expandedPartIds.includes(part.id);
    if (isCurrentlyExpanded) {
      setExpandedPartIds((prev) => prev.filter((id) => id !== part.id));
      return;
    }
    // Single-open accordion behavior when toggling a Part header
    setExpandedPartIds([part.id]);
    if (part.contentReady) {
      void ensurePartLoaded(part.number);
    }
  };

  const allFilteredExpanded =
    filteredPartEntries.length > 0 &&
    filteredPartEntries.every((entry) => expandedPartIds.includes(entry.part.id));

  const handleToggleExpandAll = () => {
    if (allFilteredExpanded) {
      setExpandedPartIds([]);
      return;
    }
    const targetIds = filteredPartEntries.map((entry) => entry.part.id);
    setExpandedPartIds(targetIds);
    for (const entry of filteredPartEntries) {
      if (entry.part.contentReady && !partCache[entry.part.number]) {
        void ensurePartLoaded(entry.part.number);
      }
    }
  };

  const handleOpenPartProblem = (part: LearningPart, problemId?: string) => {
    setSelectedPartId(part.id);
    if (part.contentReady) {
      const cached = partCache[part.number];
      if (problemId) {
        setSelectedProblemId(problemId);
      } else if (cached && cached.problems.length > 0) {
        const firstUnsolved = cached.problems.find((p) => !solvedIds.includes(p.id));
        setSelectedProblemId((firstUnsolved ?? cached.problems[0]).id);
      } else {
        setSelectedProblemId(undefined);
      }
      setIsWorkspaceOpen(true);
      if (onUpdateLastStudy) {
        onUpdateLastStudy({ partId: part.id, problemId });
      }
      scrollToTop();
    }
  };

  const handleSelectProblem = (problemId: string) => {
    setSelectedProblemId(problemId);
  };

  const handleStepProblem = (delta: number) => {
    if (problems.length === 0) {
      return;
    }
    const currentIndex = activeProblemIndex >= 0 ? activeProblemIndex : 0;
    const nextIndex = currentIndex + delta;
    if (nextIndex >= 0 && nextIndex < problems.length) {
      setSelectedProblemId(problems[nextIndex].id);
      if (preferences.autoScrollOnStep) {
        scrollToTop();
      }
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedCode(false);
        copyTimerRef.current = null;
      }, 1800);
    } catch {
      // Clipboard fallback ignored if blocked by browser policy
    }
  };

  // =========================================================================
  // MODE A: PROBLEM WORKSPACE (Active Parts 01–20)
  // =========================================================================
  if (isWorkspaceOpen && activePart.contentReady) {
    const isSolved = activeProblem ? solvedIds.includes(activeProblem.id) : false;
    const isBookmarked = activeProblem
      ? bookmarks.some(
          (b) => b.itemType === 'problem' && b.itemId === activeProblem.id
        )
      : false;

    return (
      <div className="view-enter space-y-6">
        {/* Top Workspace Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b surface-divider">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsWorkspaceOpen(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md btn-secondary"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.logicBuilding.backToParts}</span>
            </button>

            <div className="text-xs font-code text-[var(--text-secondary)]">
              {t.logicBuilding.partLabel} {formatTwoDigits(activePart.number)} ·{' '}
              {pickText(activePart.title, language)}
            </div>
          </div>

          <div className="text-xs font-code text-[var(--text-primary)] tabular-nums">
            {formatTwoDigits(activeSolvedCount)} / {activePart.problemCount}{' '}
            {t.dashboard.solvedLabel} ({activePercent}%)
          </div>
        </div>

        {isLoadingActivePart ? (
          <div className="surface-card rounded-lg p-10 text-center text-sm text-[var(--text-secondary)]">
            {t.logicBuilding.loadingProblems}
          </div>
        ) : activePartLoadError || !activeProblem ? (
          <div className="surface-card rounded-lg p-10 text-center space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {t.logicBuilding.loadError}
            </p>
            <button
              type="button"
              onClick={() => void ensurePartLoaded(activePart.number)}
              className="px-4 py-2 text-xs font-medium rounded-md btn-secondary"
            >
              {t.controls.retryBtn}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Problem Selector List (01..20) */}
            <aside
              aria-label={t.logicBuilding.problemsListHeading}
              className="lg:col-span-4 surface-card rounded-lg overflow-hidden lg:sticky lg:top-6"
            >
              <div className="px-4 py-3.5 border-b surface-divider flex items-center justify-between">
                <h2 className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                  {t.logicBuilding.problemsListHeading}
                </h2>
                <span className="text-xs font-code text-[var(--text-muted)] tabular-nums">
                  {problems.length} {t.logicBuilding.problemsLabel}
                </span>
              </div>

              <div className="max-h-[360px] lg:max-h-[calc(100vh-11rem)] overflow-y-auto divide-y divide-[var(--border-color)]">
                {problems.map((problem) => {
                  const isCurrent = problem.id === activeProblem.id;
                  const problemSolved = solvedIds.includes(problem.id);
                  const problemBookmarked = bookmarks.some(
                    (b) => b.itemType === 'problem' && b.itemId === problem.id
                  );

                  return (
                    <button
                      key={problem.id}
                      type="button"
                      onClick={() => handleSelectProblem(problem.id)}
                      aria-current={isCurrent ? 'true' : undefined}
                      className={`w-full px-4 py-3 text-left flex items-start justify-between gap-3 transition-colors ${
                        isCurrent
                          ? 'bg-[var(--bg-subtle)]'
                          : 'hover:bg-[var(--hover-surface)]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] font-code text-[var(--text-secondary)]">
                          <span>{problem.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t.difficulties[problem.difficulty]}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-[var(--text-primary)] leading-snug">
                          {pickText(problem.title, language)}
                        </p>
                      </div>

                      <div className="mt-0.5 shrink-0 flex items-center gap-1.5">
                        {problemBookmarked && (
                          <Bookmark
                            className="w-3.5 h-3.5 text-[var(--text-secondary)] fill-current"
                            aria-label={t.bookmarks.saved}
                          />
                        )}
                        {preferences.showSolvedIndicators && problemSolved && (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)]"
                            title={t.logicBuilding.solvedBadge}
                          >
                            <Check className="w-3 h-3" aria-hidden="true" />
                            <span className="sr-only">{t.logicBuilding.solvedBadge}</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Main Problem Detail Workspace (Strict 10-Section Pedagogical Order) */}
            <article className="lg:col-span-8 min-w-0 surface-card rounded-lg p-6 sm:p-8 space-y-7">
              {/* Problem Header */}
              <header className="pb-6 border-b surface-divider">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs font-code text-[var(--text-secondary)]">
                    <span>{activeProblem.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{t.difficulties[activeProblem.difficulty]}</span>
                    {activeProblem.estimatedTime && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t.logicBuilding.estimatedTimeLabel}:{' '}
                          {pickText(activeProblem.estimatedTime, language)}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {t.notes.attemptsLabel}: {activeProblemAttempts}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onRecordProblemAttempt && (
                      <button
                        type="button"
                        onClick={() =>
                          onRecordProblemAttempt(activeProblem.id, activePart.number)
                        }
                        className="inline-flex items-center px-2.5 py-1.5 text-xs font-code rounded-md btn-secondary"
                      >
                        {t.notes.recordAttemptBtn}
                      </button>
                    )}

                    {onToggleBookmark && (
                      <button
                        type="button"
                        aria-pressed={isBookmarked}
                        onClick={() =>
                          onToggleBookmark({
                            itemType: 'problem',
                            itemId: activeProblem.id,
                            partNumber: activePart.number,
                            itemTitleEn: activeProblem.title.en,
                            itemTitleBn: activeProblem.title.bn,
                          })
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          isBookmarked ? 'btn-primary' : 'btn-secondary'
                        }`}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`}
                          aria-hidden="true"
                        />
                        <span>
                          {isBookmarked ? t.bookmarks.saved : t.bookmarks.add}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      aria-pressed={isSolved}
                      onClick={() =>
                        onToggleSolved(
                          activeProblem.id,
                          activePart.number,
                          activeProblem.title
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        isSolved ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {isSolved
                          ? t.logicBuilding.solvedBadge
                          : t.logicBuilding.markSolved}
                      </span>
                    </button>
                  </div>
                </div>

                <h1 className="mt-3 font-editorial text-2xl sm:text-3xl font-normal text-[var(--text-primary)] leading-snug">
                  {pickText(activeProblem.title, language)}
                </h1>
              </header>

              {/* 1. Problem Description */}
              <section>
                <h2 className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                  {t.logicBuilding.sectionDescription}
                </h2>
                <p className="mt-2.5 text-[15px] text-[var(--text-primary)] leading-relaxed whitespace-pre-line">
                  {pickText(activeProblem.description, language)}
                </p>
                {activeProblem.realWorldApplication && (
                  <div className="mt-4 p-3.5 rounded-md bg-[var(--bg-subtle)] border surface-divider">
                    <p className="text-[11px] font-code text-[var(--text-secondary)] uppercase tracking-wider">
                      {t.logicBuilding.realWorldLabel}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-primary)] leading-relaxed">
                      {pickText(activeProblem.realWorldApplication, language)}
                    </p>
                  </div>
                )}
              </section>

              {/* 2. Input and Expected Output */}
              <section className="pt-5 border-t surface-divider">
                <h2 className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                  {t.logicBuilding.sectionInputOutput}
                </h2>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-md bg-[var(--bg-subtle)]">
                    <p className="text-xs font-code text-[var(--text-secondary)]">
                      {t.logicBuilding.inputLabel}
                    </p>
                    <p className="mt-1.5 text-sm text-[var(--text-primary)] leading-relaxed">
                      {pickText(activeProblem.inputDescription, language)}
                    </p>
                  </div>
                  <div className="p-4 rounded-md bg-[var(--bg-subtle)]">
                    <p className="text-xs font-code text-[var(--text-secondary)]">
                      {t.logicBuilding.outputLabel}
                    </p>
                    <p className="mt-1.5 text-sm text-[var(--text-primary)] leading-relaxed">
                      {pickText(activeProblem.expectedOutput, language)}
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. Example */}
              <section className="pt-5 border-t surface-divider">
                <h2 className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                  {t.logicBuilding.sectionExample}
                </h2>
                <div className="mt-3 space-y-4">
                  {activeProblem.examples.map((ex, idx) => (
                    <div
                      key={`${activeProblem.id}-ex-${idx}`}
                      className="rounded-md border surface-divider overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-color)]">
                        <div className="p-4 min-w-0">
                          <p className="text-[11px] font-code text-[var(--text-secondary)]">
                            {t.logicBuilding.inputLabel}
                          </p>
                          <pre className="mt-2 font-code text-xs sm:text-[13px] text-[var(--text-primary)] whitespace-pre overflow-x-auto leading-relaxed">
                            {ex.input || '—'}
                          </pre>
                        </div>
                        <div className="p-4 min-w-0">
                          <p className="text-[11px] font-code text-[var(--text-secondary)]">
                            {t.logicBuilding.outputLabel}
                          </p>
                          <pre className="mt-2 font-code text-xs sm:text-[13px] text-[var(--text-primary)] whitespace-pre overflow-x-auto leading-relaxed">
                            {ex.output}
                          </pre>
                        </div>
                      </div>
                      {ex.explanation && (
                        <div className="px-4 py-2.5 bg-[var(--bg-subtle)] border-t surface-divider text-xs text-[var(--text-secondary)] leading-relaxed">
                          {pickText(ex.explanation, language)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. Required Concepts */}
              <section className="pt-5 border-t surface-divider">
                <h2 className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                  {t.logicBuilding.sectionConcepts}
                </h2>
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {activeProblem.requiredConcepts.map((concept) => (
                    <li
                      key={concept.en}
                      className="text-sm text-[var(--text-primary)] flex items-baseline gap-2"
                    >
                      <span
                        className="font-code text-xs text-[var(--text-muted)]"
                        aria-hidden="true"
                      >
                        —
                      </span>
                      <span>{pickText(concept, language)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 5. Hint 1 (Collapsible, hidden by default) */}
              <section className="pt-5 border-t surface-divider">
                <button
                  type="button"
                  aria-expanded={showHint1}
                  onClick={() => setShowHint1((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-4 text-left py-1"
                >
                  <span className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                    {t.logicBuilding.sectionHint1}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
                    <span>
                      {showHint1
                        ? t.logicBuilding.hideLabel
                        : t.logicBuilding.revealLabel}
                    </span>
                    {showHint1 ? (
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </span>
                </button>
                {showHint1 && (
                  <p className="mt-3 p-4 rounded-md bg-[var(--bg-subtle)] text-sm text-[var(--text-primary)] leading-relaxed">
                    {pickText(activeProblem.hint1, language)}
                  </p>
                )}
              </section>

              {/* 6. Hint 2 (Collapsible, hidden by default) */}
              <section className="pt-5 border-t surface-divider">
                <button
                  type="button"
                  aria-expanded={showHint2}
                  onClick={() => setShowHint2((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-4 text-left py-1"
                >
                  <span className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                    {t.logicBuilding.sectionHint2}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
                    <span>
                      {showHint2
                        ? t.logicBuilding.hideLabel
                        : t.logicBuilding.revealLabel}
                    </span>
                    {showHint2 ? (
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </span>
                </button>
                {showHint2 && (
                  <p className="mt-3 p-4 rounded-md bg-[var(--bg-subtle)] text-sm text-[var(--text-primary)] leading-relaxed">
                    {pickText(activeProblem.hint2, language)}
                  </p>
                )}
              </section>

              {/* 7. Logic Breakdown & Step-by-step Algorithm (Collapsible, hidden by default) */}
              <section className="pt-5 border-t surface-divider">
                <button
                  type="button"
                  aria-expanded={showBreakdown}
                  onClick={() => setShowBreakdown((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-4 text-left py-1"
                >
                  <span className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                    {t.logicBuilding.sectionLogicBreakdown}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
                    <span>
                      {showBreakdown
                        ? t.logicBuilding.hideLabel
                        : t.logicBuilding.revealLabel}
                    </span>
                    {showBreakdown ? (
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </span>
                </button>
                {showBreakdown && (
                  <div className="mt-3 p-4 rounded-md bg-[var(--bg-subtle)] space-y-4">
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                      {pickText(activeProblem.logicBreakdown, language)}
                    </p>
                    <div className="pt-3 border-t surface-divider">
                      <p className="text-xs font-code text-[var(--text-secondary)]">
                        {t.logicBuilding.algorithmStepsHeading}
                      </p>
                      <ol className="mt-2 space-y-1.5 list-decimal list-inside text-sm text-[var(--text-primary)] leading-relaxed">
                        {activeProblem.algorithm.map((step, index) => (
                          <li key={`${activeProblem.id}-alg-${index}`}>
                            {pickText(step, language)}
                          </li>
                        ))}
                      </ol>
                    </div>
                    {activeProblem.commonMistakes && (
                      <div className="pt-3 border-t surface-divider">
                        <p className="text-xs font-code text-[var(--text-secondary)]">
                          {t.logicBuilding.commonMistakesLabel}
                        </p>
                        <p className="mt-1.5 text-sm text-[var(--text-primary)] leading-relaxed">
                          {pickText(activeProblem.commonMistakes, language)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* 8. Python Solution (Collapsible, hidden by default) */}
              <section className="pt-5 border-t surface-divider">
                <button
                  type="button"
                  aria-expanded={showSolution}
                  onClick={() => setShowSolution((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-4 text-left py-1"
                >
                  <span className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                    {t.logicBuilding.sectionSolution}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
                    <span>
                      {showSolution
                        ? t.logicBuilding.hideLabel
                        : t.logicBuilding.revealLabel}
                    </span>
                    {showSolution ? (
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </span>
                </button>
                {showSolution && (
                  <div className="mt-3 rounded-md border surface-divider overflow-hidden">
                    <div className="px-4 py-2.5 bg-[var(--bg-subtle)] border-b surface-divider flex flex-wrap items-center justify-between gap-3 text-xs font-code">
                      <span className="text-[var(--text-secondary)]">Python 3</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(activeProblem.solution)}
                        className="inline-flex items-center gap-1.5 text-[var(--text-primary)] hover:underline underline-offset-4"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {copiedCode
                            ? t.logicBuilding.copiedCode
                            : t.logicBuilding.copyCode}
                        </span>
                      </button>
                    </div>
                    <pre
                      className={`p-4 font-code text-xs sm:text-[13px] text-[var(--text-primary)] leading-relaxed ${
                        preferences.wrapSolutionCode
                          ? 'whitespace-pre-wrap break-words'
                          : 'overflow-x-auto whitespace-pre'
                      }`}
                    >
                      <code>{activeProblem.solution}</code>
                    </pre>
                    <div className="px-4 py-2.5 bg-[var(--bg-subtle)] border-t surface-divider flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-code text-[var(--text-secondary)]">
                      <span>
                        {t.logicBuilding.timeComplexity}:{' '}
                        <strong className="font-medium text-[var(--text-primary)]">
                          {activeProblem.complexity.time}
                        </strong>
                      </span>
                      <span>
                        {t.logicBuilding.spaceComplexity}:{' '}
                        <strong className="font-medium text-[var(--text-primary)]">
                          {activeProblem.complexity.space}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </section>

              {/* 9. Code Explanation (Collapsible, hidden by default) */}
              <section className="pt-5 border-t surface-divider">
                <button
                  type="button"
                  aria-expanded={showExplanation}
                  onClick={() => setShowExplanation((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-4 text-left py-1"
                >
                  <span className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                    {t.logicBuilding.sectionExplanation}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
                    <span>
                      {showExplanation
                        ? t.logicBuilding.hideLabel
                        : t.logicBuilding.revealLabel}
                    </span>
                    {showExplanation ? (
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </span>
                </button>
                {showExplanation && (
                  <p className="mt-3 p-4 rounded-md bg-[var(--bg-subtle)] text-sm text-[var(--text-primary)] leading-relaxed">
                    {pickText(activeProblem.codeExplanation, language)}
                  </p>
                )}
              </section>

              {/* 10. Test Cases */}
              <section className="pt-5 border-t surface-divider">
                <h2 className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                  {t.logicBuilding.sectionTestCases}
                </h2>
                <div className="mt-3 overflow-x-auto rounded-md border surface-divider">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-subtle)] border-b surface-divider text-[11px] font-code text-[var(--text-secondary)]">
                        <th className="py-2.5 px-3.5 font-normal">
                          {t.logicBuilding.testInput}
                        </th>
                        <th className="py-2.5 px-3.5 font-normal">
                          {t.logicBuilding.testExpected}
                        </th>
                        <th className="py-2.5 px-3.5 font-normal hidden sm:table-cell">
                          {t.logicBuilding.testNote}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] text-xs">
                      {activeProblem.testCases.map((tc, idx) => (
                        <tr key={`${activeProblem.id}-tc-${idx}`} className="align-top">
                          <td className="py-3 px-3.5 font-code text-[var(--text-primary)] whitespace-pre">
                            {tc.input || '—'}
                          </td>
                          <td className="py-3 px-3.5 font-code text-[var(--text-primary)] whitespace-pre">
                            {tc.expectedOutput}
                          </td>
                          <td className="py-3 px-3.5 text-[var(--text-secondary)] hidden sm:table-cell">
                            {tc.note ? pickText(tc.note, language) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Personal Problem Notes */}
              {onSaveProblemNote && (
                <section className="pt-5 border-t surface-divider space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
                      {t.notes.problemNoteTitle}
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveProblemNote(activeProblem.id, activePart.number, noteDraft)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md btn-secondary"
                    >
                      <Save className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.notes.saveNoteBtn}</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    aria-label={t.notes.problemNoteTitle}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={t.notes.problemNotePlaceholder}
                    className="w-full px-3.5 py-2.5 text-sm rounded-md border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] leading-relaxed resize-y"
                  />
                </section>
              )}

              {/* Problem Footer Navigation */}
              <footer className="pt-6 border-t surface-divider flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={activeProblemIndex <= 0}
                  onClick={() => handleStepProblem(-1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.logicBuilding.previousProblem}</span>
                </button>

                <span className="text-xs font-code text-[var(--text-muted)] tabular-nums">
                  {formatTwoDigits((activeProblemIndex >= 0 ? activeProblemIndex : 0) + 1)} /{' '}
                  {problems.length}
                </span>

                <button
                  type="button"
                  disabled={
                    activeProblemIndex < 0 || activeProblemIndex >= problems.length - 1
                  }
                  onClick={() => handleStepProblem(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{t.logicBuilding.nextProblem}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </footer>
            </article>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MODE B: COLLAPSIBLE 20-PART ACCORDION & INSPECTOR (All Parts Collapsed Initially)
  // =========================================================================
  const lastOpenedPart =
    preferences.rememberLastPart && lastStudy?.partId
      ? curriculumData.parts.find((p) => p.id === lastStudy.partId)
      : undefined;

  return (
    <div className="view-enter space-y-8">
      {/* Editorial Section Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-code text-[var(--text-secondary)]">
            {t.logicBuilding.kicker}
          </p>
          <h1 className="mt-2 font-editorial text-3xl sm:text-4xl font-normal tracking-[-0.02em] text-[var(--text-primary)]">
            {t.logicBuilding.heading}
          </h1>
          <p className="mt-3 text-[15px] text-[var(--text-secondary)] leading-relaxed">
            {t.logicBuilding.intro}
          </p>
        </div>

        {lastOpenedPart && (
          <button
            type="button"
            onClick={() => handleOpenPartProblem(lastOpenedPart, lastStudy?.problemId)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md btn-secondary whitespace-nowrap shrink-0 self-start md:self-end"
          >
            <span>
              {t.logicBuilding.resumeLastPart} · {t.logicBuilding.partLabel}{' '}
              {formatTwoDigits(lastOpenedPart.number)}
              {lastStudy?.problemId ? ` (${lastStudy.problemId})` : ''}
            </span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </section>

      {/* Filter & Global Search Toolbar */}
      <section
        aria-label={t.logicBuilding.filterSectionAria}
        className="space-y-4 pb-6 border-b surface-divider"
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label={t.logicBuilding.phaseTabsAria}
            className="flex flex-wrap items-center gap-1 p-1 rounded-md bg-[var(--bg-subtle)]"
          >
            {PHASE_FILTERS.map((phase) => {
              const isSelected = selectedPhase === phase;
              return (
                <button
                  key={phase}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedPhase(phase)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {t.phases[phase]}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <select
              aria-label={t.logicBuilding.difficultyFilterLabel}
              value={selectedDifficulty}
              onChange={(e) =>
                setSelectedDifficulty(e.target.value as ProblemDifficulty | 'All')
              }
              className="px-3 py-2 text-xs rounded-md border surface-divider bg-[var(--bg-card)] text-[var(--text-primary)]"
            >
              <option value="All">{t.logicBuilding.allDifficulties}</option>
              {DIFFICULTY_FILTERS.filter((d) => d !== 'All').map((diff) => (
                <option key={diff} value={diff}>
                  {t.difficulties[diff as ProblemDifficulty]}
                </option>
              ))}
            </select>

            <div className="relative w-full sm:w-72">
              <Search
                className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.logicBuilding.searchPlaceholder}
                aria-label={t.logicBuilding.searchAria}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-md bg-[var(--bg-card)] border surface-divider text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>
          </div>
        </div>

        {/* Accordion Helper Row: Collapse hint + Expand All / Collapse All toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <p className="text-[var(--text-muted)]">
            {isIndexingSearch
              ? t.logicBuilding.loadingSearchIndex
              : t.logicBuilding.allCollapsedNote}
          </p>

          {filteredPartEntries.length > 0 && (
            <div className="flex items-center gap-2">
              {(selectedPhase !== 'All' ||
                selectedDifficulty !== 'All' ||
                searchQuery.trim().length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPhase('All');
                    setSelectedDifficulty('All');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
                >
                  {t.logicBuilding.resetFilters}
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleExpandAll}
                className="px-3 py-1.5 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
              >
                {allFilteredExpanded
                  ? t.logicBuilding.collapseAll
                  : t.logicBuilding.expandAll}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Two-Column Collapsible Accordion Browser & Part Inspector */}
      {filteredPartEntries.length === 0 ? (
        <div className="surface-card rounded-lg p-10 text-center">
          <p className="font-editorial text-xl text-[var(--text-primary)]">
            {t.logicBuilding.noResultsTitle}
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t.logicBuilding.noResultsBody}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedPhase('All');
              setSelectedDifficulty('All');
              setSearchQuery('');
            }}
            className="mt-5 px-4 py-2 text-xs font-medium rounded-md btn-secondary"
          >
            {t.logicBuilding.resetFilters}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Collapsible 20-Part Accordion */}
          <div className="lg:col-span-7 surface-card rounded-lg divide-y divide-[var(--border-color)] overflow-hidden">
            {filteredPartEntries.map(({ part, problemsToDisplay }) => {
              const isSelected = activePart.id === part.id;
              const isExpanded = expandedPartIds.includes(part.id);
              const isLastOpened =
                preferences.rememberLastPart && lastStudy?.partId === part.id;
              const partSolved = getPartSolvedCount(part.number, solvedIds);
              const partStatus = getPartStatus(part, partSolved);
              const cachedPartData = partCache[part.number];
              const isLoadingThisPart = Boolean(loadingParts[part.number]);
              const accordionPanelId = `part-accordion-panel-${part.number}`;

              const visibleProblems = cachedPartData
                ? needsAllPartsIndexed
                  ? problemsToDisplay
                  : cachedPartData.problems
                : [];

              return (
                <div key={part.id}>
                  {/* Part Accordion Header */}
                  <button
                    type="button"
                    onClick={() => handleTogglePartAccordion(part)}
                    aria-expanded={isExpanded}
                    aria-controls={accordionPanelId}
                    aria-label={`${
                      isExpanded
                        ? t.logicBuilding.collapsePartAria
                        : t.logicBuilding.expandPartAria
                    }: ${t.logicBuilding.partLabel} ${formatTwoDigits(part.number)}`}
                    className={`w-full px-5 py-4 text-left flex items-center justify-between gap-4 transition-colors ${
                      isSelected || isExpanded
                        ? 'bg-[var(--bg-subtle)]'
                        : 'hover:bg-[var(--hover-surface)]'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="mt-0.5 text-[var(--text-secondary)] shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        )}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-code text-[var(--text-secondary)]">
                          <span>
                            {t.logicBuilding.partLabel} {formatTwoDigits(part.number)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{t.phases[part.phase]}</span>
                          {isLastOpened && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[var(--text-primary)] font-medium">
                                {t.logicBuilding.lastOpenedBadge}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="mt-1 text-sm sm:text-[15px] font-medium text-[var(--text-primary)] truncate">
                          {pickText(part.title, language)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-code text-xs text-[var(--text-primary)] tabular-nums">
                        {formatTwoDigits(partSolved)} / {part.problemCount}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                        {needsAllPartsIndexed && cachedPartData
                          ? `${visibleProblems.length} ${t.logicBuilding.matchingProblemsCount}`
                          : t.statuses[partStatus]}
                      </p>
                    </div>
                  </button>

                  {/* Collapsible 20-Problem List Panel */}
                  {isExpanded && (
                    <div
                      id={accordionPanelId}
                      className="border-t surface-divider bg-[var(--bg-main)]"
                    >
                      {isLoadingThisPart ? (
                        <p className="px-5 py-4 text-xs text-[var(--text-secondary)]">
                          {t.logicBuilding.loadingProblems}
                        </p>
                      ) : !cachedPartData ? (
                        <p className="px-5 py-4 text-xs text-[var(--text-secondary)]">
                          {t.logicBuilding.loadError}
                        </p>
                      ) : (
                        <div className="divide-y divide-[var(--border-color)]">
                          {visibleProblems.map((prob) => {
                            const isProbSolved = solvedIds.includes(prob.id);
                            const isLastProblem =
                              preferences.rememberLastPart &&
                              lastStudy?.problemId === prob.id;
                            return (
                              <button
                                key={prob.id}
                                type="button"
                                onClick={() => handleOpenPartProblem(part, prob.id)}
                                className={`w-full px-5 py-3 pl-12 text-left flex items-center justify-between gap-3 transition-colors ${
                                  isLastProblem
                                    ? 'bg-[var(--bg-subtle)]'
                                    : 'hover:bg-[var(--hover-surface)]'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-code text-[var(--text-secondary)] tabular-nums">
                                    <span>{formatTwoDigits(prob.number)}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{prob.id}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{t.difficulties[prob.difficulty]}</span>
                                  </div>
                                  <p className="mt-0.5 text-sm text-[var(--text-primary)] truncate">
                                    {pickText(prob.title, language)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {preferences.showSolvedIndicators && isProbSolved && (
                                    <span
                                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)]"
                                      title={t.logicBuilding.solvedBadge}
                                    >
                                      <Check className="w-3 h-3" aria-hidden="true" />
                                      <span className="sr-only">
                                        {t.logicBuilding.solvedBadge}
                                      </span>
                                    </span>
                                  )}
                                  <ArrowRight
                                    className="w-3.5 h-3.5 text-[var(--text-muted)]"
                                    aria-hidden="true"
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Part Specification Inspector */}
          <aside
            aria-label={t.logicBuilding.inspectorAria}
            className="lg:col-span-5 surface-card rounded-lg p-6 sm:p-7 lg:sticky lg:top-8"
          >
            <div className="flex items-center justify-between gap-4 text-xs font-code text-[var(--text-secondary)]">
              <span>
                {t.logicBuilding.partLabel} {formatTwoDigits(activePart.number)} ·{' '}
                {t.phases[activePart.phase]}
              </span>
              <span>{t.statuses[activeStatus]}</span>
            </div>

            <h2 className="mt-3 font-editorial text-2xl font-normal text-[var(--text-primary)] leading-snug">
              {pickText(activePart.title, language)}
            </h2>

            <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed">
              {pickText(activePart.summary, language)}
            </p>

            {/* Module Progress */}
            <div className="mt-6 pt-5 border-t surface-divider">
              <div className="flex items-center justify-between text-xs font-code mb-2">
                <span className="text-[var(--text-secondary)]">
                  {t.logicBuilding.moduleCompletion}
                </span>
                <span className="text-[var(--text-primary)] tabular-nums">
                  {formatTwoDigits(activeSolvedCount)} / {activePart.problemCount}{' '}
                  {t.logicBuilding.problemsLabel} ({activePercent}%)
                </span>
              </div>
              <div className="progress-track rounded-full">
                <div className="progress-fill" style={{ width: `${activePercent}%` }} />
              </div>
            </div>

            {/* Core Concepts */}
            <div className="mt-6 pt-5 border-t surface-divider">
              <h3 className="text-xs font-code text-[var(--text-secondary)]">
                {t.logicBuilding.coreConcepts}
              </h3>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {activePart.concepts.map((concept) => (
                  <li
                    key={concept.en}
                    className="text-sm text-[var(--text-primary)] flex items-baseline gap-2"
                  >
                    <span
                      className="font-code text-xs text-[var(--text-muted)]"
                      aria-hidden="true"
                    >
                      —
                    </span>
                    <span>{pickText(concept, language)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Open Workspace CTA */}
            <div className="mt-6 pt-5 border-t surface-divider">
              {activePart.contentReady ? (
                <button
                  type="button"
                  onClick={() => handleOpenPartProblem(activePart)}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md btn-primary"
                >
                  <span>{t.logicBuilding.openPartButton}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              ) : (
                <div>
                  <h3 className="text-xs font-code text-[var(--text-secondary)]">
                    {t.logicBuilding.upcomingTitle}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                    {t.logicBuilding.scheduledNoticeTemplate.replace(
                      '{part}',
                      formatTwoDigits(activePart.number)
                    )}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
