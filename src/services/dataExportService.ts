import type {
  ActivityEntry,
  LastStudyState,
  ProblemProgressRecord,
  ProjectWorkspaceMap,
  UserBookmark,
  UserNoteRecord,
  UserPreferences,
} from '../types/pylogic';
import { capString, isSafeObjectKey } from '../utils/url';
import {
  loadLocalBookmarks,
  loadLocalGeneralNotes,
  sanitizeBookmarksList,
  sanitizeGeneralNotesList,
  saveLocalBookmarks,
  saveLocalGeneralNotes,
} from './bookmarksNotesRepository';
import {
  clearLastStudyState,
  extractPartNumberFromProblemId,
  loadActivityLog,
  loadLastStudyState,
  loadProblemProgressMap,
  loadSolvedProblemIds,
  sanitizeActivityLog,
  saveActivityLog,
  saveLastStudyState,
  saveProblemProgressMap,
  saveSolvedProblemIds,
} from './learningProgressRepository';
import {
  loadUserPreferences,
  sanitizeUserPreferences,
  saveUserPreferences,
} from './preferencesRepository';
import {
  loadProjectWorkspaceMap,
  sanitizeProjectWorkspaceMap,
  saveProjectWorkspaceMap,
} from './projectWorkspaceRepository';

export const MAX_BACKUP_FILE_BYTES = 2 * 1024 * 1024;
const MAX_NOTE_LENGTH = 20_000;

export interface PlatformBackupSnapshot {
  platform: 'PYLOGIC';
  schemaVersion: number;
  exportedAt: string;
  preferences: UserPreferences;
  learningProgress: {
    solvedProblemIds: string[];
    activityLog: ActivityEntry[];
    lastStudy: LastStudyState | null;
    problemProgressMap?: Record<string, ProblemProgressRecord>;
  };
  projectWorkspace: ProjectWorkspaceMap;
  bookmarks: UserBookmark[];
  notes?: UserNoteRecord[];
}

export interface BackupImportSummary {
  exportedAt: string;
  solvedCount: number;
  projectsCount: number;
  notesCount: number;
  bookmarksCount: number;
}

export type BackupParseResult =
  | {
      ok: true;
      snapshot: PlatformBackupSnapshot;
      summary: BackupImportSummary;
    }
  | {
      ok: false;
      errorCode: 'invalid_json' | 'invalid_schema' | 'file_too_large';
    };

export function buildPlatformBackupSnapshot(): PlatformBackupSnapshot {
  return {
    platform: 'PYLOGIC',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    preferences: loadUserPreferences(),
    learningProgress: {
      solvedProblemIds: loadSolvedProblemIds(),
      activityLog: loadActivityLog(),
      lastStudy: loadLastStudyState(),
      problemProgressMap: loadProblemProgressMap(),
    },
    projectWorkspace: loadProjectWorkspaceMap(),
    bookmarks: loadLocalBookmarks(),
    notes: loadLocalGeneralNotes(),
  };
}

export function downloadPlatformBackupJson(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const snapshot = buildPlatformBackupSnapshot();
    const jsonString = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateSlug = new Date().toISOString().slice(0, 10);

    const link = document.createElement('a');
    link.href = url;
    link.download = `pylogic-backup-${dateSlug}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

function sanitizeLastStudy(raw: unknown): LastStudyState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.partId !== 'string' || !/^part-\d{2}$/.test(obj.partId)) {
    return null;
  }
  return {
    partId: obj.partId,
    problemId:
      typeof obj.problemId === 'string' && /^P\d{2}-\d{2}$/.test(obj.problemId)
        ? obj.problemId
        : undefined,
  };
}

function sanitizeProblemProgressMap(
  rawProgress: unknown,
  solvedIds: string[]
): Record<string, ProblemProgressRecord> {
  const result: Record<string, ProblemProgressRecord> = {};

  if (rawProgress && typeof rawProgress === 'object' && !Array.isArray(rawProgress)) {
    for (const [problemId, item] of Object.entries(rawProgress as Record<string, unknown>)) {
      if (
        !isSafeObjectKey(problemId) ||
        !/^P\d{2}-\d{2}$/i.test(problemId) ||
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

      result[problemId] = {
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

  for (const id of solvedIds) {
    if (!result[id]) {
      result[id] = {
        problemId: id,
        partNumber: extractPartNumberFromProblemId(id),
        isCompleted: true,
        attempts: 1,
        problemNote: '',
        lastActivityAt: '',
      };
    } else {
      result[id].isCompleted = true;
    }
  }

  return result;
}

export function parseAndValidateBackupJson(rawText: string): BackupParseResult {
  if (rawText.length > MAX_BACKUP_FILE_BYTES) {
    return { ok: false, errorCode: 'file_too_large' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, errorCode: 'invalid_json' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errorCode: 'invalid_schema' };
  }

  const obj = parsed as Record<string, unknown>;
  if (
    obj.platform !== 'PYLOGIC' ||
    typeof obj.schemaVersion !== 'number' ||
    !Number.isFinite(obj.schemaVersion) ||
    obj.schemaVersion < 1 ||
    !obj.learningProgress ||
    typeof obj.learningProgress !== 'object' ||
    Array.isArray(obj.learningProgress)
  ) {
    return { ok: false, errorCode: 'invalid_schema' };
  }

  const lp = obj.learningProgress as Record<string, unknown>;
  if (!Array.isArray(lp.solvedProblemIds)) {
    return { ok: false, errorCode: 'invalid_schema' };
  }

  const solvedProblemIds = Array.from(
    new Set(
      lp.solvedProblemIds.filter(
        (id): id is string => typeof id === 'string' && /^P\d{2}-\d{2}$/i.test(id)
      )
    )
  ).slice(0, 500);

  // Support both schema v1 (problemNotes) and v2 (problemProgressMap)
  const rawProgressMap = lp.problemProgressMap ?? lp.problemNotes ?? {};
  const problemProgressMap = sanitizeProblemProgressMap(rawProgressMap, solvedProblemIds);
  const projectWorkspace = sanitizeProjectWorkspaceMap(obj.projectWorkspace);
  const bookmarks = sanitizeBookmarksList(obj.bookmarks);
  const preferences = sanitizeUserPreferences(obj.preferences);
  const activityLog = sanitizeActivityLog(lp.activityLog);
  const lastStudy = sanitizeLastStudy(lp.lastStudy);
  const notes = sanitizeGeneralNotesList(obj.notes);

  const activeProjectsCount = Object.values(projectWorkspace).filter(
    (entry) =>
      entry.status !== 'Not Started' ||
      Object.values(entry.notes).some((val) => typeof val === 'string' && val.trim().length > 0) ||
      Boolean(entry.checklist && Object.values(entry.checklist).some(Boolean))
  ).length;

  const problemNotesCount = Object.values(problemProgressMap).filter(
    (entry) => entry.problemNote.trim().length > 0
  ).length;

  const snapshot: PlatformBackupSnapshot = {
    platform: 'PYLOGIC',
    schemaVersion: 2,
    exportedAt:
      typeof obj.exportedAt === 'string'
        ? capString(obj.exportedAt, 64)
        : new Date().toISOString(),
    preferences,
    learningProgress: {
      solvedProblemIds,
      activityLog,
      lastStudy,
      problemProgressMap,
    },
    projectWorkspace,
    bookmarks,
    notes,
  };

  return {
    ok: true,
    snapshot,
    summary: {
      exportedAt: snapshot.exportedAt,
      solvedCount: solvedProblemIds.length,
      projectsCount: activeProjectsCount,
      notesCount: problemNotesCount + notes.length,
      bookmarksCount: bookmarks.length,
    },
  };
}

export function applyImportedBackupSnapshot(snapshot: PlatformBackupSnapshot): {
  preferences: UserPreferences;
  solvedIds: string[];
  problemProgressMap: Record<string, ProblemProgressRecord>;
  activityLog: ActivityEntry[];
  lastStudy: LastStudyState | null;
  projectWorkspaceMap: ProjectWorkspaceMap;
  bookmarks: UserBookmark[];
  notes: UserNoteRecord[];
} {
  const preferences = saveUserPreferences(snapshot.preferences);
  const problemProgressMap = sanitizeProblemProgressMap(
    snapshot.learningProgress.problemProgressMap,
    snapshot.learningProgress.solvedProblemIds
  );
  saveProblemProgressMap(problemProgressMap);
  saveSolvedProblemIds(snapshot.learningProgress.solvedProblemIds);
  saveActivityLog(snapshot.learningProgress.activityLog);

  if (snapshot.learningProgress.lastStudy) {
    saveLastStudyState(snapshot.learningProgress.lastStudy);
  } else {
    clearLastStudyState();
  }

  saveProjectWorkspaceMap(snapshot.projectWorkspace);
  saveLocalBookmarks(snapshot.bookmarks);
  saveLocalGeneralNotes(snapshot.notes ?? []);

  return {
    preferences,
    solvedIds: snapshot.learningProgress.solvedProblemIds,
    problemProgressMap,
    activityLog: snapshot.learningProgress.activityLog,
    lastStudy: snapshot.learningProgress.lastStudy,
    projectWorkspaceMap: snapshot.projectWorkspace,
    bookmarks: snapshot.bookmarks,
    notes: snapshot.notes ?? [],
  };
}
