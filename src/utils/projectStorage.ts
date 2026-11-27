import {
  EMPTY_CHECKLIST,
  EMPTY_NOTES,
  loadProjectWorkspaceMap,
  PROJECT_CHECKLIST_KEYS,
  saveProjectWorkspaceMap,
} from '../services/projectWorkspaceRepository';
import type {
  ProjectCatalogItem,
  ProjectChecklistState,
  ProjectLevel,
  ProjectPersonalNotes,
  ProjectStatus,
  ProjectWorkspaceEntry,
  ProjectWorkspaceMap,
} from '../types/pylogic';

const PROJECT_LEVELS: ProjectLevel[] = ['Level 01', 'Level 02', 'Level 03', 'Level 04'];

export const EMPTY_PROJECT_NOTES: ProjectPersonalNotes = EMPTY_NOTES;
export const EMPTY_PROJECT_CHECKLIST: ProjectChecklistState = EMPTY_CHECKLIST;

export interface ProjectLevelStat {
  level: ProjectLevel;
  levelNumber: number;
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  percent: number;
}

export interface ProjectProgressSummary {
  totalProjects: number;
  notStartedCount: number;
  inProgressCount: number;
  completedCount: number;
  completionPercent: number;
  levelStats: ProjectLevelStat[];
}

export interface ProjectChecklistProgress {
  completed: number;
  total: number;
  percent: number;
}

export function computeChecklistProgress(
  checklist?: ProjectChecklistState
): ProjectChecklistProgress {
  const total = PROJECT_CHECKLIST_KEYS.length;
  if (!checklist) {
    return { completed: 0, total, percent: 0 };
  }
  let completed = 0;
  for (const key of PROJECT_CHECKLIST_KEYS) {
    if (checklist[key]) {
      completed += 1;
    }
  }
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function getInitialProjectWorkspace(): ProjectWorkspaceMap {
  return loadProjectWorkspaceMap();
}

export function saveProjectWorkspace(workspaceMap: ProjectWorkspaceMap): void {
  saveProjectWorkspaceMap(workspaceMap);
}

export function getProjectEntry(
  workspaceMap: ProjectWorkspaceMap,
  projectId: string
): ProjectWorkspaceEntry {
  const existing = workspaceMap[projectId];
  if (!existing) {
    return {
      status: 'Not Started',
      notes: { ...EMPTY_PROJECT_NOTES },
      checklist: { ...EMPTY_PROJECT_CHECKLIST },
      updatedAt: '',
    };
  }
  return {
    ...existing,
    notes: { ...EMPTY_PROJECT_NOTES, ...existing.notes },
    checklist: { ...EMPTY_PROJECT_CHECKLIST, ...(existing.checklist ?? {}) },
  };
}

export function updateProjectStatus(
  workspaceMap: ProjectWorkspaceMap,
  projectId: string,
  status: ProjectStatus
): ProjectWorkspaceMap {
  const existing = getProjectEntry(workspaceMap, projectId);
  const next: ProjectWorkspaceMap = {
    ...workspaceMap,
    [projectId]: {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    },
  };
  saveProjectWorkspace(next);
  return next;
}

export function updateProjectNotes(
  workspaceMap: ProjectWorkspaceMap,
  projectId: string,
  notes: ProjectPersonalNotes
): ProjectWorkspaceMap {
  const existing = getProjectEntry(workspaceMap, projectId);
  const next: ProjectWorkspaceMap = {
    ...workspaceMap,
    [projectId]: {
      ...existing,
      notes: { ...notes },
      updatedAt: new Date().toISOString(),
    },
  };
  saveProjectWorkspace(next);
  return next;
}

export function updateProjectChecklist(
  workspaceMap: ProjectWorkspaceMap,
  projectId: string,
  checklist: ProjectChecklistState
): ProjectWorkspaceMap {
  const existing = getProjectEntry(workspaceMap, projectId);
  const nextStatus: ProjectStatus =
    existing.status === 'Completed' && !checklist.finalProjectReviewed
      ? 'Testing'
      : existing.status;

  const next: ProjectWorkspaceMap = {
    ...workspaceMap,
    [projectId]: {
      ...existing,
      status: nextStatus,
      checklist: { ...checklist },
      updatedAt: new Date().toISOString(),
    },
  };
  saveProjectWorkspace(next);
  return next;
}

export function clearProjectWorkspaceEntry(
  workspaceMap: ProjectWorkspaceMap,
  projectId: string
): ProjectWorkspaceMap {
  const next = { ...workspaceMap };
  delete next[projectId];
  saveProjectWorkspace(next);
  return next;
}

export function computeProjectProgress(
  catalog: ProjectCatalogItem[],
  workspaceMap: ProjectWorkspaceMap
): ProjectProgressSummary {
  const totalProjects = catalog.length;
  let completedCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;

  for (const item of catalog) {
    const status = getProjectEntry(workspaceMap, item.id).status;
    if (status === 'Completed') {
      completedCount += 1;
    } else if (status === 'Not Started') {
      notStartedCount += 1;
    } else {
      inProgressCount += 1;
    }
  }

  const completionPercent =
    totalProjects === 0 ? 0 : Math.round((completedCount / totalProjects) * 100);

  const levelStats: ProjectLevelStat[] = PROJECT_LEVELS.map((level, index) => {
    const levelItems = catalog.filter((item) => item.level === level);
    let levelCompleted = 0;
    let levelInProgress = 0;
    let levelNotStarted = 0;

    for (const item of levelItems) {
      const status = getProjectEntry(workspaceMap, item.id).status;
      if (status === 'Completed') {
        levelCompleted += 1;
      } else if (status === 'Not Started') {
        levelNotStarted += 1;
      } else {
        levelInProgress += 1;
      }
    }

    const total = levelItems.length;
    const percent = total === 0 ? 0 : Math.round((levelCompleted / total) * 100);

    return {
      level,
      levelNumber: index + 1,
      total,
      completed: levelCompleted,
      inProgress: levelInProgress,
      notStarted: levelNotStarted,
      percent,
    };
  });

  return {
    totalProjects,
    notStartedCount,
    inProgressCount,
    completedCount,
    completionPercent,
    levelStats,
  };
}
