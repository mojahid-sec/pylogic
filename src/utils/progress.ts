import curriculumJson from '../data/curriculum.json';
import {
  clearLearningProgress,
  loadActivityLog,
  loadSolvedProblemIds,
  saveActivityLog,
  saveSolvedProblemIds,
} from '../services/learningProgressRepository';
import type {
  ActivityEntry,
  CurriculumData,
  LearningPart,
  PartStatus,
} from '../types/pylogic';

export const curriculumData = curriculumJson as CurriculumData;

export interface ProgressSummary {
  totalParts: number;
  totalProblems: number;
  solvedProblems: number;
  completedParts: number;
  completionPercent: string;
}

export function getInitialSolvedIds(): string[] {
  return loadSolvedProblemIds();
}

export function saveSolvedIds(ids: string[]): void {
  saveSolvedProblemIds(ids);
}

export function getInitialActivityLog(): ActivityEntry[] {
  return loadActivityLog();
}

export function recordSolveActivity(
  currentLog: ActivityEntry[],
  problemId: string,
  partNumber: number,
  problemTitleEn: string,
  problemTitleBn: string
): ActivityEntry[] {
  const partStr = formatTwoDigits(partNumber);
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newEntry: ActivityEntry = {
    id: `act-${Date.now()}`,
    timestamp: {
      en: `Today · ${timeStr}`,
      bn: `আজ · ${timeStr}`,
    },
    reference: {
      en: `Part ${partStr} · ${problemId}`,
      bn: `পার্ট ${partStr} · ${problemId}`,
    },
    description: {
      en: `Solved ${problemTitleEn}.`,
      bn: `${problemTitleBn} সমাধান সম্পন্ন।`,
    },
    type: 'Solved',
  };

  const nextLog = [newEntry, ...currentLog].slice(0, 6);
  saveActivityLog(nextLog);
  return nextLog;
}

export function resetAllProgress(): { solvedIds: string[]; activityLog: ActivityEntry[] } {
  return clearLearningProgress();
}

export function getPartSolvedCount(partNumber: number, solvedIds: string[]): number {
  const prefix = `P${formatTwoDigits(partNumber)}-`;
  return solvedIds.filter((id) => id.startsWith(prefix)).length;
}

export function getPartStatus(part: LearningPart, solvedCount: number): PartStatus {
  if (solvedCount >= part.problemCount) {
    return 'Completed';
  }
  if (solvedCount > 0) {
    return 'In Progress';
  }
  return part.contentReady ? 'Available' : 'Upcoming';
}

export function computeProgressSummary(
  parts: LearningPart[],
  solvedIds: string[]
): ProgressSummary {
  const totalParts = parts.length;
  const totalProblems = parts.reduce((sum, part) => sum + part.problemCount, 0);
  const solvedProblems = solvedIds.length;
  const completedParts = parts.filter(
    (part) => getPartSolvedCount(part.number, solvedIds) >= part.problemCount
  ).length;
  const ratio = totalProblems > 0 ? (solvedProblems / totalProblems) * 100 : 0;

  return {
    totalParts,
    totalProblems,
    solvedProblems,
    completedParts,
    completionPercent: ratio.toFixed(1),
  };
}

export function getActiveStudyPart(
  parts: LearningPart[],
  solvedIds: string[]
): LearningPart {
  const inProgress = parts.find((part) => {
    const count = getPartSolvedCount(part.number, solvedIds);
    return part.contentReady && count > 0 && count < part.problemCount;
  });
  if (inProgress) {
    return inProgress;
  }
  const firstAvailable = parts.find(
    (part) => part.contentReady && getPartSolvedCount(part.number, solvedIds) < part.problemCount
  );
  return firstAvailable ?? parts[0];
}

export function formatTwoDigits(value: number): string {
  return value.toString().padStart(2, '0');
}
