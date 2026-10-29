import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

// Temp runs dir: the routes read from here, runs/ stays untouched.
let runsDir: string;
let config: RigConfig;

const line = (at: string, job: string, status: string, owner: string | null = 'rook', error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

// Job names in the order the HTML table lists them (first cell of each body row).
function htmlJobs(html: string): string[] {
  const body = html.match(/<tbody>[\s\S]*<\/tbody>/)?.[0] ?? '';
  return [...body.matchAll(/<tr[^>]*>\s*<td>([^<]*)<\/td>/g)].map((m) => m[1]!);
}

type JsonBody = { night: string; rows: { job: string }[]; badLines: number };

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };

  // Plain night. Lines are out of job order on purpose, so sorting is exercised.
  writeFileSync(
    join(runsDir, '2026-05-01.jsonl'),
    [
      line('2026-05-01T05:00:00+01:00', 'lane/sync', 'ok'),
      line('2026-05-01T04:00:00+01:00', 'notes/backup', 'fail', 'lane-07', 'quota exceeded'),
      line('2026-05-01T03:00:00+01:00', 'digest/render', 'ok', null),
      line('2026-05-01T02:00:00+01:00', 'fixtures/refresh', 'retry', 'rook', 'upstream 503'),
      line('2026-05-01T02:30:00+01:00', 'fixtures/refresh', 'ok'),
      '',
    ].join('\n') + '\n',
  );

  // Same jobs, one line that does not parse. Still a night; the bad line is counted.
  writeFileSync(
    join(runsDir, '2026-05-02.jsonl'),
    [
      line('2026-05-02T05:00:00+01:00', 'lane/sync', 'ok'),
      '{"at": "2026-05-02T04:00:00+01:00", "job": ',
      line('2026-05-02T03:00:00+01:00', 'digest/render', 'ok', null),
      line('2026-05-02T02:00:00+01:00', 'fixtures/refresh', 'ok'),
    ].join('\n'),
  );

  // Exists, but no lines at all.
  writeFileSync(join(runsDir, '2026-05-03.jsonl'), '');
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night (HTML)', () => {
  it('200 and a table for a night with a file', async () => {
    const res = await createApp(config).request('/digest/2026-05-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-05-01');
    expect(htmlJobs(html)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup']);
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-05-09');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for this night');
  });

  it('says "nothing ran" for an empty file', async () => {
    const res = await createApp(config).request('/digest/2026-05-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(htmlJobs(html)).toEqual([]);
  });

  it('stays 200 with a bad line, reports it, and still lists the jobs', async () => {
    const res = await createApp(config).request('/digest/2026-05-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line couldn&#39;t be read'); // apostrophe is HTML-escaped
    expect(htmlJobs(html)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync']);
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('200 and rows for a night with a file', async () => {
    const res = await createApp(config).request('/api/digest/2026-05-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.night).toBe('2026-05-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup']);
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-05-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: '2026-05-09' });
  });

  it('empty file: 200 with rows []', async () => {
    const res = await createApp(config).request('/api/digest/2026-05-03');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-05-03', rows: [], badLines: 0 });
  });

  it('bad line: 200, badLines 1, rows from the good lines only', async () => {
    const res = await createApp(config).request('/api/digest/2026-05-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonBody;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync']);
  });
});

describe('HTML and JSON agree', () => {
  it.each(['2026-05-01', '2026-05-02', '2026-05-03'])('%s lists the same jobs in the same order', async (night) => {
    const app = createApp(config);
    const html = await (await app.request(`/digest/${night}`)).text();
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as JsonBody;
    expect(htmlJobs(html)).toEqual(body.rows.map((r) => r.job));
  });
});
