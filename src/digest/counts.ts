import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';

// Counts per run line (not per job). Lines that don't parse are not counted.
export type NightCounts = { ok: number; retry: number; fail: number };

export function countLines(text: string): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line) counts[line.status]++;
  }
  return counts;
}

// null: the night's file can't be read.
export function countNight(runsDir: string, night: string): NightCounts | null {
  try {
    return countLines(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return null;
  }
}
