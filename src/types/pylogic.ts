export type SectionId =
  | 'dashboard'
  | 'logic-building'
  | 'projects'
  | 'my-progress'
  | 'about-developer'
  | 'settings';

export type ThemeMode = 'light' | 'dark';

export type ThemePreference = 'light' | 'dark' | 'system';

export type LanguageCode = 'en' | 'bn';

export type ReadingDensity = 'comfortable' | 'compact';

export interface UserPreferences {
  themePreference: ThemePreference;
  language: LanguageCode;
  readingDensity: ReadingDensity;
  rememberLastPart: boolean;
  autoScrollOnStep: boolean;
  wrapSolutionCode: boolean;
  showSolvedIndicators: boolean;
  sidebarCollapsed: boolean;
}

export interface LastStudyState {
  partId: string;
  problemId?: string;
}

export interface ProblemProgressRecord {
  problemId: string;
  partNumber: number;
  isCompleted: boolean;
  attempts: number;
  problemNote: string;
  lastActivityAt: string;
}

export type BookmarkItemType = 'problem' | 'project';

export interface UserBookmark {
  id?: string;
  itemType: BookmarkItemType;
  itemId: string;
  partNumber?: number;
  itemTitleEn: string;
  itemTitleBn: string;
  createdAt?: string;
}

export type NoteEntityType = 'problem' | 'project' | 'general';

export interface UserNoteRecord {
  id?: string;
  entityType: NoteEntityType;
  entityId: string;
  title: string;
  content: string;
  updatedAt?: string;
}

export interface LocalizedText {
  en: string;
  bn: string;
}

export type CurriculumPhase =
  | 'Foundations'
  | 'Core Logic'
  | 'Algorithms'
  | 'Systems & Security';

export type PartStatus = 'Completed' | 'In Progress' | 'Available' | 'Upcoming';

export type ProblemDifficulty =
  | 'Very Easy'
  | 'Easy'
  | 'Medium'
  | 'Hard'
  | 'Challenge';

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: LocalizedText;
}

export interface ProblemTestCase {
  input: string;
  expectedOutput: string;
  note?: LocalizedText;
}

export interface CurriculumProblem {
  id: string;
  number: number;
  title: LocalizedText;
  difficulty: ProblemDifficulty;
  estimatedTime?: LocalizedText;
  realWorldApplication?: LocalizedText;
  requiredConcepts: LocalizedText[];
  description: LocalizedText;
  inputDescription: LocalizedText;
  expectedOutput: LocalizedText;
  examples: ProblemExample[];
  hint1: LocalizedText;
  hint2: LocalizedText;
  logicBreakdown: LocalizedText;
  algorithm: LocalizedText[];
  solution: string;
  codeExplanation: LocalizedText;
  commonMistakes?: LocalizedText;
  complexity: {
    time: string;
    space: string;
  };
  testCases: ProblemTestCase[];
}

export interface PartProblemData {
  partId: string;
  partNumber: number;
  problems: CurriculumProblem[];
}

export interface LearningPart {
  id: string;
  number: number;
  title: LocalizedText;
  phase: CurriculumPhase;
  problemCount: number;
  contentReady: boolean;
  summary: LocalizedText;
  concepts: LocalizedText[];
}

export interface RoadmapStage {
  id: string;
  stageNumber: string;
  title: LocalizedText;
  partRange: LocalizedText;
  phase: CurriculumPhase;
  totalProblems: number;
  description: LocalizedText;
}

export interface ActivityEntry {
  id: string;
  timestamp: LocalizedText;
  reference: LocalizedText;
  description: LocalizedText;
  type: 'Solved' | 'Started' | 'Milestone';
}

export interface DeveloperProfile {
  name: LocalizedText;
  role: LocalizedText;
  department: LocalizedText;
  institute: LocalizedText;
  introduction: LocalizedText;
  vision: LocalizedText;
  githubUsername: string;
  githubUrl: string;
  photoPath: string;
  interests: LocalizedText[];
}

export interface CurriculumData {
  platform: {
    name: string;
    phaseLabel: LocalizedText;
    totalParts: number;
    totalProblems: number;
  };
  roadmapStages: RoadmapStage[];
  parts: LearningPart[];
  defaultActivity: ActivityEntry[];
  developer: DeveloperProfile;
}

export type ProjectLevel = 'Level 01' | 'Level 02' | 'Level 03' | 'Level 04';

export type ProjectDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Capstone';

export type ProjectCategory =
  | 'Python Foundations'
  | 'Data & Storage'
  | 'Automation & Ops'
  | 'Networking'
  | 'Defensive Security'
  | 'AppSec & Risk';

export type ProjectStatus =
  | 'Not Started'
  | 'Planning'
  | 'In Progress'
  | 'Testing'
  | 'Completed';

export interface ProjectCatalogItem {
  id: string;
  number: number;
  title: LocalizedText;
  level: ProjectLevel;
  difficulty: ProjectDifficulty;
  estimatedTime: LocalizedText;
  category: ProjectCategory;
  overview: LocalizedText;
  requiredTechnicalSkills: LocalizedText[];
  jobRoles: LocalizedText[];
}

export interface ProjectHints {
  level1: LocalizedText;
  level2: LocalizedText;
  level3: LocalizedText;
}

export interface ProjectCareerRelevance {
  jobRoles: LocalizedText[];
  industryRelevance: LocalizedText;
  practicalSkillsDemonstrated: LocalizedText[];
  interviewTopics: LocalizedText[];
  githubPortfolioValue: LocalizedText;
}

export interface ProjectStoryCharacterRole {
  characterId: 'sajid' | 'sojib' | 'jihad' | 'badhon';
  name: LocalizedText;
  roleInProject: LocalizedText;
  responsibility: LocalizedText;
}

export interface ProjectStoryOrganization {
  name: LocalizedText;
  domain: LocalizedText;
  currentSystem: LocalizedText;
  requirementsSummary: LocalizedText;
}

export interface ProjectStoryDialogue {
  speaker: LocalizedText;
  role: LocalizedText;
  line: LocalizedText;
}

export interface ProjectStoryLogicStep {
  stepTitle: LocalizedText;
  guidingQuestions: LocalizedText[];
}

export interface ProjectStory {
  projectId: string;
  previousConnection: LocalizedText;
  storyNarrative: LocalizedText[];
  characterRoles: ProjectStoryCharacterRole[];
  organization: ProjectStoryOrganization;
  problemDiscovery: LocalizedText[];
  conversations: ProjectStoryDialogue[];
  mission: LocalizedText;
  logicBuilding: {
    intro: LocalizedText;
    steps: ProjectStoryLogicStep[];
  };
  learningGoals: LocalizedText[];
  testingScenarios: LocalizedText[];
  acceptanceCriteria: LocalizedText[];
  finalDeliverySummary: LocalizedText;
  whatWeLearned: {
    reflections: LocalizedText;
    bridgeToNext: LocalizedText;
  };
}

export interface ProjectStoryLevelData {
  level: ProjectLevel;
  levelNumber: number;
  stories: ProjectStory[];
}

export interface ProjectTechCoreConcept {
  name: LocalizedText;
  explanation: LocalizedText;
  pylogicPart?: number;
}

export type TechLibraryTier = 'Required' | 'Recommended' | 'Optional';

export interface ProjectTechLibraryItem {
  name: string;
  tier: TechLibraryTier;
  isBuiltin: boolean;
  pipCommand?: string;
  whatItDoes: LocalizedText;
  whyProjectNeedsIt: LocalizedText;
  whereUsed: LocalizedText;
}

export interface ProjectStudyReference {
  concept: LocalizedText;
  shortExplanation: LocalizedText;
  pylogicPart: number;
  partLabel: LocalizedText;
}

export type SkillPrerequisiteDifficulty =
  | 'Beginner'
  | 'Intermediate'
  | 'Advanced'
  | 'Professional';

export interface ProjectSkillPrerequisites {
  difficulty: SkillPrerequisiteDifficulty;
  requiredPythonKnowledge: LocalizedText[];
  requiredProgrammingConcepts: LocalizedText[];
  recommendedPreviousKnowledge: LocalizedText[];
  studyBeforeStarting: ProjectStudyReference[];
}

export interface ProjectRoadmapStep {
  stepNumber: number;
  title: LocalizedText;
  objective: LocalizedText;
  details: LocalizedText[];
  guidingNote?: LocalizedText;
}

export interface ProjectConceptMappingRow {
  feature: LocalizedText;
  concept: LocalizedText;
  moduleOrLibrary: string;
  purpose: LocalizedText;
}

export interface ProjectCommandItem {
  command: string;
  whenToUse: LocalizedText;
  whyUsed: LocalizedText;
}

export interface ProjectTechGuide {
  projectId: string;
  coreConcepts: ProjectTechCoreConcept[];
  standardLibrary: ProjectTechLibraryItem[];
  externalLibraries: ProjectTechLibraryItem[];
  skillPrerequisites: ProjectSkillPrerequisites;
  buildRoadmap: ProjectRoadmapStep[];
  conceptMapping: ProjectConceptMappingRow[];
  commandReference: ProjectCommandItem[];
}

export interface ProjectTechGuideLevelData {
  level: ProjectLevel;
  levelNumber: number;
  guides: ProjectTechGuide[];
}

export interface ProjectDetail extends ProjectCatalogItem {
  realWorldProblem: LocalizedText;
  whyItMatters: LocalizedText;
  realWorldUseCases: LocalizedText[];
  requiredPythonConcepts: LocalizedText[];
  requiredToolsAndTech: LocalizedText[];
  functionalRequirements: LocalizedText[];
  nonFunctionalRequirements: LocalizedText[];
  expectedFeatures: LocalizedText[];
  constraints: LocalizedText[];
  suggestedFolderStructure: string[];
  folderStructureNote: LocalizedText;
  dataStorageRequirements: LocalizedText;
  testingRequirements: LocalizedText[];
  securityConsiderations: LocalizedText[];
  expectedDeliverables: LocalizedText[];
  githubPortfolioRequirements: LocalizedText[];
  thinkingChallenges: LocalizedText[];
  hints: ProjectHints;
  bonusChallenges: LocalizedText[];
  careerRelevance: ProjectCareerRelevance;
  story?: ProjectStory;
  guide?: ProjectTechGuide;
}

export interface ProjectLevelData {
  level: ProjectLevel;
  levelNumber: number;
  projects: ProjectDetail[];
}

export type ProjectChecklistKey =
  | 'storyUnderstood'
  | 'requirementsAnalyzed'
  | 'pythonConceptsReviewed'
  | 'requiredModulesUnderstood'
  | 'projectLogicPlanned'
  | 'folderStructureCreated'
  | 'basicVersionImplemented'
  | 'mainFeaturesImplemented'
  | 'errorHandlingCompleted'
  | 'testsPassed'
  | 'documentationWritten'
  | 'readmeCreated'
  | 'githubRepoPublished'
  | 'finalProjectReviewed';

export type ProjectChecklistState = Record<ProjectChecklistKey, boolean>;

export interface ProjectPersonalNotes {
  myUnderstanding?: string;
  myRequirements?: string;
  myLogic?: string;
  projectPlan: string;
  myAlgorithm?: string;
  architectureNotes: string;
  folderStructureNotes: string;
  myPythonConcepts?: string;
  implementationNotes: string;
  problemsFaced: string;
  howISolvedThem: string;
  testingResults: string;
  futureImprovements: string;
  githubRepoUrl: string;
  implementationDecisions?: string;
}

export interface ProjectWorkspaceEntry {
  status: ProjectStatus;
  notes: ProjectPersonalNotes;
  checklist?: ProjectChecklistState;
  updatedAt: string;
}

export type ProjectWorkspaceMap = Record<string, ProjectWorkspaceEntry>;
