import projectsCatalogJson from '../data/projectsCatalog.json';
import type {
  ProjectCatalogItem,
  ProjectDetail,
  ProjectLevel,
  ProjectLevelData,
  ProjectStory,
  ProjectStoryLevelData,
  ProjectTechGuide,
  ProjectTechGuideLevelData,
} from '../types/pylogic';

export const projectsCatalog = projectsCatalogJson as ProjectCatalogItem[];

const levelModules = import.meta.glob<ProjectLevelData>('../data/projects/level*.json', {
  import: 'default',
});

const storyModules = import.meta.glob<ProjectStoryLevelData>(
  '../data/stories/storyLevel*.json',
  {
    import: 'default',
  }
);

const guideModules = import.meta.glob<ProjectTechGuideLevelData>(
  '../data/guides/guideLevel*.json',
  {
    import: 'default',
  }
);

const levelCache = new Map<number, ProjectLevelData>();
const storyCache = new Map<number, ProjectStoryLevelData>();
const guideCache = new Map<number, ProjectTechGuideLevelData>();

const levelInFlight = new Map<number, Promise<ProjectLevelData | null>>();
const storyInFlight = new Map<number, Promise<ProjectStoryLevelData | null>>();
const guideInFlight = new Map<number, Promise<ProjectTechGuideLevelData | null>>();

export function getLevelNumber(level: ProjectLevel): number {
  const numeric = Number.parseInt(level.replace(/\D+/g, ''), 10);
  return Number.isNaN(numeric) ? 1 : numeric;
}

export async function loadLevelProjects(levelNumber: number): Promise<ProjectLevelData | null> {
  if (levelCache.has(levelNumber)) {
    return levelCache.get(levelNumber) ?? null;
  }

  const pending = levelInFlight.get(levelNumber);
  if (pending) {
    return pending;
  }

  const padded = levelNumber.toString().padStart(2, '0');
  const key = `../data/projects/level${padded}.json`;
  const loader = levelModules[key];

  if (!loader) {
    return null;
  }

  const request = loader()
    .then((data) => {
      levelCache.set(levelNumber, data);
      return data;
    })
    .finally(() => {
      levelInFlight.delete(levelNumber);
    });

  levelInFlight.set(levelNumber, request);
  return request;
}

export async function loadLevelStories(
  levelNumber: number
): Promise<ProjectStoryLevelData | null> {
  if (storyCache.has(levelNumber)) {
    return storyCache.get(levelNumber) ?? null;
  }

  const pending = storyInFlight.get(levelNumber);
  if (pending) {
    return pending;
  }

  const padded = levelNumber.toString().padStart(2, '0');
  const key = `../data/stories/storyLevel${padded}.json`;
  const loader = storyModules[key];

  if (!loader) {
    return null;
  }

  const request = loader()
    .then((data) => {
      storyCache.set(levelNumber, data);
      return data;
    })
    .finally(() => {
      storyInFlight.delete(levelNumber);
    });

  storyInFlight.set(levelNumber, request);
  return request;
}

export async function loadLevelGuides(
  levelNumber: number
): Promise<ProjectTechGuideLevelData | null> {
  if (guideCache.has(levelNumber)) {
    return guideCache.get(levelNumber) ?? null;
  }

  const pending = guideInFlight.get(levelNumber);
  if (pending) {
    return pending;
  }

  const padded = levelNumber.toString().padStart(2, '0');
  const key = `../data/guides/guideLevel${padded}.json`;
  const loader = guideModules[key];

  if (!loader) {
    return null;
  }

  const request = loader()
    .then((data) => {
      guideCache.set(levelNumber, data);
      return data;
    })
    .finally(() => {
      guideInFlight.delete(levelNumber);
    });

  guideInFlight.set(levelNumber, request);
  return request;
}

export async function loadProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const catalogItem = projectsCatalog.find((item) => item.id === projectId);
  if (!catalogItem) {
    return null;
  }

  const levelNumber = getLevelNumber(catalogItem.level);
  const [levelData, storyData, guideData] = await Promise.all([
    loadLevelProjects(levelNumber),
    loadLevelStories(levelNumber),
    loadLevelGuides(levelNumber),
  ]);
  if (!levelData) {
    return null;
  }

  const project = levelData.projects.find((item) => item.id === projectId);
  if (!project) {
    return null;
  }

  const story: ProjectStory | undefined = storyData?.stories.find(
    (item) => item.projectId === projectId
  );
  const guide: ProjectTechGuide | undefined = guideData?.guides.find(
    (item) => item.projectId === projectId
  );

  return {
    ...project,
    ...(story ? { story } : {}),
    ...(guide ? { guide } : {}),
  };
}
