import curriculumJson from '../data/curriculum.json';
import type {
  ActivityEntry,
  CurriculumData,
  LastStudyState,
  ProblemProgressRecord,
} from '../types/pylogic';
import { capString, isSafeObjectKey } from '../utils/url';
import { loadLocalProblemNotes, saveLocalProblemNotes } from './bookmarksNotesRepository';
import { browserStorageAdapter } from './storageAdapter';

const curriculumData = curriculumJson as CurriculumData;

const SOLVED_STORAGE_KEY = 'pylogic-solved-problems';
const ACTIVITY_STORAGE_KEY = 'pylogic-activity-log';
const LAST_STUDY_KEY = 'pylogic-last-study';
const PROBLEM_PROGRESS_KEY = 'pylogic-problem-progress';
const INITIAL_SOLVED_SEED = ['P01-01', 'P01-02', 'P01-03'];
const VALID_PROBLEM_ID_PATTERN = /^P\d{2}-\d{2}$/i;
const VALID_ACTIVITY_TYPES = new Set<ActivityEntry['type']>(['Solved', 'Started', 'Milestone']);
const MAX_NOTE_LENGTH = 20_000;

export function extractPartNumberFromProblemId(problemId: string): number {
  const match = /^P(\d{2})-/i.exec(problemId.trim());
  if (!match) {
    return 1;
  }
  const num = Number.parseInt(match[1], 10);
  if (Number.isNaN(num) || num < 1 || num > 20) {
    return 1;
  }
  return num;
}

export function loadSolvedProblemIds(): string[] {
  const raw = browserStorageAdapter.getItem(SOLVED_STORAGE_KEY);
  if (raw === null) {
    browserStorageAdapter.setItem(SOLVED_STORAGE_KEY, JSON.stringify(INITIAL_SOLVED_SEED));
    return [...INITIAL_SOLVED_SEED];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(
        new Set(
          parsed.filter(
            (id): id is string =>
              typeof id === 'string' && VALID_PROBLEM_ID_PATTERN.test(id)
          )
        )
      ).slice(0, 500);
    }
  } catch {
    // Fallback safely without corrupting storage
  }
  return [...INITIAL_SOLVED_SEED];
}

export function saveSolvedProblemIds(ids: string[]): void {
  const cleanIds = Array.from(
    new Set(ids.filter((id) => VALID_PROBLEM_ID_PATTERN.test(id)))
  ).slice(0, 500);
  browserStorageAdapter.setItem(SOLVED_STORAGE_KEY, JSON.stringify(cleanIds));
}

export function loadProblemProgressMap(): Record<string, ProblemProgressRecord> {
  const solvedIds = loadSolvedProblemIds();
  const localNotes = loadLocalProblemNotes();
  const map: Record<string, ProblemProgressRecord> = {};

  const raw = browserStorageAdapter.getItem(PROBLEM_PROGRESS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [problemId, item] of Object.entries(parsed as Record<string, unknown>)) {
          if (
            !isSafeObjectKey(problemId) ||
            !VALID_PROBLEM_ID_PATTERN.test(problemId) ||
            !item ||
            typeof item !== 'object' ||
            Array.isArray(item)
          ) {
            continue;
          }
          const row = item as Record<string, unknown>;
          const attemptsRaw =
            typeof row.attempts === 'number' && Number.isFinite(row.attempts) && row.attempts >= 0
              ? Math.min(Math.floor(row.attempts), 10_000)
              : 0;

          map[problemId] = {
            problemId,
            partNumber:
              typeof row.partNumber === 'number' &&
              Number.isInteger(row.partNumber) &&
              row.partNumber >= 1 &&
              row.partNumber <= 20
                ? row.partNumber
                : extractPartNumberFromProblemId(problemId),
            isCompleted: Boolean(row.isCompleted),
            attempts: attemptsRaw,
            problemNote:
              typeof row.problemNote === 'string'
                ? capString(row.problemNote, MAX_NOTE_LENGTH)
                : '',
            lastActivityAt:
              typeof row.lastActivityAt === 'string' ? capString(row.lastActivityAt, 64) : '',
          };
        }
      }
    } catch {
      // Ignore malformed map and rebuild from solvedIds + notes
    }
  }

  for (const id of solvedIds) {
    const existing = map[id];
    map[id] = {
      problemId: id,
      partNumber: existing?.partNumber ?? extractPartNumberFromProblemId(id),
      isCompleted: true,
      attempts: Math.max(existing?.attempts ?? 0, 1),
      problemNote: existing?.problemNote ?? localNotes[id] ?? '',
      lastActivityAt: existing?.lastActivityAt ?? '',
    };
  }

  for (const [id, note] of Object.entries(localNotes)) {
    const existing = map[id];
    map[id] = {
      problemId: id,
      partNumber: existing?.partNumber ?? extractPartNumberFromProblemId(id),
      isCompleted: existing?.isCompleted ?? solvedIds.includes(id),
      attempts: existing?.attempts ?? 0,
      problemNote: note,
      lastActivityAt: existing?.lastActivityAt ?? '',
    };
  }

  return map;
}

export function saveProblemProgressMap(map: Record<string, ProblemProgressRecord>): void {
  browserStorageAdapter.setItem(PROBLEM_PROGRESS_KEY, JSON.stringify(map));

  // Keep legacy solved list and problem notes map synchronized
  const solvedIds = Object.values(map)
    .filter((entry) => entry.isCompleted)
    .map((entry) => entry.problemId);
  saveSolvedProblemIds(solvedIds);

  const notesMap: Record<string, string> = {};
  for (const entry of Object.values(map)) {
    if (entry.problemNote.trim().length > 0) {
      notesMap[entry.problemId] = entry.problemNote;
    }
  }
  saveLocalProblemNotes(notesMap);
}

export function sanitizeActivityLog(raw: unknown): ActivityEntry[] {
  if (!Array.isArray(raw)) {
    return curriculumData.defaultActivity;
  }
  const valid: ActivityEntry[] = [];
  for (const item of raw) {
    if (valid.length >= 20) {
      break;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const ts = entry.timestamp as Record<string, unknown> | undefined;
    const ref = entry.reference as Record<string, unknown> | undefined;
    const desc = entry.description as Record<string, unknown> | undefined;

    if (
      typeof entry.id !== 'string' ||
      !ts ||
      typeof ts.en !== 'string' ||
      typeof ts.bn !== 'string' ||
      !ref ||
      typeof ref.en !== 'string' ||
      typeof ref.bn !== 'string' ||
      !desc ||
      typeof desc.en !== 'string' ||
      typeof desc.bn !== 'string'
    ) {
      continue;
    }

    valid.push({
      id: capString(entry.id, 64),
      timestamp: {
        en: capString(ts.en, 80),
        bn: capString(ts.bn, 80),
      },
      reference: {
        en: capString(ref.en, 120),
        bn: capString(ref.bn, 120),
      },
      description: {
        en: capString(desc.en, 400),
        bn: capString(desc.bn, 400),
      },
      type: VALID_ACTIVITY_TYPES.has(entry.type as ActivityEntry['type'])
        ? (entry.type as ActivityEntry['type'])
        : 'Solved',
    });
  }
  return valid.length > 0 ? valid : curriculumData.defaultActivity;
}

export function loadActivityLog(): ActivityEntry[] {
  const raw = browserStorageAdapter.getItem(ACTIVITY_STORAGE_KEY);
  if (raw) {
    try {
      return sanitizeActivityLog(JSON.parse(raw));
    } catch {
      // Fallback to default activity
    }
  }
  return curriculumData.defaultActivity;
}

export function saveActivityLog(entries: ActivityEntry[]): void {
  browserStorageAdapter.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(entries));
}

export function loadLastStudyState(): LastStudyState | null {
  const raw = browserStorageAdapter.getItem(LAST_STUDY_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LastStudyState>;
    if (typeof parsed.partId === 'string' && parsed.partId.length > 0) {
      return {
        partId: parsed.partId,
        problemId: typeof parsed.problemId === 'string' ? parsed.problemId : undefined,
      };
    }
  } catch {
    // Ignore malformed last-study state
  }
  return null;
}

export function saveLastStudyState(state: LastStudyState): void {
  browserStorageAdapter.setItem(LAST_STUDY_KEY, JSON.stringify(state));
}

export function clearLastStudyState(): void {
  browserStorageAdapter.removeItem(LAST_STUDY_KEY);
}

export function clearLearningProgress(): {
  solvedIds: string[];
  problemProgressMap: Record<string, ProblemProgressRecord>;
  activityLog: ActivityEntry[];
} {
  saveSolvedProblemIds([]);
  browserStorageAdapter.removeItem(PROBLEM_PROGRESS_KEY);
  saveLocalProblemNotes({});
  browserStorageAdapter.removeItem(ACTIVITY_STORAGE_KEY);
  browserStorageAdapter.removeItem(LAST_STUDY_KEY);
  return {
    solvedIds: [],
    problemProgressMap: {},
    activityLog: curriculumData.defaultActivity,
  };
}
