import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { countLines } from '../src/digest/counts.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('links each night to its digest with counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    for (const n of ['2026-10-28', '2026-10-27']) {
      expect(html).toMatch(new RegExp(`<a href="/digest/${n}">${n}</a> · ok \\d+ · retry \\d+ · fail \\d+`));
    }
  });

  it('counts run lines and skips bad ones', () => {
    const l = (status: string) => JSON.stringify({ at: 'a', job: 'j', status, owner: null });
    expect(countLines([l('ok'), 'nope', l('retry'), l('ok'), ''].join('\n'))).toEqual({ ok: 2, retry: 1, fail: 0 });
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});
