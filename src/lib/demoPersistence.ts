// =============================================================================
// AEMS v2 — Keeps DEMO MOCK MODE data across dev-server restarts by mirroring the
// in-memory stores to a local JSON file. Never active with a real database.
// =============================================================================

import fs from 'fs';
import path from 'path';

type Getter = () => unknown;
type Setter = (data: unknown) => void;

interface PersistenceState {
  snapshot: Record<string, unknown> | null;
  getters: Map<string, Getter>;
  applied: Set<string>;
  lastWritten: string;
  timer: ReturnType<typeof setInterval> | null;
}

const DATA_FILE = path.join(process.cwd(), '.aems-demo-data.json');
const FLUSH_INTERVAL_MS = 1500;

const globalRef = globalThis as unknown as { __aems_demo_persistence?: PersistenceState };

function state(): PersistenceState {
  if (!globalRef.__aems_demo_persistence) {
    let snapshot: Record<string, unknown> | null = null;
    try {
      if (fs.existsSync(DATA_FILE)) snapshot = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
      console.warn('[AEMS DEMO DATA] Could not read saved demo data, starting fresh:', err);
    }
    globalRef.__aems_demo_persistence = { snapshot, getters: new Map(), applied: new Set(), lastWritten: '', timer: null };
  }
  return globalRef.__aems_demo_persistence;
}

function flush(): void {
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.npm_lifecycle_event === 'build' ||
    process.argv.some((arg) => typeof arg === 'string' && arg.includes('build'))
  ) {
    return;
  }
  const s = state();
  // Keep saved sections whose module has not been loaded in this process yet.
  const payload: Record<string, unknown> = { ...(s.snapshot || {}) };
  for (const [name, get] of s.getters) payload[name] = get();
  const json = JSON.stringify(payload);
  if (json === s.lastWritten) return;
  try {
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, DATA_FILE);
    s.lastWritten = json;
    s.snapshot = payload;
  } catch (err) {
    console.warn('[AEMS DEMO DATA] Could not save demo data:', err);
  }
}

function ensureTimer(s: PersistenceState): void {
  if (s.timer) return;
  s.timer = setInterval(flush, FLUSH_INTERVAL_MS);
  s.timer.unref?.();
  process.once('exit', flush);
}

/**
 * Registers a piece of demo state. Saved data is restored into it once per server
 * process; afterwards its current value is written to disk whenever it changes.
 */
export function persistDemoState(name: string, get: Getter, set: Setter): void {
  const s = state();
  if (!s.applied.has(name)) {
    s.applied.add(name);
    if (s.snapshot && name in s.snapshot) {
      try {
        set(s.snapshot[name]);
      } catch (err) {
        console.warn(`[AEMS DEMO DATA] Could not restore "${name}":`, err);
      }
    }
  }
  s.getters.set(name, get);
  ensureTimer(s);
}
