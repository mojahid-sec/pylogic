import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Provide safe SSR browser storage & window shims before importing app modules
const mockStorageMap = new Map<string, string>();
const localStorageShim = {
  getItem: (key: string) => mockStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    mockStorageMap.set(key, String(value));
  },
  removeItem: (key: string) => {
    mockStorageMap.delete(key);
  },
  clear: () => {
    mockStorageMap.clear();
  },
};

let lastReplacedUrl = '';

Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: localStorageShim,
    location: {
      hash: '',
      pathname: '/',
      hostname: 'mojahid-sec.github.io',
      origin: 'https://mojahid-sec.github.io',
    },
    history: {
      replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => {
        if (typeof url === 'string') {
          lastReplacedUrl = url;
          if (url.startsWith('#')) {
            (globalThis.window as unknown as { location: { hash: string } }).location.hash =
              url;
          }
        }
      },
    },
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    scrollTo: () => {},
    innerWidth: 1280,
  },
  writable: true,
});

import App from '../src/App';
import { AboutDeveloperView } from '../src/components/AboutDeveloperView';
import { DashboardView } from '../src/components/DashboardView';
import { LogicBuildingView } from '../src/components/LogicBuildingView';
import { NotFoundView } from '../src/components/NotFoundView';
import { ProgressView } from '../src/components/ProgressView';
import { ProjectsView } from '../src/components/ProjectsView';
import { ProjectDetailWorkspace } from '../src/components/ProjectDetailWorkspace';
import { SettingsView } from '../src/components/SettingsView';
import curriculumJson from '../src/data/curriculum.json';
import projectsCatalogJson from '../src/data/projectsCatalog.json';
import translationsJson from '../src/data/translations.json';
import {
  applyImportedBackupSnapshot,
  buildPlatformBackupSnapshot,
  MAX_BACKUP_FILE_BYTES,
  parseAndValidateBackupJson,
} from '../src/services/dataExportService';
import {
  loadProblemProgressMap,
  loadSolvedProblemIds,
  saveProblemProgressMap,
} from '../src/services/learningProgressRepository';
import { DEFAULT_USER_PREFERENCES } from '../src/services/preferencesRepository';
import {
  EMPTY_CHECKLIST,
  EMPTY_NOTES,
  loadProjectWorkspaceMap,
  PROJECT_CHECKLIST_KEYS,
  sanitizeProjectWorkspaceMap,
  saveProjectWorkspaceMap,
} from '../src/services/projectWorkspaceRepository';
import type {
  PartProblemData,
  ProjectDetail,
  ProjectLevelData,
  ProjectStory,
  ProjectStoryLevelData,
  ProjectTechGuide,
  ProjectTechGuideLevelData,
} from '../src/types/pylogic';
import { resolveInitialRoute, syncSectionHash } from '../src/utils/navigation';
import {
  computeChecklistProgress,
  updateProjectChecklist,
} from '../src/utils/projectStorage';
import { isSafeHttpUrl, isSafeObjectKey } from '../src/utils/url';

export async function runTests() {
  console.log('1. Verifying 20 Parts / 400 Python Problems...');
  assert.equal(curriculumJson.parts.length, 20, 'Expected 20 curriculum parts');
  const seenProblemIds = new Set<string>();
  for (let i = 1; i <= 20; i += 1) {
    const padded = i.toString().padStart(2, '0');
    const filePath = path.resolve(process.cwd(), `src/data/parts/part${padded}.json`);
    assert.ok(fs.existsSync(filePath), `Missing ${filePath}`);
    const partData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PartProblemData;
    assert.equal(partData.problems.length, 20, `Part ${padded} should have 20 problems`);
    for (const p of partData.problems) {
      assert.ok(!seenProblemIds.has(p.id), `Duplicate problem ID: ${p.id}`);
      seenProblemIds.add(p.id);
    }
  }
  assert.equal(seenProblemIds.size, 400, 'Expected exactly 400 unique problems');

  console.log('2. Verifying 20 Real-World Projects...');
  assert.equal(projectsCatalogJson.length, 20, 'Expected 20 projects in catalog');
  const seenProjectIds = new Set<string>();
  for (let lvl = 1; lvl <= 4; lvl += 1) {
    const padded = lvl.toString().padStart(2, '0');
    const filePath = path.resolve(process.cwd(), `src/data/projects/level${padded}.json`);
    assert.ok(fs.existsSync(filePath), `Missing ${filePath}`);
    const levelData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ProjectLevelData;
    assert.equal(levelData.projects.length, 5, `Level ${padded} should have 5 projects`);
    for (const proj of levelData.projects) {
      assert.ok(!seenProjectIds.has(proj.id), `Duplicate project ID: ${proj.id}`);
      seenProjectIds.add(proj.id);
    }
  }
  assert.equal(seenProjectIds.size, 20, 'Expected exactly 20 unique projects');

  console.log('2b. Verifying 20 Bilingual Story-Based Engineering Journeys...');
  const seenStoryIds = new Set<string>();
  let sampleProject01: ProjectDetail | null = null;
  let sampleStory01: ProjectStory | null = null;

  const collectText = (
    node: unknown,
    lang: 'en' | 'bn',
    bucket: string[]
  ): void => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        collectText(item, lang, bucket);
      }
      return;
    }
    const record = node as Record<string, unknown>;
    const enVal = record.en;
    const bnVal = record.bn;
    if (typeof enVal === 'string' && typeof bnVal === 'string') {
      bucket.push(lang === 'en' ? enVal : bnVal);
      return;
    }
    for (const val of Object.values(record)) {
      collectText(val, lang, bucket);
    }
  };

  for (let lvl = 1; lvl <= 4; lvl += 1) {
    const padded = lvl.toString().padStart(2, '0');
    const storyPath = path.resolve(
      process.cwd(),
      `src/data/stories/storyLevel${padded}.json`
    );
    assert.ok(fs.existsSync(storyPath), `Missing ${storyPath}`);
    const storyData = JSON.parse(
      fs.readFileSync(storyPath, 'utf-8')
    ) as ProjectStoryLevelData;
    assert.equal(
      storyData.stories.length,
      5,
      `storyLevel${padded}.json should have 5 stories`
    );

    for (const story of storyData.stories) {
      assert.ok(
        !seenStoryIds.has(story.projectId),
        `Duplicate story projectId: ${story.projectId}`
      );
      assert.ok(
        seenProjectIds.has(story.projectId),
        `Story projectId ${story.projectId} missing from projects`
      );
      seenStoryIds.add(story.projectId);

      assert.ok(
        story.previousConnection.en.trim().length > 20 &&
          story.previousConnection.bn.trim().length > 20,
        `${story.projectId} missing previousConnection`
      );
      assert.ok(
        story.storyNarrative.length >= 3,
        `${story.projectId} must have at least 3 storyNarrative paragraphs`
      );
      for (const p of story.storyNarrative) {
        assert.ok(
          p.en.trim().length > 30 && p.bn.trim().length > 30,
          `${story.projectId} has empty/short narrative paragraph`
        );
      }

      const roleIds = new Set(story.characterRoles.map((r) => r.characterId));
      for (const requiredId of ['sajid', 'sojib', 'jihad', 'badhon'] as const) {
        assert.ok(
          roleIds.has(requiredId),
          `${story.projectId} missing character role ${requiredId}`
        );
      }

      assert.ok(
        story.organization.name.en.trim().length > 0 &&
          story.organization.name.bn.trim().length > 0 &&
          story.organization.currentSystem.en.trim().length > 0 &&
          story.organization.requirementsSummary.bn.trim().length > 0,
        `${story.projectId} incomplete organization block`
      );
      assert.ok(
        story.problemDiscovery.length >= 2,
        `${story.projectId} needs problemDiscovery items`
      );
      assert.ok(
        story.conversations.length >= 3,
        `${story.projectId} needs team conversations`
      );
      assert.ok(
        story.mission.en.trim().length > 20 && story.mission.bn.trim().length > 20,
        `${story.projectId} missing mission`
      );
      assert.ok(
        story.logicBuilding.steps.length >= 3,
        `${story.projectId} needs logicBuilding steps`
      );
      assert.ok(
        story.learningGoals.length >= 2 &&
          story.testingScenarios.length >= 2 &&
          story.acceptanceCriteria.length >= 2,
        `${story.projectId} missing goals/testing/acceptance items`
      );
      assert.ok(
        story.finalDeliverySummary.en.trim().length > 20 &&
          story.whatWeLearned.reflections.bn.trim().length > 20 &&
          story.whatWeLearned.bridgeToNext.en.trim().length > 20,
        `${story.projectId} missing delivery/reflection fields`
      );

      const enBucket: string[] = [];
      const bnBucket: string[] = [];
      collectText(story, 'en', enBucket);
      collectText(story, 'bn', bnBucket);

      const enCombined = enBucket.join(' ');
      const bnCombined = bnBucket.join(' ');

      const enWordCount = enCombined.trim().split(/\s+/).filter(Boolean).length;
      assert.ok(
        enWordCount >= 700,
        `${story.projectId} EN word count too low (${enWordCount})`
      );
      assert.ok(
        bnCombined.trim().length >= 1500,
        `${story.projectId} BN text too short`
      );

      for (const expectedName of [
        'MD. MOJAHIDUR RAHMAN SAJID',
        'Sojib',
        'Jihad',
        'Badhon',
      ]) {
        assert.ok(
          enCombined.includes(expectedName),
          `${story.projectId} EN missing character ${expectedName}`
        );
      }

      assert.ok(
        enCombined.includes('Bogura Polytechnic'),
        `${story.projectId} EN missing Bogura Polytechnic reference`
      );
      const bnNormalized = bnCombined.normalize('NFC');
      assert.ok(
        bnNormalized.includes('বগু') && bnNormalized.includes('পলিটেকনিক'),
        `${story.projectId} BN missing Bogura Polytechnic reference`
      );

      for (const forbidden of ['```python', '```', '\ndef ', '\nclass ', 'if __name__']) {
        assert.ok(
          !enCombined.includes(forbidden) && !bnCombined.includes(forbidden),
          `${story.projectId} contains forbidden code snippet marker (${forbidden})`
        );
      }

      if (story.projectId === 'PRJ-01') {
        sampleStory01 = story;
      }
    }
  }
  assert.equal(seenStoryIds.size, 20, 'Expected exactly 20 unique project stories');

  let sampleGuide01: ProjectTechGuide | null = null;

  console.log('2c. Verifying 20 Project Technology Guides & Completion Roadmaps...');
  const STDLIB_MODULES = new Set([
    'os',
    'pathlib',
    'shutil',
    'datetime',
    'time',
    'json',
    'csv',
    'sqlite3',
    'logging',
    'hashlib',
    'secrets',
    'hmac',
    're',
    'socket',
    'ssl',
    'subprocess',
    'argparse',
    'unittest',
    'statistics',
    'collections',
    'concurrent.futures',
    'urllib',
    'urllib.parse',
    'urllib.request',
    'ipaddress',
    'configparser',
    'zipfile',
    'tarfile',
    'tempfile',
    'stat',
    'fnmatch',
    'struct',
    'gzip',
    'unicodedata',
    'decimal',
    'math',
    'uuid',
    'http',
    'http.server',
    'getpass',
    'platform',
  ]);
  const seenGuideIds = new Set<string>();
  for (let lvl = 1; lvl <= 4; lvl += 1) {
    const padded = lvl.toString().padStart(2, '0');
    const guidePath = path.resolve(
      process.cwd(),
      `src/data/guides/guideLevel${padded}.json`
    );
    assert.ok(fs.existsSync(guidePath), `Missing ${guidePath}`);
    const guideData = JSON.parse(
      fs.readFileSync(guidePath, 'utf-8')
    ) as ProjectTechGuideLevelData;
    assert.equal(
      guideData.guides.length,
      5,
      `guideLevel${padded}.json should have 5 guides`
    );

    for (const guide of guideData.guides) {
      assert.ok(!seenGuideIds.has(guide.projectId), `Duplicate guide ${guide.projectId}`);
      assert.ok(seenProjectIds.has(guide.projectId), `Unknown guide ID ${guide.projectId}`);
      seenGuideIds.add(guide.projectId);

      assert.ok(guide.coreConcepts.length >= 3, `${guide.projectId} needs >= 3 coreConcepts`);
      for (const concept of guide.coreConcepts) {
        assert.ok(concept.name.en.trim() && concept.name.bn.trim());
        assert.ok(concept.explanation.en.trim() && concept.explanation.bn.trim());
        if (concept.pylogicPart !== undefined) {
          assert.ok(
            concept.pylogicPart >= 1 && concept.pylogicPart <= 20,
            `${guide.projectId} invalid pylogicPart ${concept.pylogicPart}`
          );
        }
      }

      assert.ok(guide.standardLibrary.length >= 4, `${guide.projectId} needs >= 4 stdlib modules`);
      for (const mod of guide.standardLibrary) {
        assert.equal(mod.isBuiltin, true, `${guide.projectId} stdlib ${mod.name} must have isBuiltin: true`);
        assert.equal(mod.pipCommand, undefined, `${guide.projectId} stdlib ${mod.name} must NOT have pipCommand`);
        assert.ok(['Required', 'Recommended', 'Optional'].includes(mod.tier));
        assert.ok(mod.whatItDoes.en.trim() && mod.whatItDoes.bn.trim());
        assert.ok(mod.whyProjectNeedsIt.en.trim() && mod.whyProjectNeedsIt.bn.trim());
      }

      for (const ext of guide.externalLibraries) {
        assert.equal(ext.isBuiltin, false, `${guide.projectId} external ${ext.name} must have isBuiltin: false`);
        assert.ok(
          !STDLIB_MODULES.has(ext.name.toLowerCase()),
          `${guide.projectId} stdlib module ${ext.name} wrongly placed in externalLibraries`
        );
        assert.ok(
          typeof ext.pipCommand === 'string' && ext.pipCommand.startsWith('pip install '),
          `${guide.projectId} external ${ext.name} missing valid pip install command`
        );
        for (const token of ext.pipCommand.replace(/^pip install\s+/, '').split(/\s+/)) {
          assert.ok(
            !STDLIB_MODULES.has(token.toLowerCase()),
            `${guide.projectId} pipCommand contains stdlib module ${token}`
          );
        }
      }

      assert.ok(
        ['Beginner', 'Intermediate', 'Advanced', 'Professional'].includes(
          guide.skillPrerequisites.difficulty
        ),
        `${guide.projectId} invalid prerequisite difficulty`
      );
      assert.ok(guide.skillPrerequisites.requiredPythonKnowledge.length >= 2);
      assert.ok(guide.skillPrerequisites.requiredProgrammingConcepts.length >= 2);
      assert.ok(guide.skillPrerequisites.studyBeforeStarting.length >= 1);
      for (const ref of guide.skillPrerequisites.studyBeforeStarting) {
        assert.ok(ref.pylogicPart >= 1 && ref.pylogicPart <= 20);
        assert.ok(ref.shortExplanation.en.trim() && ref.shortExplanation.bn.trim());
      }

      assert.equal(guide.buildRoadmap.length, 10, `${guide.projectId} must have 10 buildRoadmap steps`);
      guide.buildRoadmap.forEach((step, idx) => {
        assert.equal(step.stepNumber, idx + 1, `${guide.projectId} stepNumber mismatch`);
        assert.ok(step.title.en.trim() && step.title.bn.trim());
        assert.ok(step.objective.en.trim() && step.objective.bn.trim());
        assert.ok(step.details.length >= 1);
      });

      assert.ok(guide.conceptMapping.length >= 4, `${guide.projectId} needs >= 4 conceptMapping rows`);
      assert.ok(guide.commandReference.length >= 2, `${guide.projectId} needs >= 2 commandReference items`);

      const enGuideText: string[] = [];
      const bnGuideText: string[] = [];
      collectText(guide, 'en', enGuideText);
      collectText(guide, 'bn', bnGuideText);
      const enJoined = enGuideText.join(' ');
      const bnJoined = bnGuideText.join(' ');
      for (const forbidden of ['```python', '```', '\ndef ', '\nclass ', 'if __name__']) {
        assert.ok(
          !enJoined.includes(forbidden) && !bnJoined.includes(forbidden),
          `${guide.projectId} guide contains forbidden source code marker (${forbidden})`
        );
      }

      if (guide.projectId === 'PRJ-01') {
        sampleGuide01 = guide;
      }
    }
  }
  assert.equal(seenGuideIds.size, 20, 'Expected exactly 20 project technology guides');

  const level01Data = JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), 'src/data/projects/level01.json'),
      'utf-8'
    )
  ) as ProjectLevelData;
  sampleProject01 =
    level01Data.projects.find((p) => p.id === 'PRJ-01') ?? null;
  assert.ok(
    sampleProject01 && sampleStory01 && sampleGuide01,
    'PRJ-01, its story, and its guide must exist'
  );

  console.log('3. Verifying Developer Portrait SHA-256 integrity...');
  const portraitPath = path.resolve(process.cwd(), 'src/assets/developer/profile.jpeg');
  assert.ok(fs.existsSync(portraitPath), 'Developer portrait file missing');
  const portraitHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(portraitPath))
    .digest('hex');
  assert.equal(
    portraitHash,
    '67e73992cc7c787c3867e37e1b2eaf7e8ac1e941eccd728f4b748101b0cce1bf',
    'Developer portrait hash must remain untouched'
  );

  console.log('4. Verifying EN/BN Translation Key Parity...');
  function collectLeafKeys(obj: unknown, prefix = ''): string[] {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return [prefix];
    }
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      collectLeafKeys(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  const enKeys = new Set(collectLeafKeys(translationsJson.en));
  const bnKeys = new Set(collectLeafKeys(translationsJson.bn));
  for (const k of enKeys) {
    assert.ok(bnKeys.has(k), `Missing Bangla translation key: ${k}`);
  }
  for (const k of bnKeys) {
    assert.ok(enKeys.has(k), `Extra Bangla translation key missing from EN: ${k}`);
  }

  console.log('5. Verifying Zero Auth / Backend Leftovers & GitHub Pages Configuration...');
  for (const removedPath of [
    'src/components/AuthView.tsx',
    'src/services/authService.ts',
    'src/services/cloudDataService.ts',
    'src/services/supabaseClient.ts',
    'vercel.json',
    'supabase',
  ]) {
    assert.equal(
      fs.existsSync(path.resolve(process.cwd(), removedPath)),
      false,
      `${removedPath} must be removed`
    );
  }
  const pkgJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
  ) as { dependencies?: Record<string, string> };
  assert.equal(
    pkgJson.dependencies?.['@supabase/supabase-js'],
    undefined,
    '@supabase/supabase-js must not be in package.json'
  );

  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'public/.nojekyll')), 'Missing .nojekyll');
  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'public/404.html')), 'Missing 404.html');
  assert.ok(
    fs.existsSync(path.resolve(process.cwd(), '.github/workflows/deploy-pages.yml')),
    'Missing GitHub Pages workflow'
  );
  const viteCfg = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf-8');
  assert.ok(
    viteCfg.includes("process.env.VITE_BASE_PATH || './'"),
    'vite.config.ts must configure relative/Pages base path'
  );

  console.log('6. Verifying GitHub Pages Subpath Routing & Hash Synchronization...');
  window.location.pathname = '/pylogic/';
  window.location.hash = '';
  assert.equal(resolveInitialRoute().section, 'dashboard');
  assert.equal(resolveInitialRoute().isNotFound, false);

  window.location.pathname = '/pylogic';
  window.location.hash = '';
  assert.equal(resolveInitialRoute().section, 'dashboard');
  assert.equal(resolveInitialRoute().isNotFound, false);

  window.location.pathname = '/pylogic/';
  window.location.hash = '#logic-building';
  assert.equal(resolveInitialRoute().section, 'logic-building');
  assert.equal(resolveInitialRoute().isNotFound, false);

  syncSectionHash('projects', false);
  assert.equal(lastReplacedUrl, '#projects', 'Hash sync must only set hash and preserve /pylogic/');
  assert.equal(window.location.pathname, '/pylogic/');

  window.location.hash = '#nonexistent-xyz';
  assert.equal(resolveInitialRoute().isNotFound, true);
  window.location.pathname = '/';
  window.location.hash = '';

  console.log('7. Verifying Local Persistence & Validated JSON Backup Export/Import...');
  mockStorageMap.clear();
  const initialSolved = loadSolvedProblemIds();
  assert.deepEqual(initialSolved, ['P01-01', 'P01-02', 'P01-03']);

  const map = loadProblemProgressMap();
  map['P04-02'] = {
    problemId: 'P04-02',
    partNumber: 4,
    isCompleted: true,
    attempts: 3,
    problemNote: 'Edge case tested locally',
    lastActivityAt: '2026-11-24T04:00:00Z',
  };
  saveProblemProgressMap(map);
  saveProjectWorkspaceMap({
    'PRJ-01': {
      status: 'Completed',
      notes: {
        ...EMPTY_NOTES,
        myUnderstanding: 'Parse student lab schedules before normalizing CSV headers',
        myRequirements: 'Accept CSV and output deterministic JSON timetable',
        myLogic: 'Validate columns first, then group by semester',
        myAlgorithm: '1. Read CSV 2. Validate row 3. Emit JSON report',
        myPythonConcepts: 'csv.DictReader, pathlib.Path, argparse',
        implementationDecisions: 'Use pathlib & argparse',
      },
      checklist: {
        ...EMPTY_CHECKLIST,
        storyUnderstood: true,
        requirementsAnalyzed: true,
        finalProjectReviewed: true,
      },
      updatedAt: '2026-11-24T04:00:00Z',
    },
  });

  // Simulate page reload reading from localStorage
  assert.ok(loadSolvedProblemIds().includes('P04-02'));
  assert.equal(loadProblemProgressMap()['P04-02'].problemNote, 'Edge case tested locally');
  assert.equal(
    loadProjectWorkspaceMap()['PRJ-01'].notes.implementationDecisions,
    'Use pathlib & argparse'
  );
  assert.equal(
    loadProjectWorkspaceMap()['PRJ-01'].notes.myUnderstanding,
    'Parse student lab schedules before normalizing CSV headers'
  );
  assert.equal(
    loadProjectWorkspaceMap()['PRJ-01'].notes.myRequirements,
    'Accept CSV and output deterministic JSON timetable'
  );
  assert.equal(
    loadProjectWorkspaceMap()['PRJ-01'].notes.myPythonConcepts,
    'csv.DictReader, pathlib.Path, argparse'
  );
  assert.equal(
    loadProjectWorkspaceMap()['PRJ-01'].notes.myLogic,
    'Validate columns first, then group by semester'
  );
  assert.equal(
    loadProjectWorkspaceMap()['PRJ-01'].notes.myAlgorithm,
    '1. Read CSV 2. Validate row 3. Emit JSON report'
  );
  assert.equal(PROJECT_CHECKLIST_KEYS.length, 14, 'Expected 14 checklist items');
  assert.equal(
    computeChecklistProgress(loadProjectWorkspaceMap()['PRJ-01'].checklist).completed,
    3
  );

  // Verify unchecking finalProjectReviewed automatically downgrades Completed -> Testing
  const downgradedMap = updateProjectChecklist(loadProjectWorkspaceMap(), 'PRJ-01', {
    ...loadProjectWorkspaceMap()['PRJ-01'].checklist!,
    finalProjectReviewed: false,
  });
  assert.equal(downgradedMap['PRJ-01'].status, 'Testing');

  // Re-check finalProjectReviewed for backup verification
  saveProjectWorkspaceMap({
    ...downgradedMap,
    'PRJ-01': {
      ...downgradedMap['PRJ-01'],
      status: 'Completed',
      checklist: {
        ...downgradedMap['PRJ-01'].checklist!,
        finalProjectReviewed: true,
      },
    },
  });

  // Export snapshot, verify invalid imports are rejected without overwriting local data
  const exportedJson = JSON.stringify(buildPlatformBackupSnapshot());
  const badJsonRes = parseAndValidateBackupJson('{not valid json');
  assert.equal(badJsonRes.ok, false);
  if (!badJsonRes.ok) {
    assert.equal(badJsonRes.errorCode, 'invalid_json');
  }
  const wrongSchemaRes = parseAndValidateBackupJson(JSON.stringify({ platform: 'OTHER' }));
  assert.equal(wrongSchemaRes.ok, false);
  if (!wrongSchemaRes.ok) {
    assert.equal(wrongSchemaRes.errorCode, 'invalid_schema');
  }

  // Clear local storage (simulate another browser), validate + apply backup snapshot
  mockStorageMap.clear();
  const parsedBackup = parseAndValidateBackupJson(exportedJson);
  assert.equal(parsedBackup.ok, true);
  if (parsedBackup.ok) {
    assert.equal(parsedBackup.summary.solvedCount, 4);
    assert.equal(parsedBackup.summary.projectsCount, 1);
    const applied = applyImportedBackupSnapshot(parsedBackup.snapshot);
    assert.ok(applied.solvedIds.includes('P04-02'));
    assert.equal(
      applied.projectWorkspaceMap['PRJ-01'].notes.implementationDecisions,
      'Use pathlib & argparse'
    );
    assert.equal(
      applied.projectWorkspaceMap['PRJ-01'].notes.myRequirements,
      'Accept CSV and output deterministic JSON timetable'
    );
    assert.equal(
      applied.projectWorkspaceMap['PRJ-01'].checklist?.finalProjectReviewed,
      true
    );
  }
  assert.ok(loadSolvedProblemIds().includes('P04-02'));

  console.log('8. Verifying SSR Rendering of All Views...');
  const renders = [
    renderToStaticMarkup(React.createElement(App)),
    renderToStaticMarkup(
      React.createElement(DashboardView, {
        language: 'en',
        solvedIds: ['P01-01'],
        activityLog: curriculumJson.defaultActivity as never,
        onNavigate: () => {},
      })
    ),
    renderToStaticMarkup(
      React.createElement(LogicBuildingView, {
        language: 'en',
        solvedIds: ['P01-01'],
        onToggleSolved: () => {},
      })
    ),
    renderToStaticMarkup(React.createElement(ProjectsView, { language: 'en' })),
    renderToStaticMarkup(
      React.createElement(ProgressView, {
        language: 'en',
        solvedIds: ['P01-01'],
        bookmarks: [],
        notes: [],
        onOpenPart: () => {},
        onResetProgress: () => {},
      })
    ),
    renderToStaticMarkup(React.createElement(AboutDeveloperView, { language: 'bn' })),
    renderToStaticMarkup(
      React.createElement(SettingsView, {
        preferences: DEFAULT_USER_PREFERENCES,
        resolvedTheme: 'light',
        solvedCount: 1,
        projectWorkspaceMap: {},
        onUpdatePreferences: () => {},
        onResetPreferences: () => {},
        onResetLogicProgress: () => {},
        onResetProjectWorkspaces: () => {},
        onImportBackup: () => {},
        onNavigate: () => {},
        onNotify: () => {},
      })
    ),
    renderToStaticMarkup(
      React.createElement(NotFoundView, {
        language: 'en',
        requestedRoute: '/invalid',
        onNavigate: () => {},
      })
    ),
  ];

  const mergedPrj01: ProjectDetail = {
    ...sampleProject01,
    story: sampleStory01,
    guide: sampleGuide01,
  };
  const projectWorkspaceEnHtml = renderToStaticMarkup(
    React.createElement(ProjectDetailWorkspace, {
      language: 'en',
      projectId: 'PRJ-01',
      projectDetail: mergedPrj01,
      isLoading: false,
      loadError: false,
      workspaceEntry: {
        status: 'Planning',
        notes: { ...EMPTY_NOTES },
        checklist: { ...EMPTY_CHECKLIST, storyUnderstood: true },
        updatedAt: '2026-11-24T04:00:00Z',
      },
      hasPrev: false,
      hasNext: true,
      onOpenCurriculumPart: () => {},
      onBack: () => {},
      onPrev: () => {},
      onNext: () => {},
      onUpdateStatus: () => {},
      onUpdateChecklist: () => {},
      onUpdateNotes: () => {},
      onClearNotes: () => {},
    })
  );
  const projectWorkspaceBnHtml = renderToStaticMarkup(
    React.createElement(ProjectDetailWorkspace, {
      language: 'bn',
      projectId: 'PRJ-01',
      projectDetail: mergedPrj01,
      isLoading: false,
      loadError: false,
      workspaceEntry: {
        status: 'Planning',
        notes: { ...EMPTY_NOTES },
        checklist: { ...EMPTY_CHECKLIST, storyUnderstood: true },
        updatedAt: '2026-11-24T04:00:00Z',
      },
      hasPrev: false,
      hasNext: true,
      onOpenCurriculumPart: () => {},
      onBack: () => {},
      onPrev: () => {},
      onNext: () => {},
      onUpdateStatus: () => {},
      onUpdateChecklist: () => {},
      onUpdateNotes: () => {},
      onClearNotes: () => {},
    })
  );

  // Verify all 12 collapsible sections render and are collapsed by default
  const collapsedButtonsEn = projectWorkspaceEnHtml.match(/aria-expanded="false"/g) ?? [];
  assert.equal(
    collapsedButtonsEn.length,
    12,
    `Expected all 12 sections collapsed by default on initial render, got ${collapsedButtonsEn.length}`
  );
  for (const heading of [
    '1. Story',
    '3. Python Technologies &amp; Tools',
    '5. Project Build Roadmap',
    '10. Completion Tracker',
    '12. GitHub Submission Guide',
  ]) {
    assert.ok(
      projectWorkspaceEnHtml.includes(heading),
      `ProjectDetailWorkspace EN SSR missing section heading: ${heading}`
    );
  }
  for (const headingBn of [
    '১. গল্প ও প্রেক্ষাপট',
    '৩. পাইথন প্রযুক্তি ও টুলস',
    '১০. প্রজেক্ট সম্পন্ন ট্র্যাকার',
    '১২. গিটহাব সাবমিশন গাইড',
  ]) {
    assert.ok(
      projectWorkspaceBnHtml.includes(headingBn),
      `ProjectDetailWorkspace BN SSR missing section heading: ${headingBn}`
    );
  }

  for (const html of [...renders, projectWorkspaceEnHtml, projectWorkspaceBnHtml]) {
    assert.ok(html.length > 50, 'Expected non-empty rendered HTML');
  }

  console.log('9. Verifying Security Hardening, Input Sanitization & 404 Guard...');
  assert.equal(isSafeHttpUrl('https://github.com/mojahid-sec/pylogic'), true);
  assert.equal(isSafeHttpUrl('http://localhost:3000'), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeHttpUrl('https://example.com/\ninjected'), false);
  assert.equal(isSafeHttpUrl(''), false);

  assert.equal(isSafeObjectKey('PRJ-01'), true);
  assert.equal(isSafeObjectKey('__proto__'), false);
  assert.equal(isSafeObjectKey('constructor'), false);
  assert.equal(isSafeObjectKey('prototype'), false);

  const pollutedPayload =
    '{"platform":"PYLOGIC","schemaVersion":2,"learningProgress":{"solvedProblemIds":["P01-01","INVALID","__proto__"],"problemProgressMap":{"__proto__":{"isCompleted":true,"attempts":999999},"P01-01":{"isCompleted":true,"attempts":999999}},"activityLog":[{"id":"act-1","type":"Solved","timestamp":{"en":"Just now","bn":"এইমাত্র"},"reference":{"en":"Part 01 · P01-01","bn":"অংশ ০১ · P01-01"},"description":{"en":"Solved","bn":"সমাধান"}},{"bad":true}]},"projectWorkspace":{"__proto__":{"status":"Completed"},"PRJ-01":{"status":"Planning","notes":{"githubRepoUrl":"javascript:alert(1)","myUnderstanding":"Valid note"}}}}';
  const sanitizedResult = parseAndValidateBackupJson(pollutedPayload);
  assert.equal(sanitizedResult.ok, true);
  if (sanitizedResult.ok) {
    assert.deepEqual(sanitizedResult.snapshot.learningProgress.solvedProblemIds, ['P01-01']);
    assert.equal(
      sanitizedResult.snapshot.learningProgress.problemProgressMap?.['P01-01']?.attempts,
      10_000
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        sanitizedResult.snapshot.projectWorkspace,
        '__proto__'
      ),
      false
    );
    assert.equal(
      isSafeHttpUrl(
        sanitizedResult.snapshot.projectWorkspace['PRJ-01']?.notes.githubRepoUrl
      ),
      false
    );
    assert.equal(sanitizedResult.snapshot.learningProgress.activityLog.length, 1);
  }

  const sanitizedMap = sanitizeProjectWorkspaceMap(
    JSON.parse('{"__proto__":{"status":"Completed"},"INVALID":{"status":"Planning"}}')
  );
  assert.equal(Object.keys(sanitizedMap).length, 0);

  const oversizedJson = ' '.repeat(MAX_BACKUP_FILE_BYTES + 1);
  const oversizedResult = parseAndValidateBackupJson(oversizedJson);
  assert.equal(oversizedResult.ok, false);
  if (!oversizedResult.ok) {
    assert.equal(oversizedResult.errorCode, 'file_too_large');
  }

  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
  assert.ok(
    indexHtml.includes('<meta name="referrer" content="strict-origin-when-cross-origin"'),
    'index.html must include strict-origin-when-cross-origin referrer policy'
  );

  const notFoundHtml = fs.readFileSync(
    path.resolve(process.cwd(), 'public/404.html'),
    'utf-8'
  );
  assert.ok(
    notFoundHtml.includes('isGitHubPages') && notFoundHtml.includes('rawPath !== basePath'),
    'public/404.html must guard against infinite GitHub Pages 404 redirect loops'
  );

  console.log('ALL VERIFICATION CHECKS PASSED!');
}
