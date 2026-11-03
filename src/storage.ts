export type Best = { score: number; floor: number; combo: number };

/** One finished run. `t` is when it ended, in milliseconds since 1970. */
export type RunRecord = { score: number; floor: number; cash: number; combo: number; t: number };

const BEST_KEY = "cashy-tower:best";
const RECORDS_KEY = "cashy-tower:records";
const DESIGN_KEY = "cashy-tower:design";
export const RECORDS_KEPT = 5;

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or blocked storage: it lasts this visit only.
  }
}

export function loadBest(): Best {
  const saved = (read(BEST_KEY) ?? {}) as Partial<Best>;
  return { score: Number(saved.score) || 0, floor: Number(saved.floor) || 0, combo: Number(saved.combo) || 0 };
}

export function saveBest(best: Best) {
  write(BEST_KEY, best);
}

export function loadRecords(): RunRecord[] {
  const saved = read(RECORDS_KEY);
  if (!Array.isArray(saved)) return [];
  return saved
    .map((run) => ({ score: Number(run?.score) || 0, floor: Number(run?.floor) || 0, cash: Number(run?.cash) || 0, combo: Number(run?.combo) || 0, t: Number(run?.t) || 0 }))
    .slice(0, RECORDS_KEPT);
}

/** Keeps the best five by score, newest first on a tie. */
export function addRecord(records: RunRecord[], run: RunRecord) {
  const next = [...records, run].sort((a, b) => b.score - a.score || b.t - a.t).slice(0, RECORDS_KEPT);
  write(RECORDS_KEY, next);
  return next;
}

export function loadDesign(): number {
  return Math.max(0, Math.floor(Number(read(DESIGN_KEY)) || 0));
}

export function saveDesign(index: number) {
  write(DESIGN_KEY, index);
}
