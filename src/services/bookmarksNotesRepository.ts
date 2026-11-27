import type { NoteEntityType, UserBookmark, UserNoteRecord } from '../types/pylogic';
import { capString, isSafeObjectKey } from '../utils/url';
import { browserStorageAdapter } from './storageAdapter';

const BOOKMARKS_STORAGE_KEY = 'pylogic-bookmarks';
const PROBLEM_NOTES_STORAGE_KEY = 'pylogic-problem-notes';
const GENERAL_NOTES_STORAGE_KEY = 'pylogic-general-notes';

const MAX_BOOKMARKS = 500;
const MAX_NOTES = 500;
const MAX_NOTE_LENGTH = 20_000;
const MAX_TITLE_LENGTH = 300;
const VALID_ENTITY_TYPES = new Set<NoteEntityType>(['problem', 'project', 'general']);
const SAFE_ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const VALID_PROBLEM_ID_PATTERN = /^P\d{2}-\d{2}$/i;

export function sanitizeBookmarksList(raw: unknown): UserBookmark[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const result: UserBookmark[] = [];

  for (const item of raw) {
    if (result.length >= MAX_BOOKMARKS) {
      break;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (
      (row.itemType !== 'problem' && row.itemType !== 'project') ||
      typeof row.itemId !== 'string' ||
      !isSafeObjectKey(row.itemId) ||
      !SAFE_ITEM_ID_PATTERN.test(row.itemId.trim())
    ) {
      continue;
    }
    const cleanId = row.itemId.trim();
    const dedupeKey = `${row.itemType}:${cleanId}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    const validPart =
      typeof row.partNumber === 'number' &&
      Number.isInteger(row.partNumber) &&
      row.partNumber >= 1 &&
      row.partNumber <= 20
        ? row.partNumber
        : undefined;

    result.push({
      id: typeof row.id === 'string' ? capString(row.id, 64) : undefined,
      itemType: row.itemType,
      itemId: cleanId,
      partNumber: validPart,
      itemTitleEn:
        typeof row.itemTitleEn === 'string' && row.itemTitleEn.trim().length > 0
          ? capString(row.itemTitleEn, MAX_TITLE_LENGTH)
          : cleanId,
      itemTitleBn:
        typeof row.itemTitleBn === 'string' && row.itemTitleBn.trim().length > 0
          ? capString(row.itemTitleBn, MAX_TITLE_LENGTH)
          : cleanId,
      createdAt:
        typeof row.createdAt === 'string' ? capString(row.createdAt, 64) : undefined,
    });
  }

  return result;
}

export function loadLocalBookmarks(): UserBookmark[] {
  const raw = browserStorageAdapter.getItem(BOOKMARKS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return sanitizeBookmarksList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveLocalBookmarks(bookmarks: UserBookmark[]): void {
  browserStorageAdapter.setItem(
    BOOKMARKS_STORAGE_KEY,
    JSON.stringify(sanitizeBookmarksList(bookmarks))
  );
}

export function loadLocalProblemNotes(): Record<string, string> {
  const raw = browserStorageAdapter.getItem(PROBLEM_NOTES_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [problemId, note] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        !isSafeObjectKey(problemId) ||
        !VALID_PROBLEM_ID_PATTERN.test(problemId) ||
        typeof note !== 'string' ||
        note.trim().length === 0
      ) {
        continue;
      }
      result[problemId] = capString(note, MAX_NOTE_LENGTH);
    }
    return result;
  } catch {
    return {};
  }
}

export function saveLocalProblemNotes(notesMap: Record<string, string>): void {
  browserStorageAdapter.setItem(PROBLEM_NOTES_STORAGE_KEY, JSON.stringify(notesMap));
}

export function sanitizeGeneralNotesList(raw: unknown): UserNoteRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: UserNoteRecord[] = [];
  for (const item of raw) {
    if (result.length >= MAX_NOTES) {
      break;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (
      typeof row.entityId !== 'string' ||
      !isSafeObjectKey(row.entityId) ||
      !SAFE_ITEM_ID_PATTERN.test(row.entityId.trim()) ||
      typeof row.content !== 'string'
    ) {
      continue;
    }
    const entityType: NoteEntityType = VALID_ENTITY_TYPES.has(
      row.entityType as NoteEntityType
    )
      ? (row.entityType as NoteEntityType)
      : 'general';

    result.push({
      id: typeof row.id === 'string' ? capString(row.id, 64) : undefined,
      entityType,
      entityId: row.entityId.trim(),
      title:
        typeof row.title === 'string'
          ? capString(row.title, MAX_TITLE_LENGTH)
          : row.entityId.trim(),
      content: capString(row.content, MAX_NOTE_LENGTH),
      updatedAt:
        typeof row.updatedAt === 'string' ? capString(row.updatedAt, 64) : undefined,
    });
  }
  return result;
}

export function loadLocalGeneralNotes(): UserNoteRecord[] {
  const raw = browserStorageAdapter.getItem(GENERAL_NOTES_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return sanitizeGeneralNotesList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveLocalGeneralNotes(notes: UserNoteRecord[]): void {
  browserStorageAdapter.setItem(
    GENERAL_NOTES_STORAGE_KEY,
    JSON.stringify(sanitizeGeneralNotesList(notes))
  );
}
