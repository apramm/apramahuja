import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run as runStrava } from './sync-strava.mjs'
import { parseFrontMatter } from './lib/activity.mjs'
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

// --- Strava photos ---
const CDN = 'https://dgtzuqphqg23d.cloudfront.net'
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
const img = (bytes = JPEG, type = 'image/jpeg', extra = {}) => new Response(bytes, { status: 200, headers: { 'content-type': type, ...extra } })
const photo = (url, caption = '') => ({ unique_id: 'u', caption, type: 1, urls: { 100: `${url}?small`, 1024: url }, location: [49.2, -123.1] })

// photos: { [activityId]: list | Response }, files: { [url]: () => Response }
function photoFetch(activities, photos = {}, files = {}) {
  const calls = []
  const fn = async (url, opts = {}) => {
    url = String(url)
    calls.push(url)
    assert.ok(opts.signal, 'every request needs a timeout signal')
    if (url.startsWith('https://www.strava.com/oauth/token')) return json({ access_token: 'access', refresh_token: 'refresh-old' })
    const m = url.match(/\/activities\/(\d+)\/photos\?size=1024&photo_sources=true$/)
    if (m) { assert.equal(opts.headers.authorization, 'Bearer access'); const p = photos[m[1]]; return p instanceof Response ? p : json(p ?? []) }
    if (url.includes('/athlete/activities')) return json(activities)
    assert.equal(opts.redirect, 'manual', 'photo downloads must not follow redirects')
    assert.equal(opts.headers?.authorization, undefined, 'never send the Strava token to the CDN')
    if (files[url]) return files[url]()
    return new Response('nope', { status: 404 })
  }
  return { fn, calls }
}
const runPhotos = async (f, dir, photoDir, logger = capture().logger) => runStrava({ env: stravaEnv, fetch: f.fn, dir, photoDir, log: logger })
const fm = async (dir, id) => parseFrontMatter(await readFile(join(dir, `2026-09-27-strava-${id}.md`), 'utf8')).data

test('strava photos: photos endpoint is called only for activities with total_photo_count > 0', async () => {
  const [dir, photoDir] = [await tmp(), await tmp()]
  const f = photoFetch([act(1, { total_photo_count: 0 }), act(2), act(3, { total_photo_count: 1 })], { 3: [photo(`${CDN}/a.jpg`, 'Summit')] }, { [`${CDN}/a.jpg`]: () => img() })
  assert.equal(await runPhotos(f, dir, photoDir), 0)
  assert.deepEqual(f.calls.filter((u) => u.includes('/photos')), ['https://www.strava.com/api/v3/activities/3/photos?size=1024&photo_sources=true'])
  assert.deepEqual(await readdir(photoDir), ['3-1.jpg'])
  assert.deepEqual(await readFile(join(photoDir, '3-1.jpg')), Buffer.from(JPEG))
  assert.deepEqual((await fm(dir, 3)).photos, [{ src: '/images/activities/3-1.jpg', alt: 'Summit' }])
  assert.deepEqual((await fm(dir, 1)).photos, [])
})

test('strava photos: only https URLs on allowlisted Strava CDN hosts are downloaded', async () => {
  const [dir, photoDir] = [await tmp(), await tmp()]
  const bad = ['http://dgtzuqphqg23d.cloudfront.net/a.jpg', 'https://evil.cloudfront.net/a.jpg', 'https://dgtzuqphqg23d.cloudfront.net.evil.com/a.jpg', 'https://169.254.169.254/latest', 'file:///etc/passwd']
  const f = photoFetch([act(1, { total_photo_count: 6 })], { 1: [...bad.map((u) => photo(u)), photo(`${CDN}/ok.jpg`)] }, { [`${CDN}/ok.jpg`]: () => img() })
  assert.equal(await runPhotos(f, dir, photoDir), 0)
  for (const u of bad) assert.ok(!f.calls.includes(u), `must not fetch ${u}`)
  assert.deepEqual(await readdir(photoDir), ['1-6.jpg'])
  assert.deepEqual((await fm(dir, 1)).photos.map((p) => p.src), ['/images/activities/1-6.jpg'])
})

test('strava photos: rejects wrong content-type, bad magic bytes, oversize, redirects', async () => {
  const [dir, photoDir] = [await tmp(), await tmp()]
  const big = new Uint8Array(8 * 1024 * 1024 + 1); big.set(JPEG)
  const files = {
    [`${CDN}/html.jpg`]: () => img(JPEG, 'text/html'),
    [`${CDN}/svg.jpg`]: () => img(JPEG, 'image/svg+xml'),
    [`${CDN}/lies.jpg`]: () => img(new TextEncoder().encode('<html>'), 'image/jpeg'),
    [`${CDN}/big.jpg`]: () => img(big), // no content-length: streamed cap
    [`${CDN}/biglen.jpg`]: () => img(JPEG, 'image/jpeg', { 'content-length': String(9 * 1024 * 1024) }),
    [`${CDN}/redirect.jpg`]: () => new Response(null, { status: 302, headers: { location: 'https://evil.example/x.jpg' } }),
    [`${CDN}/ok.png`]: () => img(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'),
  }
  const urls = Object.keys(files)
  const f = photoFetch([act(1, { total_photo_count: urls.length })], { 1: urls.map((u) => photo(u)) }, files)
  assert.equal(await runPhotos(f, dir, photoDir), 0)
  assert.ok(!f.calls.includes('https://evil.example/x.jpg'))
  assert.deepEqual(await readdir(photoDir), ['1-7.png'], 'only the valid png is kept; no temp files left')
  assert.deepEqual((await fm(dir, 1)).photos, [{ src: '/images/activities/1-7.png', alt: 'Run 1, photo 7' }])
})

test('strava photos: second run reuses files (no CDN fetch) and produces no diff', async () => {
  const [dir, photoDir] = [await tmp(), await tmp()]
  const list = [act(1, { total_photo_count: 2 })]
  const photos = { 1: [photo(`${CDN}/a.jpg`), photo(`${CDN}/b.jpg`, 'Trail')] }
  const files = { [`${CDN}/a.jpg`]: () => img(), [`${CDN}/b.jpg`]: () => img() }
  await runPhotos(photoFetch(list, photos, files), dir, photoDir)
  const md = await readFile(join(dir, '2026-09-27-strava-1.md'), 'utf8')
  const second = photoFetch(list, photos, {})
  assert.equal(await runPhotos(second, dir, photoDir), 0)
  assert.ok(!second.calls.some((u) => u.startsWith(CDN)), 'existing files are not re-downloaded')
  assert.equal(second.calls.filter((u) => u.includes('/photos')).length, 1, 'one photos call per activity')
  assert.equal(await readFile(join(dir, '2026-09-27-strava-1.md'), 'utf8'), md)
  assert.deepEqual((await readdir(photoDir)).sort(), ['1-1.jpg', '1-2.jpg'])
})

test('strava photos: hand-added photos are kept after synced ones; existing synced entries keep their alt', async () => {
  const [dir, photoDir] = [await tmp(), await tmp()]
  await writeFile(join(dir, '2026-09-27-strava-1.md'), [
    '---',
    'title: "Run 1"',
    'photos:',
    '  - "/images/activities/mine.jpg"',
    '  - src: /images/activities/1-2.jpg',
    '    alt: My own alt',
    '  - src: "/images/activities/other.jpg"',
    '    alt: "Other"',
    'source: "strava"',
    '---',
    'Body.',
    '',
  ].join('\n'))
  const f = photoFetch([act(1, { total_photo_count: 2 })], { 1: [photo(`${CDN}/a.jpg`, 'A'), photo(`${CDN}/b.jpg`, 'B')] }, { [`${CDN}/a.jpg`]: () => img(), [`${CDN}/b.jpg`]: () => img() })
  assert.equal(await runPhotos(f, dir, photoDir), 0)
  const data = await fm(dir, 1)
  assert.deepEqual(data.photos, [
    { src: '/images/activities/1-1.jpg', alt: 'A' },
    { src: '/images/activities/1-2.jpg', alt: 'My own alt' },
    '/images/activities/mine.jpg',
    { src: '/images/activities/other.jpg', alt: 'Other' },
  ])
})

test('strava photos: a photos API or download failure still writes the activity and keeps existing files', async () => {
  const [dir, photoDir] = [await tmp(), await tmp()]
  await writeFile(join(photoDir, '2-1.jpg'), 'old')
  const { lines, logger } = capture()
  const f = photoFetch([act(1, { total_photo_count: 1 }), act(2, { total_photo_count: 2 })],
    { 1: json({ message: 'Rate Limit Exceeded' }, 429), 2: [photo(`${CDN}/a.jpg`), photo(`${CDN}/b.jpg`)] },
    { [`${CDN}/b.jpg`]: () => { throw new Error('socket hang up') } })
  assert.equal(await runPhotos(f, dir, photoDir, logger), 0)
  assert.deepEqual((await readdir(dir)).sort(), ['2026-09-27-strava-1.md', '2026-09-27-strava-2.md'])
  assert.deepEqual((await fm(dir, 2)).photos, [{ src: '/images/activities/2-1.jpg', alt: 'Run 2, photo 1' }])
  assert.equal(await readFile(join(photoDir, '2-1.jpg'), 'utf8'), 'old')
  assert.match(lines.join('\n'), /photo/i)
  assert.doesNotMatch(lines.join('\n'), /access|sekrit/)
})
