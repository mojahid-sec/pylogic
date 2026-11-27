import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  ActivityEntry,
  CurriculumPhase,
  CurriculumProblem,
  LanguageCode,
  SectionId,
} from '../types/pylogic';
import { getTranslations, pickText } from '../utils/language';
import { loadPartProblems } from '../utils/partLoader';
import {
  computeProgressSummary,
  curriculumData,
  formatTwoDigits,
  getActiveStudyPart,
  getPartSolvedCount,
} from '../utils/progress';

interface DashboardViewProps {
  language: LanguageCode;
  solvedIds: string[];
  activityLog: ActivityEntry[];
  onNavigate: (
    section: SectionId,
    options?: { partId?: string; problemId?: string; phase?: CurriculumPhase }
  ) => void;
}

export function DashboardView({
  language,
  solvedIds,
  activityLog,
  onNavigate,
}: DashboardViewProps) {
  const t = getTranslations(language);
  const summary = useMemo(
    () => computeProgressSummary(curriculumData.parts, solvedIds),
    [solvedIds]
  );
  const activePart = useMemo(
    () => getActiveStudyPart(curriculumData.parts, solvedIds),
    [solvedIds]
  );
  const activeSolvedCount = getPartSolvedCount(activePart.number, solvedIds);
  const activePartProgress = Math.round(
    (activeSolvedCount / activePart.problemCount) * 100
  );

  const [nextProblem, setNextProblem] = useState<CurriculumProblem | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activePart.contentReady) {
      setNextProblem(null);
      return;
    }

    loadPartProblems(activePart.number)
      .then((data) => {
        if (cancelled || !data) {
          return;
        }
        const firstUnsolved =
          data.problems.find((prob) => !solvedIds.includes(prob.id)) ??
          data.problems[0] ??
          null;
        setNextProblem(firstUnsolved);
      })
      .catch(() => {
        if (!cancelled) {
          setNextProblem(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activePart.number, activePart.contentReady, solvedIds]);

  return (
    <div className="view-enter space-y-10">
      {/* Welcome Header */}
      <section aria-labelledby="dashboard-heading" className="max-w-3xl">
        <p className="text-xs font-code text-[var(--text-secondary)] tracking-wide">
          {t.dashboard.kicker}
        </p>
        <h1
          id="dashboard-heading"
          className="mt-3 font-editorial text-3xl sm:text-4xl lg:text-[2.75rem] font-normal leading-[1.18] tracking-[-0.02em] text-[var(--text-primary)]"
        >
          {t.dashboard.welcomeHeading}
        </h1>
        <p className="mt-4 text-[15px] sm:text-base leading-relaxed text-[var(--text-secondary)]">
          {t.dashboard.welcomeIntro}
        </p>
      </section>

      {/* Core Metric Strip */}
      <section
        aria-label={t.dashboard.metricsAria}
        className="surface-card rounded-lg grid grid-cols-2 lg:grid-cols-4 metric-grid-4"
      >
        <div className="p-5 sm:p-6">
          <p className="text-xs text-[var(--text-secondary)]">
            {t.dashboard.totalPartsLabel}
          </p>
          <p className="mt-2 font-editorial text-3xl sm:text-4xl font-normal text-[var(--text-primary)] tabular-nums">
            {formatTwoDigits(summary.totalParts)}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {t.dashboard.totalPartsSub}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-[var(--text-secondary)]">
            {t.dashboard.totalProblemsLabel}
          </p>
          <p className="mt-2 font-editorial text-3xl sm:text-4xl font-normal text-[var(--text-primary)] tabular-nums">
            {summary.totalProblems}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {t.dashboard.totalProblemsSub}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-[var(--text-secondary)]">
            {t.dashboard.completedProblemsLabel}
          </p>
          <p className="mt-2 font-editorial text-3xl sm:text-4xl font-normal text-[var(--text-primary)] tabular-nums">
            {formatTwoDigits(summary.solvedProblems)}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)] font-code">
            {summary.completionPercent}
            {t.dashboard.completedProblemsSubSuffix}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-[var(--text-secondary)]">
            {t.dashboard.completedPartsLabel}
          </p>
          <p className="mt-2 font-editorial text-3xl sm:text-4xl font-normal text-[var(--text-primary)] tabular-nums">
            {formatTwoDigits(summary.completedParts)}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)] font-code">
            {t.dashboard.completedPartsSubPrefix} {formatTwoDigits(summary.totalParts)}{' '}
            {t.dashboard.completedPartsSubSuffix}
          </p>
        </div>
      </section>

      {/* Primary Two-Column Editorial Split: Continue Learning + Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Continue Learning */}
        <div className="lg:col-span-7 surface-card rounded-lg p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 text-xs text-[var(--text-secondary)]">
              <span className="font-code">
                {t.dashboard.continueLearningPrefix} {formatTwoDigits(activePart.number)}
              </span>
              <span className="font-code tabular-nums">
                {formatTwoDigits(activeSolvedCount)} / {activePart.problemCount}{' '}
                {t.dashboard.solvedLabel}
              </span>
            </div>

            <h2 className="mt-3 font-editorial text-2xl sm:text-[1.75rem] font-normal leading-snug text-[var(--text-primary)]">
              {pickText(activePart.title, language)}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {pickText(activePart.summary, language)}
            </p>

            {/* Hairline Progress */}
            <div className="mt-6">
              <div
                className="progress-track rounded-full"
                role="progressbar"
                aria-label={t.dashboard.progressBarAria}
                aria-valuenow={activePartProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="progress-fill" style={{ width: `${activePartProgress}%` }} />
              </div>
            </div>

            {/* Next Up Problem Focus */}
            {nextProblem && (
              <div className="mt-6 pt-6 border-t surface-divider">
                <div className="flex items-center justify-between gap-4 text-xs text-[var(--text-secondary)] font-code">
                  <span>
                    {t.dashboard.nextExercisePrefix} {nextProblem.id}
                  </span>
                  <span>{t.difficulties[nextProblem.difficulty]}</span>
                </div>
                <h3 className="mt-2 text-base font-medium text-[var(--text-primary)]">
                  {pickText(nextProblem.title, language)}
                </h3>
                <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                  {pickText(nextProblem.description, language)}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                onNavigate('logic-building', {
                  partId: activePart.id,
                  problemId: nextProblem?.id,
                })
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md btn-primary whitespace-nowrap shrink-0"
            >
              <span>{t.dashboard.continueButton}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('my-progress')}
              className="inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-md btn-secondary whitespace-nowrap shrink-0"
            >
              {t.dashboard.viewProgressButton}
            </button>
          </div>
        </div>

        {/* Recent Learning Activity */}
        <div className="lg:col-span-5 surface-card rounded-lg p-6 sm:p-8 flex flex-col">
          <div className="flex items-center justify-between gap-4 pb-4 border-b surface-divider">
            <h2 className="font-editorial text-xl font-normal text-[var(--text-primary)]">
              {t.dashboard.recentActivityTitle}
            </h2>
            <span className="text-xs font-code text-[var(--text-secondary)]">
              {t.dashboard.recentActivityLabel}
            </span>
          </div>

          <ul className="divide-y divide-[var(--border-color)] flex-1">
            {activityLog.map((entry) => (
              <li key={entry.id} className="py-3.5 first:pt-4 last:pb-0">
                <div className="flex items-center justify-between gap-3 text-xs font-code text-[var(--text-secondary)]">
                  <span>{pickText(entry.reference, language)}</span>
                  <span>{pickText(entry.timestamp, language)}</span>
                </div>
                <p className="mt-1.5 text-sm text-[var(--text-primary)] leading-snug">
                  {pickText(entry.description, language)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Learning Roadmap Preview */}
      <section aria-labelledby="roadmap-heading" className="pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
          <div>
            <h2
              id="roadmap-heading"
              className="font-editorial text-2xl font-normal text-[var(--text-primary)]"
            >
              {t.dashboard.roadmapTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t.dashboard.roadmapSubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('logic-building')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            <span>{t.dashboard.explorePartsLink}</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="surface-card rounded-lg grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 roadmap-grid-4">
          {curriculumData.roadmapStages.map((stage) => {
            const isStageActive = curriculumData.parts.some(
              (p) => p.phase === stage.phase && p.contentReady
            );
            const stageStatus = isStageActive
              ? t.dashboard.activeStage
              : t.dashboard.upcomingStage;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onNavigate('logic-building', { phase: stage.phase })}
                className="p-6 text-left flex flex-col justify-between hover:bg-[var(--hover-surface)] transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-code text-[var(--text-secondary)]">
                    <span>
                      {t.dashboard.stageLabel} {stage.stageNumber}
                    </span>
                    <span>{pickText(stage.partRange, language)}</span>
                  </div>
                  <h3 className="mt-3 font-editorial text-lg font-normal text-[var(--text-primary)] group-hover:underline underline-offset-4">
                    {pickText(stage.title, language)}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                    {pickText(stage.description, language)}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t surface-divider flex items-center justify-between text-xs font-code">
                  <span className="text-[var(--text-secondary)]">
                    {stage.totalProblems} {t.dashboard.problemsUnit}
                  </span>
                  <span
                    className={
                      isStageActive
                        ? 'text-[var(--text-primary)] font-medium'
                        : 'text-[var(--text-muted)]'
                    }
                  >
                    {stageStatus}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
