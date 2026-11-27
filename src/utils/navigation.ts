import type { SectionId } from '../types/pylogic';
import type { TranslationDictionary } from './language';

export interface NavItemConfig {
  id: SectionId;
  index: string;
  labelKey: keyof Pick<
    TranslationDictionary['nav'],
    | 'dashboard'
    | 'logicBuilding'
    | 'projects'
    | 'myProgress'
    | 'aboutDeveloper'
    | 'settings'
  >;
  subtitleKey: keyof Pick<
    TranslationDictionary['nav'],
    | 'dashboardSubtitle'
    | 'logicBuildingSubtitle'
    | 'projectsSubtitle'
    | 'myProgressSubtitle'
    | 'aboutDeveloperSubtitle'
    | 'settingsSubtitle'
  >;
}

export const NAVIGATION_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    index: '01',
    labelKey: 'dashboard',
    subtitleKey: 'dashboardSubtitle',
  },
  {
    id: 'logic-building',
    index: '02',
    labelKey: 'logicBuilding',
    subtitleKey: 'logicBuildingSubtitle',
  },
  {
    id: 'projects',
    index: '03',
    labelKey: 'projects',
    subtitleKey: 'projectsSubtitle',
  },
  {
    id: 'my-progress',
    index: '04',
    labelKey: 'myProgress',
    subtitleKey: 'myProgressSubtitle',
  },
  {
    id: 'about-developer',
    index: '05',
    labelKey: 'aboutDeveloper',
    subtitleKey: 'aboutDeveloperSubtitle',
  },
  {
    id: 'settings',
    index: '06',
    labelKey: 'settings',
    subtitleKey: 'settingsSubtitle',
  },
];

const VALID_SECTIONS = new Set<SectionId>([
  'dashboard',
  'logic-building',
  'projects',
  'my-progress',
  'about-developer',
  'settings',
]);

export interface InitialRouteResolution {
  section: SectionId;
  isNotFound: boolean;
  requestedRoute: string;
}

export function resolveInitialRoute(): InitialRouteResolution {
  if (typeof window === 'undefined') {
    return { section: 'dashboard', isNotFound: false, requestedRoute: '' };
  }

  try {
    const rawHash = window.location.hash.replace(/^#/, '').trim();
    if (rawHash) {
      if (VALID_SECTIONS.has(rawHash as SectionId)) {
        return { section: rawHash as SectionId, isNotFound: false, requestedRoute: rawHash };
      }
      return { section: 'dashboard', isNotFound: true, requestedRoute: `#${rawHash}` };
    }

    const rawPathname = window.location.pathname || '/';
    const normalizedPath = rawPathname.replace(/\/+$/, '') || '/';

    if (
      normalizedPath === '/' ||
      normalizedPath === '/index.html' ||
      (rawPathname.endsWith('/') && rawPathname !== '/')
    ) {
      return { section: 'dashboard', isNotFound: false, requestedRoute: '' };
    }

    const segments = normalizedPath.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? '';

    if (lastSegment === 'index.html') {
      return { section: 'dashboard', isNotFound: false, requestedRoute: '' };
    }

    if (VALID_SECTIONS.has(lastSegment as SectionId)) {
      return { section: lastSegment as SectionId, isNotFound: false, requestedRoute: lastSegment };
    }

    // Handle GitHub Pages project site root visited without trailing slash (e.g. user.github.io/repo-name)
    const hostname = window.location.hostname ?? '';
    if (hostname.endsWith('.github.io') && segments.length === 1) {
      return { section: 'dashboard', isNotFound: false, requestedRoute: '' };
    }

    return { section: 'dashboard', isNotFound: true, requestedRoute: rawPathname };
  } catch {
    return { section: 'dashboard', isNotFound: false, requestedRoute: '' };
  }
}

export function getInitialSection(): SectionId {
  return resolveInitialRoute().section;
}

export function syncSectionHash(section: SectionId, isNotFound: boolean = false): void {
  if (typeof window === 'undefined' || isNotFound) {
    return;
  }
  try {
    const targetHash = `#${section}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  } catch {
    // Ignore history API restrictions
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function scrollToTop(): void {
  if (typeof window === 'undefined' || typeof window.scrollTo !== 'function') {
    return;
  }
  try {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  } catch {
    // Ignore scroll errors in restricted environments
  }
}

export function scrollElementIntoView(element: HTMLElement | null): void {
  if (!element || typeof element.scrollIntoView !== 'function') {
    return;
  }
  try {
    element.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  } catch {
    // Ignore scroll errors
  }
}
