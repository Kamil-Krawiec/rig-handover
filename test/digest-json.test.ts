import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { readNight } from '../src/digest/read.js';

describe('GET /api/digest/:night', () => {
  const config = loadConfig();
  const app = createApp(config);

  it('returns readNight output', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[] };
    expect(body).toEqual(readNight(config.runsDir, '2026-10-28'));
    expect(body.rows).toHaveLength(5);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
  });

  it('404s for a missing night', async () => {
    const res = await app.request('/api/digest/1999-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: '1999-01-01' });
  });
});
