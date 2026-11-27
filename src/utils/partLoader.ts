import type { PartProblemData } from '../types/pylogic';

const partModules = import.meta.glob<PartProblemData>('../data/parts/part*.json', {
  import: 'default',
});

const cache = new Map<number, PartProblemData>();
const inFlight = new Map<number, Promise<PartProblemData | null>>();

export function hasPartContent(partNumber: number): boolean {
  const padded = partNumber.toString().padStart(2, '0');
  return `../data/parts/part${padded}.json` in partModules;
}

export async function loadPartProblems(partNumber: number): Promise<PartProblemData | null> {
  if (cache.has(partNumber)) {
    return cache.get(partNumber) ?? null;
  }

  const pending = inFlight.get(partNumber);
  if (pending) {
    return pending;
  }

  const padded = partNumber.toString().padStart(2, '0');
  const key = `../data/parts/part${padded}.json`;
  const loader = partModules[key];

  if (!loader) {
    return null;
  }

  const request = loader()
    .then((data) => {
      cache.set(partNumber, data);
      return data;
    })
    .finally(() => {
      inFlight.delete(partNumber);
    });

  inFlight.set(partNumber, request);
  return request;
}
