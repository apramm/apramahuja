import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run as runStrava } from './sync-strava.mjs'
import { run as runHevy } from './sync-hevy.mjs'
import { run as runLastfm, toMusic } from './sync-lastfm.mjs'

const tmp = () => mkdtemp(join(tmpdir(), 'sync-'))
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
function capture() {
  const lines = []
  const log = (...a) => lines.push(a.join(' '))
  return { lines, logger: { log, warn: log, error: log } }
}

const stravaEnv = { STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: 'sekrit', STRAVA_REFRESH_TOKEN: 'refresh-old' }
const act = (id, extra = {}) => ({ id, name: `Run ${id}`, sport_type: 'Run', start_date_local: '2026-09-27T18:10:00Z', utc_offset: 0, distance: 5000, moving_time: 1500, total_elevation_gain: 10, private: false, visibility: 'everyone', ...extra })

function stravaFetch(activities, token = { access_token: 'access', refresh_token: 'refresh-old' }) {
  return async (url, opts = {}) => {
    assert.ok(opts.signal, 'every request needs a timeout signal')
    if (String(url).startsWith('https://www.strava.com/oauth/token')) return json(token)
    assert.equal(opts.headers.authorization, 'Bearer access')
    return json(activities)
  }
}

test('strava: missing env skips with exit 0', async () => {
  const { lines, logger } = capture()
  assert.equal(await runStrava({ env: {}, fetch: () => assert.fail('no fetch'), dir: await tmp(), log: logger }), 0)
  assert.match(lines.join('\n'), /skipping/i)
})

test('strava: writes only visibility=everyone activities', async () => {
  const dir = await tmp()
  const acts = [act(1), act(2, { private: true }), act(3, { visibility: 'only_me' }), act(4, { visibility: 'followers_only' }), act(5, { visibility: undefined })]
  const code = await runStrava({ env: stravaEnv, fetch: stravaFetch(acts), dir, log: capture().logger })
  assert.equal(code, 0)
  assert.deepEqual(await readdir(dir), ['2026-09-27-strava-1.md'])
})

test('strava: API error exits 1 and leaves existing files untouched', async () => {
  const dir = await tmp()
  await writeFile(join(dir, '2026-01-01-strava-9.md'), 'keep me')
  const failing = async (url) => String(url).includes('oauth') ? json({ access_token: 'access' }) : json({ message: 'Rate Limit Exceeded' }, 429)
  assert.equal(await runStrava({ env: stravaEnv, fetch: failing, dir, log: capture().logger }), 1)
  assert.equal(await readFile(join(dir, '2026-01-01-strava-9.md'), 'utf8'), 'keep me')
})

test('strava: rotated refresh token writes data, logs ::error:: naming the secret, exits 1, never prints the token', async () => {
  const { lines, logger } = capture()
  const dir = await tmp()
  assert.equal(await runStrava({ env: stravaEnv, fetch: stravaFetch([act(1)], { access_token: 'access', refresh_token: 'refresh-NEW' }), dir, log: logger }), 1)
  assert.deepEqual(await readdir(dir), ['2026-09-27-strava-1.md'])
  const out = lines.join('\n')
  assert.match(out, /::error::.*STRAVA_REFRESH_TOKEN/)
  assert.doesNotMatch(out, /refresh-NEW|sekrit|access/)
})

test('hevy: missing env skips; maps workouts; API error keeps files', async () => {
  assert.equal(await runHevy({ env: {}, fetch: () => assert.fail(), dir: await tmp(), log: capture().logger }), 0)

  const dir = await tmp()
  const ok = async (url, opts) => {
    assert.equal(opts.headers['api-key'], 'hk')
    assert.match(String(url), /page=1&pageSize=10/)
    return json({ page: 1, page_count: 1, workouts: [{ id: 'abc-123', title: 'Legs', start_time: '2026-09-02T16:00:00Z', end_time: '2026-09-02T17:00:00Z' }] })
  }
  assert.equal(await runHevy({ env: { HEVY_API_KEY: 'hk' }, fetch: ok, dir, log: capture().logger }), 0)
  assert.deepEqual(await readdir(dir), ['2026-09-02-hevy-abc-123.md'])
  assert.match(await readFile(join(dir, '2026-09-02-hevy-abc-123.md'), 'utf8'), /activity: "gym"/)

  assert.equal(await runHevy({ env: { HEVY_API_KEY: 'hk' }, fetch: async () => json({ error: 'Unauthorized' }, 401), dir, log: capture().logger }), 1)
  assert.deepEqual(await readdir(dir), ['2026-09-02-hevy-abc-123.md'])
})

const recent = { recenttracks: { track: [
  { name: 'Now Song', artist: { '#text': 'Live Band' }, album: { '#text': 'Live' }, url: 'https://www.last.fm/music/x/_/now', '@attr': { nowplaying: 'true' } },
  { name: 'Old Song', artist: { '#text': 'Band' }, album: { '#text': 'LP' }, url: 'javascript:alert(1)', date: { uts: '1790000000' } },
] } }
const top = { toptracks: { track: [{ name: 'Hit', artist: { name: 'Band' }, playcount: '12', url: 'https://www.last.fm/music/Band/_/Hit' }] } }

test('lastfm: maps recent (incl. nowplaying) and top tracks to the SPEC shape, drops non-https urls', () => {
  assert.deepEqual(toMusic({ recent, top, user: 'u', fetchedAt: '2026-10-01T00:00:00.000Z' }), {
    fetched_at: '2026-10-01T00:00:00.000Z',
    user: 'u',
    recent: [
      { track: 'Now Song', artist: 'Live Band', album: 'Live', url: 'https://www.last.fm/music/x/_/now', played_at: '2026-10-01T00:00:00.000Z' },
      { track: 'Old Song', artist: 'Band', album: 'LP', url: '', played_at: new Date(1790000000 * 1000).toISOString() },
    ],
    top_week: [{ track: 'Hit', artist: 'Band', plays: 12, url: 'https://www.last.fm/music/Band/_/Hit' }],
  })
})

test('lastfm: writes music.json, skips rewrite when only fetched_at changed, error keeps file', async () => {
  const file = join(await tmp(), 'music.json')
  const fetchOk = async (url) => json(String(url).includes('getrecenttracks') ? recent : top)
  const env = { LASTFM_API_KEY: 'k', LASTFM_USER: 'u' }
  assert.equal(await runLastfm({ env: {}, fetch: () => assert.fail(), file, log: capture().logger }), 0)

  assert.equal(await runLastfm({ env, fetch: fetchOk, file, log: capture().logger, now: () => '2026-10-01T00:00:00.000Z' }), 0)
  const first = await readFile(file, 'utf8')
  assert.equal(JSON.parse(first).user, 'u')
  await runLastfm({ env, fetch: fetchOk, file, log: capture().logger, now: () => '2026-10-01T06:00:00.000Z' })
  assert.equal(await readFile(file, 'utf8'), first, 'unchanged music → no diff')

  assert.equal(await runLastfm({ env, fetch: async () => json({ error: 10, message: 'Invalid API key' }), file, log: capture().logger }), 1)
  assert.equal(await readFile(file, 'utf8'), first)
})

test('lastfm: lone surrogates are replaced', () => {
  const m = toMusic({ recent: { recenttracks: { track: { name: 'a\ud800', artist: { '#text': '\udfff' }, url: '' } } }, top: { toptracks: { track: [] } }, user: 'u', fetchedAt: 'now' })
  assert.equal(m.recent[0].track, 'a�')
  assert.equal(m.recent[0].artist, '�')
})
