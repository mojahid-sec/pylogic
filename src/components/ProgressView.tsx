import { ArrowRight, Bookmark, FileText } from 'lucide-react';
import { useState } from 'react';
import type {
  CurriculumPhase,
  LanguageCode,
  SectionId,
  UserBookmark,
  UserNoteRecord,
} from '../types/pylogic';
import { getTranslations, pickText } from '../utils/language';
import {
  computeProgressSummary,
  curriculumData,
  formatTwoDigits,
  getActiveStudyPart,
  getPartSolvedCount,
  getPartStatus,
} from '../utils/progress';

interface ProgressViewProps {
  language: LanguageCode;
  solvedIds: string[];
  bookmarks?: UserBookmark[];
  notes?: UserNoteRecord[];
  onOpenPart: (
    section: SectionId,
    options?: {
      partId?: string;
      problemId?: string;
      projectId?: string;
      phase?: CurriculumPhase;
    }
  ) => void;
  onResetProgress: () => void;
}

export function ProgressView({
  language,
  solvedIds,
  bookmarks = [],
  notes = [],
  onOpenPart,
  onResetProgress,
}: ProgressViewProps) {
  const t = getTranslations(language);
  const [confirmReset, setConfirmReset] = useState(false);

  const summary = computeProgressSummary(curriculumData.parts, solvedIds);
  const activePart = getActiveStudyPart(curriculumData.parts, solvedIds);

  const phaseStats = curriculumData.roadmapStages.map((stage) => {
    const phaseParts = curriculumData.parts.filter((p) => p.phase === stage.phase);
    const solved = phaseParts.reduce(
      (acc, p) => acc + getPartSolvedCount(p.number, solvedIds),
      0
    );
    const total = phaseParts.reduce((acc, p) => acc + p.problemCount, 0);
    const completed = phaseParts.filter(
      (p) => getPartSolvedCount(p.number, solvedIds) >= p.problemCount
    ).length;
    const percent = total > 0 ? Math.round((solved / total) * 100) : 0;

    return {
      ...stage,
      solved,
      total,
      completed,
      partCount: phaseParts.length,
      percent,
    };
  });

  const handleOpenBookmark = (bookmark: UserBookmark) => {
    if (bookmark.itemType === 'project') {
      onOpenPart('projects', { projectId: bookmark.itemId });
      return;
    }
    const partNum =
      bookmark.partNumber ??
      (Number.parseInt(bookmark.itemId.slice(1, 3), 10) || 1);
    const partId = `part-${formatTwoDigits(partNum)}`;
    onOpenPart('logic-building', { partId, problemId: bookmark.itemId });
  };

  const handleOpenNote = (note: UserNoteRecord) => {
    if (note.entityType === 'project') {
      onOpenPart('projects', { projectId: note.entityId });
      return;
    }
    if (note.entityType === 'problem') {
      const partNum = Number.parseInt(note.entityId.slice(1, 3), 10) || 1;
      const partId = `part-${formatTwoDigits(partNum)}`;
      onOpenPart('logic-building', { partId, problemId: note.entityId });
    }
  };

  return (
    <div className="view-enter space-y-10">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-code text-[var(--text-secondary)]">
            {t.progress.kicker}
          </p>
          <h1 className="mt-2 font-editorial text-3xl sm:text-4xl font-normal tracking-[-0.02em] text-[var(--text-primary)]">
            {t.progress.heading}
          </h1>
          <p className="mt-3 text-[15px] text-[var(--text-secondary)] leading-relaxed">
            {t.progress.intro}
          </p>
        </div>

        <div className="shrink-0">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={solvedIds.length === 0}
              className="px-3.5 py-2 text-xs font-medium rounded-md btn-secondary disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {t.progress.resetProgress}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setConfirmReset(false);
                }}
                className="px-3.5 py-2 text-xs font-medium rounded-md btn-primary whitespace-nowrap"
              >
                {t.progress.resetProgress}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                aria-label={t.settings.cancelActionBtn}
                className="px-3 py-2 text-xs font-medium rounded-md btn-secondary whitespace-nowrap"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Summary Strip */}
      <section
        aria-label={t.progress.summaryAria}
        className="surface-card rounded-lg grid grid-cols-2 lg:grid-cols-4 metric-grid-4"
      >
        <div className="p-5 sm:p-6">
          <p className="text-xs text-[var(--text-secondary)]">
            {t.progress.overallCompletion}
          </p>
          <p className="mt-2 font-editorial text-3xl font-normal text-[var(--text-primary)] tabular-nums">
            {summary.completionPercent}%
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {t.progress.acrossProblems}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-[var(--text-secondary)]">
            {t.progress.solvedProblems}
          </p>
          <p className="mt-2 font-editorial text-3xl font-normal text-[var(--text-primary)] tabular-nums">
            {formatTwoDigits(summary.solvedProblems)} / {summary.totalProblems}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {t.progress.verifiedSolutions}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-[var(--text-secondary)]">
            {t.progress.completedParts}
          </p>
          <p className="mt-2 font-editorial text-3xl font-normal text-[var(--text-primary)] tabular-nums">
            {formatTwoDigits(summary.completedParts)} / {formatTwoDigits(summary.totalParts)}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {t.progress.fullPartsNote}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-[var(--text-secondary)]">
            {t.progress.activeModule}
          </p>
          <p className="mt-2 font-editorial text-3xl font-normal text-[var(--text-primary)] tabular-nums">
            {t.logicBuilding.partLabel} {formatTwoDigits(activePart.number)}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            {t.phases[activePart.phase]}
          </p>
        </div>
      </section>

      {/* Stage Breakdown */}
      <section aria-labelledby="stage-breakdown-heading">
        <h2
          id="stage-breakdown-heading"
          className="font-editorial text-2xl font-normal text-[var(--text-primary)] mb-4"
        >
          {t.progress.stageBreakdown}
        </h2>
        <div className="surface-card rounded-lg divide-y divide-[var(--border-color)]">
          {phaseStats.map((stage) => (
            <div
              key={stage.id}
              className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-center"
            >
              <div className="md:col-span-5">
                <p className="text-xs font-code text-[var(--text-secondary)]">
                  {t.dashboard.stageLabel} {stage.stageNumber} ·{' '}
                  {pickText(stage.partRange, language)}
                </p>
                <p className="mt-1 text-base font-medium text-[var(--text-primary)]">
                  {pickText(stage.title, language)}
                </p>
              </div>

              <div className="md:col-span-4">
                <div className="progress-track rounded-full">
                  <div className="progress-fill" style={{ width: `${stage.percent}%` }} />
                </div>
              </div>

              <div className="md:col-span-3 md:text-right font-code text-xs text-[var(--text-secondary)] tabular-nums">
                <span className="text-[var(--text-primary)] font-medium">
                  {formatTwoDigits(stage.solved)} / {stage.total}
                </span>{' '}
                {t.progress.partRangeUnit} · {stage.completed}/{stage.partCount}{' '}
                {t.progress.partsUnit}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Full 20-Part Ledger */}
      <section aria-labelledby="part-ledger-heading">
        <h2
          id="part-ledger-heading"
          className="font-editorial text-2xl font-normal text-[var(--text-primary)] mb-4"
        >
          {t.progress.partLedger}
        </h2>
        <div className="surface-card rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b surface-divider text-xs font-code text-[var(--text-secondary)]">
                <th className="py-3.5 px-3.5 sm:px-5 font-normal">{t.progress.colPart}</th>
                <th className="py-3.5 px-3.5 sm:px-5 font-normal">{t.progress.colTitle}</th>
                <th className="py-3.5 px-3.5 sm:px-5 font-normal hidden sm:table-cell">
                  {t.progress.colStage}
                </th>
                <th className="py-3.5 px-3.5 sm:px-5 font-normal text-right">
                  {t.progress.colSolved}
                </th>
                <th className="py-3.5 px-3.5 sm:px-5 font-normal text-right">
                  {t.progress.colStatus}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] text-sm">
              {curriculumData.parts.map((part) => {
                const solvedCount = getPartSolvedCount(part.number, solvedIds);
                const status = getPartStatus(part, solvedCount);
                return (
                  <tr
                    key={part.id}
                    onClick={() => onOpenPart('logic-building', { partId: part.id })}
                    className="hover:bg-[var(--hover-surface)] focus-within:bg-[var(--hover-surface)] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-3.5 sm:px-5 font-code text-xs text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                      {formatTwoDigits(part.number)}
                    </td>
                    <td className="py-3.5 px-3.5 sm:px-5 font-medium text-[var(--text-primary)]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPart('logic-building', { partId: part.id });
                        }}
                        className="text-left hover:underline underline-offset-4 focus-visible:underline"
                      >
                        {pickText(part.title, language)}
                      </button>
                    </td>
                    <td className="py-3.5 px-3.5 sm:px-5 text-xs text-[var(--text-secondary)] hidden sm:table-cell whitespace-nowrap">
                      {t.phases[part.phase]}
                    </td>
                    <td className="py-3.5 px-3.5 sm:px-5 font-code text-xs text-[var(--text-primary)] text-right tabular-nums whitespace-nowrap">
                      {formatTwoDigits(solvedCount)} / {part.problemCount}
                    </td>
                    <td className="py-3.5 px-3.5 sm:px-5 text-xs text-right whitespace-nowrap text-[var(--text-secondary)]">
                      {t.statuses[status]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Saved Bookmarks & Personal Notes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Bookmarks */}
        <div className="surface-card rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-4 border-b surface-divider">
            <div>
              <h2 className="font-editorial text-xl font-normal text-[var(--text-primary)] flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[var(--text-secondary)]" aria-hidden="true" />
                <span>{t.bookmarks.sectionTitle}</span>
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {t.bookmarks.sectionDesc}
              </p>
            </div>
            <span className="font-code text-xs text-[var(--text-muted)] tabular-nums">
              {bookmarks.length}
            </span>
          </div>

          {bookmarks.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {t.bookmarks.empty}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {bookmarks.map((bm) => (
                <li
                  key={`${bm.itemType}:${bm.itemId}`}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-code text-[var(--text-muted)]">
                      {bm.itemType === 'project'
                        ? t.bookmarks.typeProject
                        : t.bookmarks.typeProblem}{' '}
                      · {bm.itemId}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)] truncate">
                      {language === 'bn' ? bm.itemTitleBn : bm.itemTitleEn}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenBookmark(bm)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md btn-secondary shrink-0"
                  >
                    <span>{t.bookmarks.openItem}</span>
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Personal Notes */}
        <div className="surface-card rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-4 border-b surface-divider">
            <div>
              <h2 className="font-editorial text-xl font-normal text-[var(--text-primary)] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--text-secondary)]" aria-hidden="true" />
                <span>{t.notes.sectionTitle}</span>
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {t.notes.sectionDesc}
              </p>
            </div>
            <span className="font-code text-xs text-[var(--text-muted)] tabular-nums">
              {notes.length}
            </span>
          </div>

          {notes.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {t.notes.empty}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-color)]">
              {notes.map((note) => (
                <li
                  key={`${note.entityType}:${note.entityId}`}
                  className="py-3 first:pt-0 last:pb-0 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-code text-[var(--text-secondary)]">
                      {note.title || note.entityId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenNote(note)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)] hover:underline underline-offset-4 shrink-0"
                    >
                      <span>{t.bookmarks.openItem}</span>
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
