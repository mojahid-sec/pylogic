import { ArrowRight, Bookmark, Search } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type {
  LanguageCode,
  ProjectCategory,
  ProjectChecklistState,
  ProjectDetail,
  ProjectLevel,
  ProjectPersonalNotes,
  ProjectStatus,
  ProjectWorkspaceMap,
  SectionId,
  UserBookmark,
} from '../types/pylogic';
import { getTranslations, pickText } from '../utils/language';
import { scrollToTop } from '../utils/navigation';
import { loadProjectDetail, projectsCatalog } from '../utils/projectLoader';
import {
  clearProjectWorkspaceEntry,
  computeChecklistProgress,
  computeProjectProgress,
  getInitialProjectWorkspace,
  getProjectEntry,
  updateProjectChecklist,
  updateProjectNotes,
  updateProjectStatus,
} from '../utils/projectStorage';

const ProjectDetailWorkspace = lazy(() =>
  import('./ProjectDetailWorkspace').then((m) => ({
    default: m.ProjectDetailWorkspace,
  }))
);

interface ProjectsViewProps {
  language: LanguageCode;
  workspaceMap?: ProjectWorkspaceMap;
  bookmarks?: UserBookmark[];
  initialProjectId?: string | null;
  catalogResetKey?: number;
  onUpdateProjectStatus?: (projectId: string, status: ProjectStatus) => void;
  onUpdateProjectChecklist?: (
    projectId: string,
    checklist: ProjectChecklistState
  ) => void;
  onUpdateProjectNotes?: (projectId: string, notes: ProjectPersonalNotes) => void;
  onClearProjectNotes?: (projectId: string) => void;
  onToggleBookmark?: (bookmark: UserBookmark) => void;
  onOpenCurriculumPart?: (partNumber: number) => void;
  onNavigate?: (section: SectionId) => void;
}

const LEVEL_FILTERS: Array<ProjectLevel | 'All'> = [
  'All',
  'Level 01',
  'Level 02',
  'Level 03',
  'Level 04',
];

const CATEGORY_FILTERS: Array<ProjectCategory | 'All'> = [
  'All',
  'Python Foundations',
  'Data & Storage',
  'Automation & Ops',
  'Networking',
  'Defensive Security',
  'AppSec & Risk',
];

const STATUS_FILTERS: Array<ProjectStatus | 'All'> = [
  'All',
  'Not Started',
  'Planning',
  'In Progress',
  'Testing',
  'Completed',
];

export function ProjectsView({
  language,
  workspaceMap: controlledWorkspaceMap,
  bookmarks = [],
  initialProjectId = null,
  catalogResetKey = 0,
  onUpdateProjectStatus,
  onUpdateProjectChecklist,
  onUpdateProjectNotes,
  onClearProjectNotes,
  onToggleBookmark,
  onOpenCurriculumPart,
}: ProjectsViewProps) {
  const t = getTranslations(language);

  const [internalWorkspaceMap, setInternalWorkspaceMap] = useState<ProjectWorkspaceMap>(() =>
    getInitialProjectWorkspace()
  );
  const workspaceMap = controlledWorkspaceMap ?? internalWorkspaceMap;

  const [selectedLevel, setSelectedLevel] = useState<ProjectLevel | 'All'>('All');
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | 'All'>('All');
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId);
  const [activeDetail, setActiveDetail] = useState<ProjectDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState(false);
  const [detailReloadToken, setDetailReloadToken] = useState(0);

  useEffect(() => {
    if (initialProjectId) {
      setActiveProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  useEffect(() => {
    if (catalogResetKey > 0) {
      setActiveProjectId(null);
    }
  }, [catalogResetKey]);

  const progress = useMemo(
    () => computeProjectProgress(projectsCatalog, workspaceMap),
    [workspaceMap]
  );

  useEffect(() => {
    if (!activeProjectId) {
      setActiveDetail(null);
      setIsLoadingDetail(false);
      setDetailLoadError(false);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);
    setDetailLoadError(false);

    loadProjectDetail(activeProjectId)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        if (!detail) {
          setDetailLoadError(true);
          setActiveDetail(null);
        } else {
          setActiveDetail(detail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailLoadError(true);
          setActiveDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, detailReloadToken]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projectsCatalog.filter((project) => {
      if (selectedLevel !== 'All' && project.level !== selectedLevel) {
        return false;
      }
      if (selectedCategory !== 'All' && project.category !== selectedCategory) {
        return false;
      }
      const status = getProjectEntry(workspaceMap, project.id).status;
      if (selectedStatus !== 'All' && status !== selectedStatus) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = [
        project.id,
        project.title.en,
        project.title.bn,
        project.overview.en,
        project.overview.bn,
        project.category,
        t.projectCategories[project.category],
        ...project.requiredTechnicalSkills.flatMap((s) => [s.en, s.bn]),
        ...project.jobRoles.flatMap((r) => [r.en, r.bn]),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [
    searchQuery,
    selectedLevel,
    selectedCategory,
    selectedStatus,
    workspaceMap,
    t.projectCategories,
  ]);

  const hasActiveFilters =
    selectedLevel !== 'All' ||
    selectedCategory !== 'All' ||
    selectedStatus !== 'All' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedLevel('All');
    setSelectedCategory('All');
    setSelectedStatus('All');
    setSearchQuery('');
  };

  const handleUpdateStatus = (projectId: string, status: ProjectStatus) => {
    if (onUpdateProjectStatus) {
      onUpdateProjectStatus(projectId, status);
      return;
    }
    const existing = getProjectEntry(internalWorkspaceMap, projectId);
    if (status === 'Completed' && !existing.checklist?.finalProjectReviewed) {
      return;
    }
    setInternalWorkspaceMap((prev) => updateProjectStatus(prev, projectId, status));
  };

  const handleUpdateChecklist = (
    projectId: string,
    checklist: ProjectChecklistState
  ) => {
    if (onUpdateProjectChecklist) {
      onUpdateProjectChecklist(projectId, checklist);
      return;
    }
    setInternalWorkspaceMap((prev) =>
      updateProjectChecklist(prev, projectId, checklist)
    );
  };

  const handleUpdateNotes = (projectId: string, notes: ProjectPersonalNotes) => {
    if (onUpdateProjectNotes) {
      onUpdateProjectNotes(projectId, notes);
      return;
    }
    setInternalWorkspaceMap((prev) => updateProjectNotes(prev, projectId, notes));
  };

  const handleClearNotes = (projectId: string) => {
    if (onClearProjectNotes) {
      onClearProjectNotes(projectId);
      return;
    }
    setInternalWorkspaceMap((prev) => clearProjectWorkspaceEntry(prev, projectId));
  };

  const openProject = (projectId: string | null) => {
    setActiveProjectId(projectId);
    scrollToTop();
  };

  const activeCatalogIndex = activeProjectId
    ? projectsCatalog.findIndex((p) => p.id === activeProjectId)
    : -1;

  if (activeProjectId) {
    const isBookmarked = bookmarks.some(
      (b) => b.itemType === 'project' && b.itemId === activeProjectId
    );
    return (
      <Suspense
        fallback={
          <section className="surface-card rounded-lg p-8 text-sm text-[var(--text-secondary)]">
            {t.projects.loadingProject}
          </section>
        }
      >
        <ProjectDetailWorkspace
          language={language}
          projectId={activeProjectId}
          projectDetail={activeDetail}
          isLoading={isLoadingDetail}
          loadError={detailLoadError}
          workspaceEntry={getProjectEntry(workspaceMap, activeProjectId)}
          hasPrev={activeCatalogIndex > 0}
          hasNext={
            activeCatalogIndex >= 0 && activeCatalogIndex < projectsCatalog.length - 1
          }
          isBookmarked={isBookmarked}
          onToggleBookmark={onToggleBookmark}
          onOpenCurriculumPart={onOpenCurriculumPart}
          onRetry={() => setDetailReloadToken((prev) => prev + 1)}
          onBack={() => openProject(null)}
          onPrev={() => {
            if (activeCatalogIndex > 0) {
              openProject(projectsCatalog[activeCatalogIndex - 1].id);
            }
          }}
          onNext={() => {
            if (
              activeCatalogIndex >= 0 &&
              activeCatalogIndex < projectsCatalog.length - 1
            ) {
              openProject(projectsCatalog[activeCatalogIndex + 1].id);
            }
          }}
          onUpdateStatus={handleUpdateStatus}
          onUpdateChecklist={handleUpdateChecklist}
          onUpdateNotes={handleUpdateNotes}
          onClearNotes={handleClearNotes}
        />
      </Suspense>
    );
  }

  return (
    <div className="view-enter space-y-8">
      {/* Header */}
      <section className="max-w-3xl">
        <p className="text-xs font-code text-[var(--text-secondary)]">
          {t.projects.kicker}
        </p>
        <h1 className="mt-2 font-editorial text-3xl sm:text-4xl font-normal tracking-[-0.02em] text-[var(--text-primary)]">
          {t.projects.heading}
        </h1>
        <p className="mt-3 text-[15px] text-[var(--text-secondary)] leading-relaxed">
          {t.projects.intro}
        </p>
      </section>

      {/* Project Portfolio Progress Dashboard */}
      <section aria-label={t.projects.metricsAria} className="space-y-4">
        <div className="surface-card rounded-lg metric-grid-4 grid grid-cols-2 lg:grid-cols-4">
          <div className="p-5 sm:p-6">
            <p className="text-xs text-[var(--text-secondary)]">
              {t.projects.totalProjectsLabel}
            </p>
            <p className="mt-2 font-editorial text-3xl text-[var(--text-primary)] tabular-nums">
              {progress.totalProjects}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t.projects.totalProjectsSub}
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs text-[var(--text-secondary)]">
              {t.projects.notStartedLabel}
            </p>
            <p className="mt-2 font-editorial text-3xl text-[var(--text-primary)] tabular-nums">
              {progress.notStartedCount}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t.projects.notStartedSub}
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs text-[var(--text-secondary)]">
              {t.projects.inProgressLabel}
            </p>
            <p className="mt-2 font-editorial text-3xl text-[var(--text-primary)] tabular-nums">
              {progress.inProgressCount}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t.projects.inProgressSub}
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs text-[var(--text-secondary)]">
              {t.projects.completedLabel}
            </p>
            <p className="mt-2 font-editorial text-3xl text-[var(--text-primary)] tabular-nums">
              {progress.completedCount}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
              {progress.completionPercent}
              {t.projects.completedSubSuffix}
            </p>
          </div>
        </div>

        {/* Level-Wise Progress Breakdown */}
        <div className="surface-card rounded-lg p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-code text-[var(--text-secondary)] uppercase tracking-wider">
              {t.projects.levelBreakdownTitle}
            </h2>
            <span className="text-xs font-code text-[var(--text-muted)] tabular-nums">
              {progress.completedCount} / {progress.totalProjects}{' '}
              {t.projects.completedShort}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {progress.levelStats.map((stat) => (
              <div key={stat.level} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLevel(stat.level)}
                    className="text-xs font-medium text-[var(--text-primary)] hover:underline underline-offset-4 text-left"
                  >
                    {t.projectLevels[stat.level]}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] font-code text-[var(--text-muted)] tabular-nums">
                  <span>
                    {stat.completed} / {stat.total} {t.projects.projectsCountUnit}
                  </span>
                  <span>{stat.percent}%</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${stat.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section aria-label={t.projects.filterSectionAria} className="space-y-3">
        <div
          role="tablist"
          aria-label={t.projects.levelTabsAria}
          className="surface-card rounded-md p-1 inline-flex flex-wrap gap-1"
        >
          {LEVEL_FILTERS.map((level) => {
            const active = selectedLevel === level;
            return (
              <button
                key={level}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedLevel(level)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.projectLevels[level]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.projects.searchPlaceholder}
              aria-label={t.projects.searchAria}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label={t.projects.categoryFilterLabel}
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(e.target.value as ProjectCategory | 'All')
              }
              className="px-3 py-2 text-xs rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]"
            >
              <option value="All">{t.projects.allCategories}</option>
              {CATEGORY_FILTERS.filter((c) => c !== 'All').map((cat) => (
                <option key={cat} value={cat}>
                  {t.projectCategories[cat as ProjectCategory]}
                </option>
              ))}
            </select>

            <select
              aria-label={t.projects.statusFilterLabel}
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as ProjectStatus | 'All')
              }
              className="px-3 py-2 text-xs rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)]"
            >
              <option value="All">{t.projects.allStatuses}</option>
              {STATUS_FILTERS.filter((s) => s !== 'All').map((st) => (
                <option key={st} value={st}>
                  {t.projectStatuses[st as ProjectStatus]}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
              >
                {t.projects.resetFilters}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Catalog Grid or Empty Results */}
      {filteredProjects.length === 0 ? (
        <section className="surface-card rounded-lg p-8 text-center space-y-3">
          <h2 className="font-editorial text-xl font-normal text-[var(--text-primary)]">
            {t.projects.noResultsTitle}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            {t.projects.noResultsBody}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 text-xs font-medium rounded-md btn-primary"
            >
              {t.projects.resetFilters}
            </button>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const entry = getProjectEntry(workspaceMap, project.id);
            const checklistStats = computeChecklistProgress(entry.checklist);
            const isActiveOrDone = entry.status !== 'Not Started';
            const isProjectBookmarked = bookmarks.some(
              (b) => b.itemType === 'project' && b.itemId === project.id
            );

            return (
              <article
                key={project.id}
                className="surface-card rounded-lg p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-code text-[var(--text-secondary)] tabular-nums">
                      {project.id} · {project.level} ·{' '}
                      {t.projectCategories[project.category]} ·{' '}
                      {t.projectDifficulties[project.difficulty]}
                    </span>
                    <div className="flex items-center gap-2">
                      {isProjectBookmarked && (
                        <Bookmark
                          className="w-3.5 h-3.5 text-[var(--text-primary)] fill-current"
                          aria-label={t.bookmarks.saved}
                        />
                      )}
                      <span
                        className={`text-xs font-code whitespace-nowrap tabular-nums ${
                          isActiveOrDone
                            ? 'text-[var(--text-primary)] font-medium'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {t.projectStatuses[entry.status]}
                        {checklistStats.completed > 0
                          ? ` · ${checklistStats.percent}%`
                          : ''}
                      </span>
                    </div>
                  </div>

                  <h2 className="font-editorial text-xl font-normal text-[var(--text-primary)] leading-snug">
                    {pickText(project.title, language)}
                  </h2>

                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {pickText(project.overview, language)}
                  </p>
                </div>

                <div className="pt-4 border-t surface-divider flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[11px] font-code text-[var(--text-muted)] truncate">
                      {project.requiredTechnicalSkills
                        .map((skill) => pickText(skill, language))
                        .join(' · ')}
                    </p>
                    <p className="text-[11px] font-code text-[var(--text-secondary)] tabular-nums">
                      {pickText(project.estimatedTime, language)} ·{' '}
                      {project.jobRoles
                        .map((role) => pickText(role, language))
                        .join(' / ')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openProject(project.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md btn-secondary whitespace-nowrap shrink-0 self-start sm:self-end"
                  >
                    <span>{t.projects.openProjectBtn}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
