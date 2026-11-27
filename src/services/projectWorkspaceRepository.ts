import type {
  ProjectChecklistKey,
  ProjectChecklistState,
  ProjectPersonalNotes,
  ProjectStatus,
  ProjectWorkspaceMap,
} from '../types/pylogic';
import { capString, isSafeObjectKey } from '../utils/url';
import { browserStorageAdapter } from './storageAdapter';

const PROJECT_WORKSPACE_STORAGE_KEY = 'pylogic-project-workspace';
const VALID_PROJECT_ID_PATTERN = /^PRJ-\d{2}$/i;
const MAX_FIELD_LENGTH = 15_000;
const MAX_URL_LENGTH = 500;

const VALID_STATUSES: ProjectStatus[] = [
  'Not Started',
  'Planning',
  'In Progress',
  'Testing',
  'Completed',
];

export const PROJECT_CHECKLIST_KEYS: ProjectChecklistKey[] = [
  'storyUnderstood',
  'requirementsAnalyzed',
  'pythonConceptsReviewed',
  'requiredModulesUnderstood',
  'projectLogicPlanned',
  'folderStructureCreated',
  'basicVersionImplemented',
  'mainFeaturesImplemented',
  'errorHandlingCompleted',
  'testsPassed',
  'documentationWritten',
  'readmeCreated',
  'githubRepoPublished',
  'finalProjectReviewed',
];

export const EMPTY_CHECKLIST: ProjectChecklistState = {
  storyUnderstood: false,
  requirementsAnalyzed: false,
  pythonConceptsReviewed: false,
  requiredModulesUnderstood: false,
  projectLogicPlanned: false,
  folderStructureCreated: false,
  basicVersionImplemented: false,
  mainFeaturesImplemented: false,
  errorHandlingCompleted: false,
  testsPassed: false,
  documentationWritten: false,
  readmeCreated: false,
  githubRepoPublished: false,
  finalProjectReviewed: false,
};

export const EMPTY_NOTES: ProjectPersonalNotes = {
  myUnderstanding: '',
  myRequirements: '',
  myLogic: '',
  projectPlan: '',
  myAlgorithm: '',
  architectureNotes: '',
  folderStructureNotes: '',
  myPythonConcepts: '',
  implementationNotes: '',
  problemsFaced: '',
  howISolvedThem: '',
  testingResults: '',
  futureImprovements: '',
  githubRepoUrl: '',
  implementationDecisions: '',
};

function readBoundedNote(value: unknown, maxLength = MAX_FIELD_LENGTH): string {
  return typeof value === 'string' ? capString(value, maxLength) : '';
}

function sanitizeNotes(raw: unknown): ProjectPersonalNotes {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_NOTES };
  }
  const obj = raw as Record<string, unknown>;
  return {
    myUnderstanding: readBoundedNote(obj.myUnderstanding),
    myRequirements: readBoundedNote(obj.myRequirements),
    myLogic: readBoundedNote(obj.myLogic),
    projectPlan: readBoundedNote(obj.projectPlan),
    myAlgorithm: readBoundedNote(obj.myAlgorithm),
    architectureNotes: readBoundedNote(obj.architectureNotes),
    folderStructureNotes: readBoundedNote(obj.folderStructureNotes),
    myPythonConcepts: readBoundedNote(obj.myPythonConcepts),
    implementationNotes: readBoundedNote(obj.implementationNotes),
    problemsFaced: readBoundedNote(obj.problemsFaced),
    howISolvedThem: readBoundedNote(obj.howISolvedThem),
    testingResults: readBoundedNote(obj.testingResults),
    futureImprovements: readBoundedNote(obj.futureImprovements),
    githubRepoUrl: readBoundedNote(obj.githubRepoUrl, MAX_URL_LENGTH),
    implementationDecisions: readBoundedNote(obj.implementationDecisions),
  };
}

export function sanitizeChecklist(raw: unknown): ProjectChecklistState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_CHECKLIST };
  }
  const obj = raw as Record<string, unknown>;
  const next: ProjectChecklistState = { ...EMPTY_CHECKLIST };
  for (const key of PROJECT_CHECKLIST_KEYS) {
    next[key] = Boolean(obj[key]);
  }
  return next;
}

export function sanitizeProjectWorkspaceMap(raw: unknown): ProjectWorkspaceMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const sanitized: ProjectWorkspaceMap = {};
  for (const [projectId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (
      !isSafeObjectKey(projectId) ||
      !VALID_PROJECT_ID_PATTERN.test(projectId) ||
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry)
    ) {
      continue;
    }
    const rawEntry = entry as Record<string, unknown>;
    const status = VALID_STATUSES.includes(rawEntry.status as ProjectStatus)
      ? (rawEntry.status as ProjectStatus)
      : 'Not Started';
    sanitized[projectId] = {
      status,
      notes: sanitizeNotes(rawEntry.notes),
      checklist: sanitizeChecklist(rawEntry.checklist),
      updatedAt: typeof rawEntry.updatedAt === 'string' ? capString(rawEntry.updatedAt, 64) : '',
    };
  }
  return sanitized;
}

export function loadProjectWorkspaceMap(): ProjectWorkspaceMap {
  const raw = browserStorageAdapter.getItem(PROJECT_WORKSPACE_STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    return sanitizeProjectWorkspaceMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveProjectWorkspaceMap(workspaceMap: ProjectWorkspaceMap): void {
  browserStorageAdapter.setItem(PROJECT_WORKSPACE_STORAGE_KEY, JSON.stringify(workspaceMap));
}

export function clearAllProjectWorkspaces(): void {
  browserStorageAdapter.removeItem(PROJECT_WORKSPACE_STORAGE_KEY);
}
