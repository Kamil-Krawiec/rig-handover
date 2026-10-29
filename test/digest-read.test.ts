import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n).not.toBeNull();
    expect(n!.badLines).toBe(1);
    expect(n!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const fixtures = n!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fixtures).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(fixtures.firstAt).toBe('2026-10-29T01:30:00+01:00');
    const backup = n!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(n!.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });
});
