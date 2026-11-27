import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Languages,
  Square,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  EMPTY_CHECKLIST,
  PROJECT_CHECKLIST_KEYS,
} from '../services/projectWorkspaceRepository';
import type {
  LanguageCode,
  LocalizedText,
  ProjectChecklistKey,
  ProjectChecklistState,
  ProjectDetail,
  ProjectPersonalNotes,
  ProjectStatus,
  ProjectTechLibraryItem,
  ProjectWorkspaceEntry,
  UserBookmark,
} from '../types/pylogic';
import { getTranslations, pickText } from '../utils/language';
import { scrollElementIntoView } from '../utils/navigation';
import { formatTwoDigits } from '../utils/progress';
import { computeChecklistProgress } from '../utils/projectStorage';
import { isSafeHttpUrl } from '../utils/url';

const PROJECT_STATUSES: ProjectStatus[] = [
  'Not Started',
  'Planning',
  'In Progress',
  'Testing',
  'Completed',
];

const GUIDE_SECTION_IDS = [
  's01',
  's02',
  's03',
  's04',
  's05',
  's06',
  's07',
  's08',
  's09',
  's10',
  's11',
  's12',
] as const;

type GuideSectionKey = (typeof GUIDE_SECTION_IDS)[number];

interface ProjectDetailWorkspaceProps {
  language: LanguageCode;
  projectId: string;
  projectDetail: ProjectDetail | null;
  isLoading: boolean;
  loadError: boolean;
  workspaceEntry: ProjectWorkspaceEntry;
  hasPrev: boolean;
  hasNext: boolean;
  isBookmarked?: boolean;
  onToggleBookmark?: (bookmark: UserBookmark) => void;
  onOpenCurriculumPart?: (partNumber: number) => void;
  onRetry?: () => void;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onUpdateStatus: (projectId: string, status: ProjectStatus) => void;
  onUpdateChecklist?: (
    projectId: string,
    checklist: ProjectChecklistState
  ) => void;
  onUpdateNotes: (projectId: string, notes: ProjectPersonalNotes) => void;
  onClearNotes: (projectId: string) => void;
}

interface CollapsibleCardProps {
  sectionId: GuideSectionKey;
  title: string;
  metaText?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function CollapsibleSectionCard({
  sectionId,
  title,
  metaText,
  isOpen,
  onToggle,
  children,
}: CollapsibleCardProps) {
  return (
    <section
      id={`project-section-${sectionId}`}
      className="surface-card rounded-lg overflow-hidden scroll-mt-6"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`project-panel-${sectionId}`}
        className="w-full px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 text-left hover:bg-[var(--bg-subtle)] transition-colors"
      >
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
          <h2 className="font-editorial text-lg sm:text-xl font-normal text-[var(--text-primary)] tracking-[-0.01em]">
            {title}
          </h2>
          {metaText && (
            <span className="text-[11px] font-code text-[var(--text-muted)] tabular-nums">
              {metaText}
            </span>
          )}
        </div>
        <span className="shrink-0 text-[var(--text-muted)]">
          {isOpen ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </span>
      </button>

      {isOpen && (
        <div
          id={`project-panel-${sectionId}`}
          className="px-5 sm:px-6 pb-6 pt-4 border-t surface-divider space-y-5"
        >
          {children}
        </div>
      )}
    </section>
  );
}

export function ProjectDetailWorkspace({
  language,
  projectId,
  projectDetail,
  isLoading,
  loadError,
  workspaceEntry,
  hasPrev,
  hasNext,
  isBookmarked = false,
  onToggleBookmark,
  onOpenCurriculumPart,
  onRetry,
  onBack,
  onPrev,
  onNext,
  onUpdateStatus,
  onUpdateChecklist,
  onUpdateNotes,
  onClearNotes,
}: ProjectDetailWorkspaceProps) {
  const t = getTranslations(language);

  // All 12 sections collapsed by default on initial open and when switching projects
  const [openSections, setOpenSections] = useState<Set<GuideSectionKey>>(
    () => new Set()
  );
  const [bilingualMode, setBilingualMode] = useState(false);
  const [showHint1, setShowHint1] = useState(false);
  const [showHint2, setShowHint2] = useState(false);
  const [showHint3, setShowHint3] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [statusGuardWarning, setStatusGuardWarning] = useState(false);
  const jumpTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (jumpTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(jumpTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setOpenSections(new Set());
    setBilingualMode(false);
    setShowHint1(false);
    setShowHint2(false);
    setShowHint3(false);
    setConfirmClear(false);
    setStatusGuardWarning(false);
  }, [projectId]);

  const toggleSection = (key: GuideSectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAllSections = () => {
    setOpenSections(new Set(GUIDE_SECTION_IDS));
  };

  const collapseAllSections = () => {
    setOpenSections(new Set());
  };

  const jumpToSection = (key: GuideSectionKey) => {
    setOpenSections((prev) => {
      if (prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      if (jumpTimerRef.current !== null) {
        window.clearTimeout(jumpTimerRef.current);
      }
      jumpTimerRef.current = window.setTimeout(() => {
        const el = document.getElementById(`project-section-${key}`);
        scrollElementIntoView(el);
        jumpTimerRef.current = null;
      }, 40);
    }
  };

  const handleNoteChange = (field: keyof ProjectPersonalNotes, value: string) => {
    onUpdateNotes(projectId, {
      ...workspaceEntry.notes,
      [field]: value,
    });
  };

  const checklist: ProjectChecklistState = {
    ...EMPTY_CHECKLIST,
    ...(workspaceEntry.checklist ?? {}),
  };
  const checklistStats = computeChecklistProgress(checklist);

  const handleToggleChecklistItem = (key: ProjectChecklistKey) => {
    if (!onUpdateChecklist) {
      return;
    }
    const nextChecklist: ProjectChecklistState = {
      ...checklist,
      [key]: !checklist[key],
    };
    if (nextChecklist.finalProjectReviewed) {
      setStatusGuardWarning(false);
    }
    onUpdateChecklist(projectId, nextChecklist);
  };

  const handleStatusChange = (nextStatus: ProjectStatus) => {
    if (nextStatus === 'Completed' && !checklist.finalProjectReviewed) {
      setStatusGuardWarning(true);
      jumpToSection('s10');
      return;
    }
    setStatusGuardWarning(false);
    onUpdateStatus(projectId, nextStatus);
  };

  const renderText = (text: LocalizedText, forcedLang?: LanguageCode) => {
    if (forcedLang) {
      return text[forcedLang];
    }
    return pickText(text, language);
  };

  const parsedUpdatedAt = workspaceEntry.updatedAt
    ? Date.parse(workspaceEntry.updatedAt)
    : Number.NaN;
  const formattedUpdatedAt = !Number.isNaN(parsedUpdatedAt)
    ? new Date(parsedUpdatedAt).toLocaleString(
        language === 'bn' ? 'bn-BD' : 'en-US',
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      )
    : t.projects.notUpdatedYet;

  const repoUrlSafe = isSafeHttpUrl(workspaceEntry.notes.githubRepoUrl);
  const story = projectDetail?.story;
  const guide = projectDetail?.guide;

  const sectionTitles: Record<GuideSectionKey, string> = {
    s01: t.projects.s01Title,
    s02: t.projects.s02Title,
    s03: t.projects.s03Title,
    s04: t.projects.s04Title,
    s05: t.projects.s05Title,
    s06: t.projects.s06Title,
    s07: t.projects.s07Title,
    s08: t.projects.s08Title,
    s09: t.projects.s09Title,
    s10: t.projects.s10Title,
    s11: t.projects.s11Title,
    s12: t.projects.s12Title,
  };

  const renderLibraryCards = (items: ProjectTechLibraryItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((item) => (
        <div
          key={item.name}
          className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <code className="font-code text-sm font-medium text-[var(--text-primary)]">
              {item.name}
            </code>
            <span className="text-[11px] font-code text-[var(--text-secondary)]">
              {t.projects.tierLabels[item.tier]} ·{' '}
              {item.isBuiltin ? t.projects.builtinBadge : t.projects.pipBadge}
            </span>
          </div>

          {!item.isBuiltin && item.pipCommand && (
            <div className="rounded bg-[var(--bg-card)] border border-[var(--border-color)] px-3 py-1.5 overflow-x-auto">
              <code className="font-code text-xs text-[var(--text-primary)]">
                {item.pipCommand}
              </code>
            </div>
          )}

          <dl className="space-y-2 text-xs leading-relaxed">
            <div>
              <dt className="font-code text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                {t.projects.whatItDoesLabel}
              </dt>
              <dd className="mt-0.5 text-sm text-[var(--text-primary)]">
                {renderText(item.whatItDoes)}
              </dd>
            </div>
            <div>
              <dt className="font-code text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                {t.projects.whyNeededLabel}
              </dt>
              <dd className="mt-0.5 text-sm text-[var(--text-secondary)]">
                {renderText(item.whyProjectNeedsIt)}
              </dd>
            </div>
            <div>
              <dt className="font-code text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                {t.projects.whereUsedLabel}
              </dt>
              <dd className="mt-0.5 text-xs font-code text-[var(--text-secondary)]">
                {renderText(item.whereUsed)}
              </dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  );

  return (
    <div className="view-enter space-y-6">
      {/* Top Navigation Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.projects.backToProjects}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md btn-secondary disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.projects.previousProject}</span>
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md btn-secondary disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <span>{t.projects.nextProject}</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Loading / Error State */}
      {isLoading && (
        <section className="surface-card rounded-lg p-8 text-sm text-[var(--text-secondary)]">
          {t.projects.loadingProject}
        </section>
      )}

      {!isLoading && (loadError || !projectDetail) && (
        <section className="surface-card rounded-lg p-8 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {t.projects.loadError}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-xs font-medium rounded-md btn-secondary"
            >
              {t.controls.retryBtn}
            </button>
          )}
        </section>
      )}

      {/* Loaded Project Guide & Engineering Workspace */}
      {!isLoading && projectDetail && (
        <>
          {/* Project Header Card */}
          <section className="surface-card rounded-lg p-6 sm:p-8 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
              <div className="space-y-2.5 max-w-3xl">
                <p className="text-xs font-code text-[var(--text-secondary)] tabular-nums">
                  {projectDetail.id} · {t.projectLevels[projectDetail.level]} ·{' '}
                  {t.projectCategories[projectDetail.category]} ·{' '}
                  {t.projectDifficulties[projectDetail.difficulty]} ·{' '}
                  {pickText(projectDetail.estimatedTime, language)}
                </p>

                <h1 className="font-editorial text-2xl sm:text-3xl font-normal tracking-[-0.02em] text-[var(--text-primary)]">
                  {pickText(projectDetail.title, language)}
                </h1>

                {story && (
                  <p className="text-xs text-[var(--text-secondary)] font-medium">
                    {pickText(story.organization.name, language)}
                  </p>
                )}

                <p className="text-[11px] font-code text-[var(--text-muted)]">
                  {t.projects.noSolutionRule}
                </p>
              </div>

              {/* Manual Status & Bookmark Controls */}
              <div className="shrink-0 flex flex-col gap-2.5 min-w-[220px]">
                {onToggleBookmark && (
                  <button
                    type="button"
                    onClick={() =>
                      onToggleBookmark({
                        itemType: 'project',
                        itemId: projectDetail.id,
                        itemTitleEn: projectDetail.title.en,
                        itemTitleBn: projectDetail.title.bn,
                      })
                    }
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
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

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`status-select-${projectDetail.id}`}
                    className="text-xs font-code text-[var(--text-secondary)]"
                  >
                    {t.projects.projectStatusLabel}
                  </label>
                  <select
                    id={`status-select-${projectDetail.id}`}
                    value={workspaceEntry.status}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as ProjectStatus)
                    }
                    className="px-3 py-2 text-xs font-medium rounded-md border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                  >
                    {PROJECT_STATUSES.map((statusValue) => (
                      <option key={statusValue} value={statusValue}>
                        {t.projectStatuses[statusValue]}
                      </option>
                    ))}
                  </select>
                </div>

                {statusGuardWarning && (
                  <p
                    role="alert"
                    className="text-[11px] text-[var(--text-primary)] bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded px-2.5 py-2 leading-relaxed"
                  >
                    {t.projects.completeAllWarning}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t surface-divider space-y-4">
              <p className="text-sm sm:text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-[75ch]">
                {pickText(projectDetail.overview, language)}
              </p>

              {/* Completion Checklist Progress Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-code text-[var(--text-muted)] tabular-nums">
                  <span>{t.projects.checklistProgressLabel}</span>
                  <span>
                    {checklistStats.completed} / {checklistStats.total}{' '}
                    {t.projects.checklistItemsUnit} · {checklistStats.percent}%
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${checklistStats.percent}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Collapsible Section Controls & Quick-Jump Index */}
          <section
            aria-label={t.projects.sectionsToolbarAria}
            className="surface-card rounded-lg p-4 sm:p-5 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t.projects.sectionsCollapsedNotice}
              </p>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={expandAllSections}
                  className="px-3 py-1.5 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
                >
                  {t.projects.expandAllSections}
                </button>
                <button
                  type="button"
                  onClick={collapseAllSections}
                  className="px-3 py-1.5 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
                >
                  {t.projects.collapseAllSections}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t surface-divider flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-code text-[var(--text-muted)] mr-1.5">
                {t.projects.quickJumpLabel}:
              </span>
              {GUIDE_SECTION_IDS.map((secId, index) => {
                const active = openSections.has(secId);
                return (
                  <button
                    key={secId}
                    type="button"
                    onClick={() => jumpToSection(secId)}
                    title={sectionTitles[secId]}
                    className={`px-2.5 py-1 text-[11px] font-code rounded border transition-colors whitespace-nowrap tabular-nums ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {(index + 1).toString().padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 12 COLLAPSIBLE SECTIONS (ALL COLLAPSED BY DEFAULT) */}
          <div className="space-y-4">
            {/* 1. STORY */}
            <CollapsibleSectionCard
              sectionId="s01"
              title={t.projects.s01Title}
              metaText={
                story ? pickText(story.organization.name, language) : undefined
              }
              isOpen={openSections.has('s01')}
              onToggle={() => toggleSection('s01')}
            >
              {story ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b surface-divider">
                    <p className="text-xs font-code text-[var(--text-muted)]">
                      {t.projects.noCodeBadge}
                    </p>
                    <button
                      type="button"
                      onClick={() => setBilingualMode((prev) => !prev)}
                      aria-pressed={bilingualMode}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        bilingualMode ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      <Languages className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.projects.bilingualToggle}</span>
                    </button>
                  </div>

                  {/* Previous Story Connection */}
                  <div className="space-y-2 max-w-[75ch]">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.sec01Title}
                    </h3>
                    <p className="text-sm sm:text-[15px] text-[var(--text-primary)] leading-[1.75]">
                      {renderText(story.previousConnection)}
                    </p>
                    {bilingualMode && (
                      <p className="text-sm text-[var(--text-secondary)] leading-[1.75] pt-2 border-t surface-divider">
                        {renderText(
                          story.previousConnection,
                          language === 'en' ? 'bn' : 'en'
                        )}
                      </p>
                    )}
                  </div>

                  {/* Story Narrative (EN / বাংলা / Bilingual Side-by-Side) */}
                  {(language === 'en' || bilingualMode) && (
                    <div className="pt-4 border-t surface-divider space-y-3 max-w-[75ch]">
                      <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                        {t.projects.sec02Title}
                      </h3>
                      <div className="space-y-3.5">
                        {story.storyNarrative.map((para, idx) => (
                          <p
                            key={idx}
                            className="text-sm sm:text-[15px] text-[var(--text-primary)] leading-[1.8]"
                          >
                            {para.en}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {(language === 'bn' || bilingualMode) && (
                    <div className="pt-4 border-t surface-divider space-y-3 max-w-[75ch]">
                      <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                        {t.projects.sec03Title}
                      </h3>
                      <div className="space-y-3.5">
                        {story.storyNarrative.map((para, idx) => (
                          <p
                            key={idx}
                            className="text-sm sm:text-[15px] text-[var(--text-primary)] leading-[1.85]"
                          >
                            {para.bn}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meet the Characters */}
                  <div className="pt-4 border-t surface-divider space-y-3">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.sec04Title}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {story.characterRoles.map((char) => (
                        <div
                          key={char.characterId}
                          className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 space-y-2"
                        >
                          <div>
                            <h4 className="text-sm font-medium text-[var(--text-primary)]">
                              {renderText(char.name)}
                            </h4>
                            <p className="text-xs font-code text-[var(--text-secondary)]">
                              {renderText(char.roleInProject)}
                            </p>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed pt-2 border-t surface-divider">
                            {renderText(char.responsibility)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Organization Context */}
                  <div className="pt-4 border-t surface-divider space-y-3">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.sec05Title}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-code text-[var(--text-muted)] uppercase tracking-wider">
                            {t.projects.orgNameLabel}
                          </p>
                          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                            {renderText(story.organization.name)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-code text-[var(--text-muted)] uppercase tracking-wider">
                            {t.projects.orgDomainLabel}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {renderText(story.organization.domain)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-code text-[var(--text-muted)] uppercase tracking-wider">
                            {t.projects.orgCurrentSystemLabel}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-primary)] leading-relaxed">
                            {renderText(story.organization.currentSystem)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-code text-[var(--text-muted)] uppercase tracking-wider">
                            {t.projects.orgReqSummaryLabel}
                          </p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
                            {renderText(story.organization.requirementsSummary)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Problem Discovery */}
                  <div className="pt-4 border-t surface-divider space-y-3 max-w-[75ch]">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.sec06Title}
                    </h3>
                    {story.problemDiscovery.map((para, idx) => (
                      <p
                        key={idx}
                        className="text-sm sm:text-[15px] text-[var(--text-primary)] leading-[1.75]"
                      >
                        {renderText(para)}
                      </p>
                    ))}
                  </div>

                  {/* Conversations */}
                  <div className="pt-4 border-t surface-divider space-y-3">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.sec07Title}
                    </h3>
                    <div className="divide-y divide-[var(--border-color)]">
                      {story.conversations.map((dialogue, idx) => (
                        <div key={idx} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                              {renderText(dialogue.speaker)}
                            </span>
                            <span className="text-xs font-code text-[var(--text-muted)]">
                              · {renderText(dialogue.role)}
                            </span>
                          </div>
                          <p className="text-sm sm:text-[15px] text-[var(--text-secondary)] leading-[1.75] max-w-[75ch]">
                            “{renderText(dialogue.line)}”
                          </p>
                          {bilingualMode && (
                            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed max-w-[75ch]">
                              “
                              {renderText(
                                dialogue.line,
                                language === 'en' ? 'bn' : 'en'
                              )}
                              ”
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Your Mission */}
                  <div className="pt-4 border-t surface-divider space-y-3 max-w-[75ch]">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.sec08Title}
                    </h3>
                    <div className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 sm:p-5 space-y-3">
                      <p className="text-sm sm:text-[15px] text-[var(--text-primary)] leading-[1.8] font-medium">
                        {renderText(story.mission)}
                      </p>
                      {bilingualMode && (
                        <p className="text-sm text-[var(--text-secondary)] leading-[1.8] pt-3 border-t surface-divider">
                          {renderText(story.mission, language === 'en' ? 'bn' : 'en')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* What We Learned & Bridge to Next */}
                  <div className="pt-4 border-t surface-divider grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                        {t.projects.reflectionsLabel}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--text-primary)] leading-[1.75]">
                        {renderText(story.whatWeLearned.reflections)}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                        {t.projects.bridgeToNextLabel}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] leading-[1.75]">
                        {renderText(story.whatWeLearned.bridgeToNext)}
                      </p>
                      {hasNext && (
                        <button
                          type="button"
                          onClick={onNext}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
                        >
                          <span>{t.projects.nextProject}</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  {pickText(projectDetail.realWorldProblem, language)}
                </p>
              )}
            </CollapsibleSectionCard>

            {/* 2. PROJECT OVERVIEW */}
            <CollapsibleSectionCard
              sectionId="s02"
              title={t.projects.s02Title}
              metaText={`${projectDetail.functionalRequirements.length}F · ${projectDetail.nonFunctionalRequirements.length}N`}
              isOpen={openSections.has('s02')}
              onToggle={() => toggleSection('s02')}
            >
              <div className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 space-y-2 max-w-[75ch]">
                <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                  {t.projects.realWorldProblemLabel}
                </h3>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  {pickText(projectDetail.realWorldProblem, language)}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.whyItMattersLabel}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                    {pickText(projectDetail.whyItMatters, language)}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.useCasesLabel}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {projectDetail.realWorldUseCases.map((useCase, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-[var(--text-secondary)] leading-relaxed"
                      >
                        · {pickText(useCase, language)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t surface-divider">
                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.functionalReqLabel}
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {projectDetail.functionalRequirements.map((req, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-[var(--text-primary)] leading-relaxed"
                      >
                        <span className="font-code text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
                          F{idx + 1}
                        </span>
                        <span>{pickText(req, language)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.nonFunctionalReqLabel}
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {projectDetail.nonFunctionalRequirements.map((req, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] leading-relaxed"
                      >
                        <span className="font-code text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
                          N{idx + 1}
                        </span>
                        <span>{pickText(req, language)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t surface-divider">
                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.expectedFeaturesLabel}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {projectDetail.expectedFeatures.map((feat, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-[var(--text-primary)] leading-relaxed"
                      >
                        · {pickText(feat, language)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.constraintsLabel}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {projectDetail.constraints.map((constraint, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-[var(--text-secondary)] leading-relaxed"
                      >
                        · {pickText(constraint, language)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {story && story.learningGoals.length > 0 && (
                <div className="pt-4 border-t surface-divider space-y-3">
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.sec11Title}
                  </h3>
                  <ul className="space-y-2">
                    {story.learningGoals.map((goal, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-sm text-[var(--text-primary)] leading-relaxed"
                      >
                        <span className="font-code text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span>{renderText(goal)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CollapsibleSectionCard>

            {/* 3. PYTHON TECHNOLOGIES & TOOLS */}
            <CollapsibleSectionCard
              sectionId="s03"
              title={t.projects.s03Title}
              metaText={
                guide
                  ? `${guide.standardLibrary.length} Stdlib · ${guide.externalLibraries.length} pip`
                  : undefined
              }
              isOpen={openSections.has('s03')}
              onToggle={() => toggleSection('s03')}
            >
              {guide ? (
                <div className="space-y-6">
                  {/* A. Core Python Concepts */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.coreConceptsHeading}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {guide.coreConcepts.map((concept, idx) => (
                        <div
                          key={idx}
                          className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 space-y-2"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <h4 className="text-sm font-medium text-[var(--text-primary)]">
                              {renderText(concept.name)}
                            </h4>
                            {concept.pylogicPart && onOpenCurriculumPart && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenCurriculumPart(concept.pylogicPart!)
                                }
                                className="text-[11px] font-code text-[var(--text-primary)] underline underline-offset-4 whitespace-nowrap shrink-0"
                              >
                                {t.projects.partShortPrefix}{' '}
                                {formatTwoDigits(concept.pylogicPart)}
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            {renderText(concept.explanation)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* B. Python Standard Library (Built-in) */}
                  <div className="pt-4 border-t surface-divider space-y-3">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.standardLibraryHeading}
                    </h3>
                    {renderLibraryCards(guide.standardLibrary)}
                  </div>

                  {/* C. External Python Libraries */}
                  <div className="pt-4 border-t surface-divider space-y-3">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.externalLibrariesHeading}
                    </h3>
                    {guide.externalLibraries.length > 0 ? (
                      renderLibraryCards(guide.externalLibraries)
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        {t.projects.noExternalLibsNote}
                      </p>
                    )}
                  </div>

                  {/* D. Python Command Reference */}
                  <div className="pt-4 border-t surface-divider space-y-3">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.commandReferenceHeading}
                    </h3>
                    <div className="overflow-x-auto rounded-md border border-[var(--border-color)]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-color)] text-[11px] font-code text-[var(--text-muted)] uppercase tracking-wider">
                            <th className="py-2.5 px-3.5">{t.projects.commandCol}</th>
                            <th className="py-2.5 px-3.5">{t.projects.whenToUseCol}</th>
                            <th className="py-2.5 px-3.5">{t.projects.whyUsedCol}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)] text-sm">
                          {guide.commandReference.map((cmd, idx) => (
                            <tr key={idx} className="align-top">
                              <td className="py-3 px-3.5 font-code text-xs text-[var(--text-primary)] whitespace-nowrap">
                                <code>{cmd.command}</code>
                              </td>
                              <td className="py-3 px-3.5 text-[var(--text-primary)] min-w-[200px]">
                                {renderText(cmd.whenToUse)}
                              </td>
                              <td className="py-3 px-3.5 text-[var(--text-secondary)] min-w-[220px]">
                                {renderText(cmd.whyUsed)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.technicalSkillsLabel}
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {projectDetail.requiredTechnicalSkills.map((skill, idx) => (
                        <li key={idx} className="text-sm text-[var(--text-primary)]">
                          · {pickText(skill, language)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.pythonConceptsLabel}
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {projectDetail.requiredPythonConcepts.map((concept, idx) => (
                        <li key={idx} className="text-sm text-[var(--text-primary)]">
                          · {pickText(concept, language)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.toolsTechLabel}
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {projectDetail.requiredToolsAndTech.map((tool, idx) => (
                        <li key={idx} className="text-sm text-[var(--text-secondary)]">
                          · {pickText(tool, language)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CollapsibleSectionCard>

            {/* 4. SKILL PREREQUISITES */}
            <CollapsibleSectionCard
              sectionId="s04"
              title={t.projects.s04Title}
              metaText={
                guide
                  ? `${t.projects.skillDifficulties[guide.skillPrerequisites.difficulty]}`
                  : undefined
              }
              isOpen={openSections.has('s04')}
              onToggle={() => toggleSection('s04')}
            >
              {guide ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-code">
                    <span className="text-[var(--text-muted)]">
                      {t.projects.difficultyLabel}:
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-primary)]">
                      {t.projects.skillDifficulties[guide.skillPrerequisites.difficulty]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                        {t.projects.requiredPythonLabel}
                      </h3>
                      <ul className="mt-2.5 space-y-2">
                        {guide.skillPrerequisites.requiredPythonKnowledge.map(
                          (item, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-[var(--text-primary)] leading-relaxed"
                            >
                              · {renderText(item)}
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                        {t.projects.requiredConceptsLabel}
                      </h3>
                      <ul className="mt-2.5 space-y-2">
                        {guide.skillPrerequisites.requiredProgrammingConcepts.map(
                          (item, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-[var(--text-primary)] leading-relaxed"
                            >
                              · {renderText(item)}
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                        {t.projects.recommendedKnowledgeLabel}
                      </h3>
                      <ul className="mt-2.5 space-y-2">
                        {guide.skillPrerequisites.recommendedPreviousKnowledge.map(
                          (item, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-[var(--text-secondary)] leading-relaxed"
                            >
                              · {renderText(item)}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Study Before Starting with PYLOGIC Part Links */}
                  <div className="pt-4 border-t surface-divider space-y-3">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.studyBeforeStartingLabel}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {guide.skillPrerequisites.studyBeforeStarting.map(
                        (studyRef, idx) => (
                          <div
                            key={idx}
                            className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-1.5">
                              <h4 className="text-sm font-medium text-[var(--text-primary)]">
                                {renderText(studyRef.concept)}
                              </h4>
                              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                {renderText(studyRef.shortExplanation)}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2 border-t surface-divider">
                              <span className="text-xs font-code text-[var(--text-muted)]">
                                {renderText(studyRef.partLabel)}
                              </span>
                              {onOpenCurriculumPart && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenCurriculumPart(studyRef.pylogicPart)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded btn-secondary whitespace-nowrap"
                                >
                                  <span>
                                    {t.projects.openPartLink}{' '}
                                    {formatTwoDigits(studyRef.pylogicPart)}
                                  </span>
                                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  {projectDetail.requiredTechnicalSkills
                    .map((s) => pickText(s, language))
                    .join(' · ')}
                </p>
              )}
            </CollapsibleSectionCard>

            {/* 5. PROJECT BUILD ROADMAP (10 STEPS) */}
            <CollapsibleSectionCard
              sectionId="s05"
              title={t.projects.s05Title}
              metaText={guide ? `${guide.buildRoadmap.length} Steps` : undefined}
              isOpen={openSections.has('s05')}
              onToggle={() => toggleSection('s05')}
            >
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-[75ch]">
                {t.projects.roadmapIntro}
              </p>

              {guide && (
                <ol className="space-y-3">
                  {guide.buildRoadmap.map((step) => (
                    <li
                      key={step.stepNumber}
                      className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 sm:p-5 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-baseline gap-2.5">
                        <span className="font-code text-xs text-[var(--text-muted)] tabular-nums">
                          {t.projects.stepPrefix}{' '}
                          {step.stepNumber.toString().padStart(2, '0')}
                        </span>
                        <h3 className="text-sm sm:text-[15px] font-medium text-[var(--text-primary)]">
                          {renderText(step.title)}
                        </h3>
                      </div>

                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                        <span className="font-code text-xs text-[var(--text-muted)] mr-2">
                          {t.projects.objectiveLabel}:
                        </span>
                        {renderText(step.objective)}
                      </p>

                      <ul className="space-y-1.5">
                        {step.details.map((detail, dIdx) => (
                          <li
                            key={dIdx}
                            className="text-sm text-[var(--text-secondary)] leading-relaxed"
                          >
                            · {renderText(detail)}
                          </li>
                        ))}
                      </ul>

                      {step.guidingNote && (
                        <p className="text-xs text-[var(--text-muted)] pt-2 border-t surface-divider leading-relaxed">
                          <span className="font-code mr-1.5">
                            {t.projects.guidingNoteLabel}:
                          </span>
                          {renderText(step.guidingNote)}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {/* Preserved Story Logic-Building Guiding Questions */}
              {story && (
                <div className="pt-4 border-t surface-divider space-y-3">
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.sec09Title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-[75ch]">
                    {renderText(story.logicBuilding.intro)}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {story.logicBuilding.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 space-y-2"
                      >
                        <h4 className="text-sm font-medium text-[var(--text-primary)]">
                          {renderText(step.stepTitle)}
                        </h4>
                        <ul className="space-y-1.5">
                          {step.guidingQuestions.map((q, qIdx) => (
                            <li
                              key={qIdx}
                              className="flex items-start gap-2 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed"
                            >
                              <span className="font-code text-xs text-[var(--text-muted)] mt-0.5 shrink-0">
                                ?
                              </span>
                              <span>{renderText(q)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleSectionCard>

            {/* 6. PYTHON CONCEPT MAPPING */}
            <CollapsibleSectionCard
              sectionId="s06"
              title={t.projects.s06Title}
              metaText={
                guide ? `${guide.conceptMapping.length} Rows` : undefined
              }
              isOpen={openSections.has('s06')}
              onToggle={() => toggleSection('s06')}
            >
              <p className="text-sm text-[var(--text-secondary)]">
                {t.projects.mapIntro}
              </p>

              {guide && (
                <div className="overflow-x-auto rounded-md border border-[var(--border-color)]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-color)] text-[11px] font-code text-[var(--text-muted)] uppercase tracking-wider">
                        <th className="py-2.5 px-3.5">{t.projects.mapColFeature}</th>
                        <th className="py-2.5 px-3.5">{t.projects.mapColConcept}</th>
                        <th className="py-2.5 px-3.5">{t.projects.mapColModule}</th>
                        <th className="py-2.5 px-3.5">{t.projects.mapColPurpose}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] text-sm">
                      {guide.conceptMapping.map((row, idx) => (
                        <tr key={idx} className="align-top">
                          <td className="py-3 px-3.5 font-medium text-[var(--text-primary)] min-w-[180px]">
                            {renderText(row.feature)}
                          </td>
                          <td className="py-3 px-3.5 text-[var(--text-primary)] min-w-[170px]">
                            {renderText(row.concept)}
                          </td>
                          <td className="py-3 px-3.5 font-code text-xs text-[var(--text-secondary)] whitespace-nowrap">
                            <code>{row.moduleOrLibrary}</code>
                          </td>
                          <td className="py-3 px-3.5 text-[var(--text-secondary)] min-w-[220px]">
                            {renderText(row.purpose)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleSectionCard>

            {/* 7. THINKING CHALLENGES */}
            <CollapsibleSectionCard
              sectionId="s07"
              title={t.projects.s07Title}
              metaText={`${projectDetail.thinkingChallenges.length}`}
              isOpen={openSections.has('s07')}
              onToggle={() => toggleSection('s07')}
            >
              <p className="text-sm text-[var(--text-secondary)]">
                {t.projects.thinkingIntro}
              </p>

              <ol className="divide-y divide-[var(--border-color)] border-t surface-divider">
                {projectDetail.thinkingChallenges.map((question, idx) => (
                  <li key={idx} className="py-3.5 flex items-start gap-3">
                    <span className="font-code text-xs text-[var(--text-muted)] tabular-nums mt-0.5 shrink-0">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="text-sm text-[var(--text-primary)] leading-relaxed">
                      {pickText(question, language)}
                    </span>
                  </li>
                ))}
              </ol>

              {projectDetail.bonusChallenges.length > 0 && (
                <div className="pt-4 border-t surface-divider space-y-3">
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.sec16Title}
                  </h3>
                  <ul className="divide-y divide-[var(--border-color)]">
                    {projectDetail.bonusChallenges.map((bonus, idx) => (
                      <li
                        key={idx}
                        className="py-3 first:pt-0 last:pb-0 flex items-start gap-3"
                      >
                        <span className="font-code text-xs text-[var(--text-muted)] tabular-nums mt-0.5 shrink-0">
                          +{(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          {pickText(bonus, language)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CollapsibleSectionCard>

            {/* 8. PROGRESSIVE HINTS */}
            <CollapsibleSectionCard
              sectionId="s08"
              title={t.projects.s08Title}
              metaText="3 Hints"
              isOpen={openSections.has('s08')}
              onToggle={() => toggleSection('s08')}
            >
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t.projects.hintsNotice}
              </p>

              <div className="divide-y divide-[var(--border-color)] border-t surface-divider">
                {(
                  [
                    {
                      key: 'level1',
                      title: t.projects.hint1Title,
                      revealed: showHint1,
                      toggle: () => setShowHint1((prev) => !prev),
                      content: projectDetail.hints.level1,
                    },
                    {
                      key: 'level2',
                      title: t.projects.hint2Title,
                      revealed: showHint2,
                      toggle: () => setShowHint2((prev) => !prev),
                      content: projectDetail.hints.level2,
                    },
                    {
                      key: 'level3',
                      title: t.projects.hint3Title,
                      revealed: showHint3,
                      toggle: () => setShowHint3((prev) => !prev),
                      content: projectDetail.hints.level3,
                    },
                  ] as const
                ).map((hintItem) => (
                  <div key={hintItem.key} className="py-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-[var(--text-primary)]">
                        {hintItem.title}
                      </h3>
                      <button
                        type="button"
                        onClick={hintItem.toggle}
                        aria-expanded={hintItem.revealed}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
                      >
                        <span>
                          {hintItem.revealed
                            ? t.projects.hideHint
                            : t.projects.revealHint}
                        </span>
                        {hintItem.revealed ? (
                          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {hintItem.revealed && (
                      <p className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 text-sm text-[var(--text-primary)] leading-relaxed">
                        {pickText(hintItem.content, language)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSectionCard>

            {/* 9. TESTING GUIDE */}
            <CollapsibleSectionCard
              sectionId="s09"
              title={t.projects.s09Title}
              metaText={`${projectDetail.testingRequirements.length} Tests`}
              isOpen={openSections.has('s09')}
              onToggle={() => toggleSection('s09')}
            >
              {story && story.testingScenarios.length > 0 && (
                <div className="pb-4 border-b surface-divider space-y-2.5">
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.sec14Title}
                  </h3>
                  {story.testingScenarios.map((scenario, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-sm text-[var(--text-primary)] leading-relaxed"
                    >
                      <span className="font-code text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
                        T{idx + 1}
                      </span>
                      <span>{renderText(scenario)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.testingChecklistLabel}
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {projectDetail.testingRequirements.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-[var(--text-primary)] leading-relaxed"
                      >
                        <span className="font-code text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
                          [ ]
                        </span>
                        <span>{pickText(item, language)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.securityChecklistLabel}
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {projectDetail.securityConsiderations.map((sec, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)] leading-relaxed"
                      >
                        <span className="font-code text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span>{pickText(sec, language)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {story && story.acceptanceCriteria.length > 0 && (
                <div className="pt-4 border-t surface-divider space-y-2.5">
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.sec15Title}
                  </h3>
                  <ul className="space-y-2">
                    {story.acceptanceCriteria.map((criterion, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-[var(--text-primary)] leading-relaxed"
                      >
                        <span className="font-code text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
                          AC{(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span>{renderText(criterion)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 border-t surface-divider space-y-1.5">
                <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                  {t.projects.dataStorageLabel}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {pickText(projectDetail.dataStorageRequirements, language)}
                </p>
              </div>
            </CollapsibleSectionCard>

            {/* 10. COMPLETION TRACKER */}
            <CollapsibleSectionCard
              sectionId="s10"
              title={t.projects.s10Title}
              metaText={`${checklistStats.completed}/${checklistStats.total} · ${checklistStats.percent}%`}
              isOpen={openSections.has('s10')}
              onToggle={() => toggleSection('s10')}
            >
              <p className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-3.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                {t.projects.trackerDisclaimer}
              </p>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-code text-[var(--text-secondary)] tabular-nums">
                  <span>{t.projects.checklistProgressLabel}</span>
                  <span>
                    {checklistStats.completed} / {checklistStats.total}{' '}
                    {t.projects.checklistItemsUnit} ({checklistStats.percent}%)
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${checklistStats.percent}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)]">
                {t.projects.manualCompletionGuardNote}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PROJECT_CHECKLIST_KEYS.map((key, idx) => {
                  const checked = Boolean(checklist[key]);
                  const labelText = t.projects.checklist[key];
                  return (
                    <label
                      key={key}
                      htmlFor={`chk-${projectDetail.id}-${key}`}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-[var(--bg-subtle)] border-[var(--text-secondary)] text-[var(--text-primary)]'
                          : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      <input
                        id={`chk-${projectDetail.id}-${key}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleChecklistItem(key)}
                        className="sr-only"
                      />
                      <span className="shrink-0 text-[var(--text-primary)]" aria-hidden="true">
                        {checked ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                      </span>
                      <span className="font-code text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <span className="text-xs sm:text-sm font-medium leading-snug">
                        {labelText}
                      </span>
                    </label>
                  );
                })}
              </div>
            </CollapsibleSectionCard>

            {/* 11. MY PROJECT WORKSPACE */}
            <CollapsibleSectionCard
              sectionId="s11"
              title={t.projects.s11Title}
              metaText={t.projects.savedIndicator}
              isOpen={openSections.has('s11')}
              onToggle={() => toggleSection('s11')}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b surface-divider">
                <div className="max-w-2xl">
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {t.projects.workspaceIntro}
                  </p>
                  <p className="mt-2 text-xs font-code text-[var(--text-muted)]">
                    {t.projects.savedIndicator} · {t.projects.lastUpdatedLabel}:{' '}
                    {formattedUpdatedAt}
                  </p>
                </div>

                <div className="shrink-0">
                  {!confirmClear ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="px-3.5 py-2 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
                    >
                      {t.projects.resetWorkspaceBtn}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClearNotes(projectDetail.id);
                          setConfirmClear(false);
                        }}
                        className="px-3.5 py-2 text-xs font-medium rounded-md btn-primary whitespace-nowrap"
                      >
                        {t.projects.resetWorkspaceBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        aria-label={t.nav.closeMenu}
                        className="px-3 py-2 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Editable GitHub Repository URL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={`field-github-${projectDetail.id}`}
                    className="block text-xs font-code text-[var(--text-secondary)]"
                  >
                    {t.projects.fieldGithubUrl}
                  </label>
                  {repoUrlSafe && (
                    <a
                      href={workspaceEntry.notes.githubRepoUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)] underline underline-offset-4"
                    >
                      <span>GitHub</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
                <input
                  id={`field-github-${projectDetail.id}`}
                  type="url"
                  value={workspaceEntry.notes.githubRepoUrl}
                  onChange={(e) => handleNoteChange('githubRepoUrl', e.target.value)}
                  placeholder={t.projects.placeholderGithubUrl}
                  className="w-full px-3.5 py-2.5 text-sm font-code rounded-md border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>

              {/* All 14 Personal Engineering Workspace Fields (11 requested + 3 legacy preserved) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(
                  [
                    {
                      field: 'myUnderstanding',
                      label: t.projects.fieldMyUnderstanding,
                      placeholder: t.projects.placeholderMyUnderstanding,
                    },
                    {
                      field: 'myRequirements',
                      label: t.projects.fieldMyRequirements,
                      placeholder: t.projects.placeholderMyRequirements,
                    },
                    {
                      field: 'myLogic',
                      label: t.projects.fieldMyLogic,
                      placeholder: t.projects.placeholderMyLogic,
                    },
                    {
                      field: 'myAlgorithm',
                      label: t.projects.fieldMyAlgorithm,
                      placeholder: t.projects.placeholderMyAlgorithm,
                    },
                    {
                      field: 'folderStructureNotes',
                      label: t.projects.fieldFolderStructure,
                      placeholder: t.projects.placeholderFolderStructure,
                    },
                    {
                      field: 'myPythonConcepts',
                      label: t.projects.fieldMyPythonConcepts,
                      placeholder: t.projects.placeholderMyPythonConcepts,
                    },
                    {
                      field: 'implementationNotes',
                      label: t.projects.fieldImplementationNotes,
                      placeholder: t.projects.placeholderImplementationNotes,
                    },
                    {
                      field: 'problemsFaced',
                      label: t.projects.fieldProblemsFaced,
                      placeholder: t.projects.placeholderProblemsFaced,
                    },
                    {
                      field: 'howISolvedThem',
                      label: t.projects.fieldHowSolved,
                      placeholder: t.projects.placeholderHowSolved,
                    },
                    {
                      field: 'testingResults',
                      label: t.projects.fieldTestingResults,
                      placeholder: t.projects.placeholderTestingResults,
                    },
                    {
                      field: 'futureImprovements',
                      label: t.projects.fieldFutureImprovements,
                      placeholder: t.projects.placeholderFutureImprovements,
                    },
                    {
                      field: 'projectPlan',
                      label: t.projects.fieldProjectPlan,
                      placeholder: t.projects.placeholderProjectPlan,
                    },
                    {
                      field: 'architectureNotes',
                      label: t.projects.fieldArchitectureNotes,
                      placeholder: t.projects.placeholderArchitectureNotes,
                    },
                    {
                      field: 'implementationDecisions',
                      label: t.projects.fieldImplementationDecisions,
                      placeholder: t.projects.placeholderImplementationDecisions,
                    },
                  ] as const
                ).map((item) => (
                  <div key={item.field} className="space-y-2">
                    <label
                      htmlFor={`field-${item.field}-${projectDetail.id}`}
                      className="block text-xs font-code text-[var(--text-secondary)]"
                    >
                      {item.label}
                    </label>
                    <textarea
                      id={`field-${item.field}-${projectDetail.id}`}
                      rows={4}
                      value={workspaceEntry.notes[item.field] ?? ''}
                      onChange={(e) => handleNoteChange(item.field, e.target.value)}
                      placeholder={item.placeholder}
                      className="w-full px-3.5 py-2.5 text-sm rounded-md border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] leading-relaxed resize-y"
                    />
                  </div>
                ))}
              </div>
            </CollapsibleSectionCard>

            {/* 12. GITHUB SUBMISSION GUIDE */}
            <CollapsibleSectionCard
              sectionId="s12"
              title={t.projects.s12Title}
              metaText={`${projectDetail.expectedDeliverables.length} Deliverables`}
              isOpen={openSections.has('s12')}
              onToggle={() => toggleSection('s12')}
            >
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t.projects.githubSubmissionIntro}
              </p>

              {story && (
                <p className="text-sm text-[var(--text-primary)] leading-relaxed pb-4 border-b surface-divider">
                  {renderText(story.finalDeliverySummary)}
                </p>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <pre className="rounded-md bg-[var(--bg-subtle)] border border-[var(--border-color)] p-4 text-xs font-code text-[var(--text-primary)] overflow-x-auto leading-relaxed">
                  {projectDetail.suggestedFolderStructure.join('\n')}
                </pre>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.architectureNoteLabel}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--text-primary)] leading-relaxed">
                      {pickText(projectDetail.folderStructureNote, language)}
                    </p>
                  </div>

                  <div className="pt-4 border-t surface-divider">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.targetRolesLabel}
                    </h3>
                    <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                      {projectDetail.careerRelevance.jobRoles
                        .map((role) => pickText(role, language))
                        .join(' · ')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t surface-divider">
                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.deliverablesLabel}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {projectDetail.expectedDeliverables.map((deliv, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-[var(--text-primary)] leading-relaxed"
                      >
                        · {pickText(deliv, language)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                    {t.projects.githubGuidelinesLabel}
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {projectDetail.githubPortfolioRequirements.map((gItem, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-[var(--text-secondary)] leading-relaxed"
                      >
                        · {pickText(gItem, language)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t surface-divider">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.industryRelevanceLabel}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                      {pickText(
                        projectDetail.careerRelevance.industryRelevance,
                        language
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.githubPortfolioValueLabel}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                      {pickText(
                        projectDetail.careerRelevance.githubPortfolioValue,
                        language
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.practicalSkillsLabel}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {projectDetail.careerRelevance.practicalSkillsDemonstrated.map(
                        (skill, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-[var(--text-primary)] leading-relaxed"
                          >
                            · {pickText(skill, language)}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                  <div className="pt-3 border-t surface-divider">
                    <h3 className="text-xs font-code text-[var(--text-muted)] uppercase tracking-wider">
                      {t.projects.interviewTopicsLabel}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {projectDetail.careerRelevance.interviewTopics.map(
                        (topic, idx) => (
                          <li
                            key={idx}
                            className="text-sm text-[var(--text-secondary)] leading-relaxed"
                          >
                            · {pickText(topic, language)}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </CollapsibleSectionCard>
          </div>
        </>
      )}
    </div>
  );
}
