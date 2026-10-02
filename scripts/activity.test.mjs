import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalize, toFrontMatter, filenameFor, writeActivities } from './lib/activity.mjs'

// Our emitter writes one `key: <JSON value>` per line; JSON is valid YAML, so this is a faithful reader.
function parseFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/)
  assert.ok(m, 'front matter must be --- delimited')
  return Object.fromEntries(m[1].split('\n').map((line) => {
    const i = line.indexOf(': ')
    return [line.slice(0, i), JSON.parse(line.slice(i + 2))]
  }))
}

const stravaRun = {
  id: 12345678901,
  name: 'Evening Run',
  sport_type: 'Run',
  type: 'Run',
  start_date: '2026-09-28T01:10:00Z',
  start_date_local: '2026-09-27T18:10:00Z',
  utc_offset: -25200,
  distance: 8437.2,
  moving_time: 2661,
  elapsed_time: 2800,
  total_elevation_gain: 119.6,
  location_city: 'Vancouver',
  private: false,
  visibility: 'everyone',
}

const hevyWorkout = {
  id: 'b459cba5-cd6d-463c-abd6-54f8eafcadcb',
  title: 'Upper Body',
  description: 'push day',
  start_time: '2026-09-04T17:00:00+00:00',
  end_time: '2026-09-04T18:05:30+00:00',
  exercises: [],
}

test('normalize maps a Strava run to the SPEC activity shape', () => {
  assert.deepEqual(normalize('strava', stravaRun), {
    title: 'Evening Run',
    date: '2026-09-27T18:10:00-07:00',
    activity: 'run',
    distance_km: 8.4,
    duration: '44:21',
    moving_seconds: 2661,
    elevation_m: 120,
    location: 'Vancouver',
    tags: ['running'],
    source: 'strava',
    source_id: '12345678901',
    source_url: 'https://www.strava.com/activities/12345678901',
    photos: [],
    example: false,
  })
})

test('normalize maps Strava sport types, gym has no distance, long durations get hours', () => {
  const lift = normalize('strava', { ...stravaRun, sport_type: 'WeightTraining', distance: 0, total_elevation_gain: 0, moving_time: 3930, location_city: null })
  assert.equal(lift.activity, 'gym')
  assert.equal(lift.distance_km, undefined)
  assert.equal(lift.elevation_m, undefined)
  assert.equal(lift.location, '')
  assert.equal(lift.duration, '1:05:30')
  assert.equal(normalize('strava', { ...stravaRun, sport_type: 'Workout' }).activity, 'gym')
  assert.equal(normalize('strava', { ...stravaRun, sport_type: 'TrailRun' }).activity, 'run')
  assert.equal(normalize('strava', { ...stravaRun, sport_type: 'Hike' }).activity, 'hike')
  assert.equal(normalize('strava', { ...stravaRun, sport_type: 'GravelRide' }).activity, 'ride')
  assert.equal(normalize('strava', { ...stravaRun, sport_type: 'Swim' }).activity, 'swim')
  assert.equal(normalize('strava', { ...stravaRun, sport_type: 'Walk' }).activity, 'walk')
  assert.equal(normalize('strava', { ...stravaRun, sport_type: 'Kitesurf' }).activity, 'other')
})

test('normalize maps a Hevy workout to type gym with duration from start/end', () => {
  assert.deepEqual(normalize('hevy', hevyWorkout), {
    title: 'Upper Body',
    date: '2026-09-04T10:00:00-07:00',
    activity: 'gym',
    duration: '1:05:30',
    moving_seconds: 3930,
    location: '',
    tags: ['fitness'],
    source: 'hevy',
    source_id: 'b459cba5-cd6d-463c-abd6-54f8eafcadcb',
    source_url: '',
    photos: [],
    example: false,
  })
})

test('normalize rejects ids that are unsafe in a filename', () => {
  assert.throws(() => normalize('hevy', { ...hevyWorkout, id: '../../etc/passwd' }))
  assert.throws(() => normalize('strava', { ...stravaRun, id: 'abc' }))
})

test('filename is <yyyy-mm-dd>-<source>-<id>.md using the local date', () => {
  assert.equal(filenameFor(normalize('strava', stravaRun)), '2026-09-27-strava-12345678901.md')
  assert.equal(filenameFor(normalize('hevy', hevyWorkout)), '2026-09-04-hevy-b459cba5-cd6d-463c-abd6-54f8eafcadcb.md')
})

test('toFrontMatter round-trips nasty titles', () => {
  for (const title of ['He said "hi"', 'key: value # not a comment', '🏔️ summit', 'line one\nline two', "it's ---\n---", '- [x] {a: b}', 'tab\there', '\\back\\slash']) {
    const text = toFrontMatter({ title, photos: [], example: false, distance_km: 1.5 })
    assert.equal(parseFrontMatter(text).title, title)
    assert.equal(text.split('\n').filter((l) => l === '---').length, 2, 'no extra delimiter lines')
  }
})

async function tmp() { return mkdtemp(join(tmpdir(), 'acts-')) }

test('writeActivities is idempotent: second write changes nothing', async () => {
  const dir = await tmp()
  const acts = [normalize('strava', stravaRun)]
  await writeActivities(dir, acts, 'strava')
  const file = join(dir, '2026-09-27-strava-12345678901.md')
  const before = await stat(file)
  const content = await readFile(file, 'utf8')
  await new Promise((r) => setTimeout(r, 20))
  const result = await writeActivities(dir, acts, 'strava')
  assert.equal((await stat(file)).mtimeMs, before.mtimeMs)
  assert.equal(await readFile(file, 'utf8'), content)
  assert.deepEqual(result, { written: 0, removed: 0, unchanged: 1 })
  assert.deepEqual(await readdir(dir), ['2026-09-27-strava-12345678901.md'], 'no temp files left behind')
})

test('writeActivities removes stale files of the same source only, never manual files', async () => {
  const dir = await tmp()
  const keep = ['evening-run.md', '2026-01-01-hevy-old.md', '2026-01-01-morning-strava-notes.md', 'upper-body.md']
  for (const f of keep) await writeFile(join(dir, f), 'x')
  await writeFile(join(dir, '2026-09-27-strava-999.md'), toFrontMatter({ title: 'old', source: 'strava' }))
  await writeFile(join(dir, '2026-09-27-strava-555.md'), toFrontMatter({ title: 'hand-edited', source: 'manual' }))
  keep.push('2026-09-27-strava-555.md')
  await writeActivities(dir, [normalize('strava', stravaRun)], 'strava')
  assert.deepEqual((await readdir(dir)).sort(), [...keep, '2026-09-27-strava-12345678901.md'].sort())
})

test('normalize replaces lone UTF-16 surrogates so Hugo YAML parses', () => {
  const a = normalize('strava', { ...stravaRun, name: 'bad \ud800 name', location_city: '\udfff' })
  assert.equal(a.title, 'bad � name')
  assert.equal(a.location, '�')
  assert.equal(normalize('hevy', { ...hevyWorkout, title: '\ud800' }).title, '�')
})

test('normalize rejects malformed dates (path traversal via filename)', () => {
  assert.throws(() => normalize('strava', { ...stravaRun, start_date_local: '../../x' }), /date/)
  assert.throws(() => normalize('hevy', { ...hevyWorkout, start_time: '../../x' }), /start_time/)
  assert.throws(() => normalize('hevy', { ...hevyWorkout, start_time: 1790000000 }), /start_time/)
})

test('writeActivities refuses unsafe filenames', async () => {
  const a = { ...normalize('strava', stravaRun), date: '../../x' }
  await assert.rejects(writeActivities(await tmp(), [a], 'strava'), /filename/)
})

test('Hevy UTC times become SITE_TZ local time with explicit offset, across DST', () => {
  // Uses Los Angeles: tzdata 2026c puts America/Vancouver on permanent UTC-7 from Nov 2026,
  // so its result depends on the runtime's tz data. LA: PDT before 2026-11-01 09:00Z, PST after.
  const la = { tz: 'America/Los_Angeles' }
  const before = normalize('hevy', { ...hevyWorkout, start_time: '2026-11-01T08:30:00Z', end_time: '2026-11-01T09:30:00Z' }, la)
  const after = normalize('hevy', { ...hevyWorkout, start_time: '2026-11-01T09:30:00Z', end_time: '2026-11-01T10:30:00Z' }, la)
  assert.equal(before.date, '2026-11-01T01:30:00-07:00')
  assert.equal(after.date, '2026-11-01T01:30:00-08:00')
  assert.equal(before.moving_seconds, 3600)
  // Late-evening UTC→ previous local day; filename uses the local date.
  const late = normalize('hevy', { ...hevyWorkout, start_time: '2026-09-25T02:00:00+00:00' })
  assert.equal(late.date, '2026-09-24T19:00:00-07:00')
  assert.equal(filenameFor(late), '2026-09-24-hevy-b459cba5-cd6d-463c-abd6-54f8eafcadcb.md')
  assert.equal(normalize('hevy', { ...hevyWorkout, start_time: '2026-09-25T02:00:00Z' }, { tz: 'Asia/Kolkata' }).date, '2026-09-25T07:30:00+05:30')
})

test('normalize emits default tags per activity type', () => {
  const tags = (sport_type) => normalize('strava', { ...stravaRun, sport_type }).tags
  assert.deepEqual(tags('Run'), ['running'])
  assert.deepEqual(tags('Hike'), ['hiking'])
  assert.deepEqual(tags('Ride'), ['cycling'])
  assert.deepEqual(tags('Swim'), ['swimming'])
  assert.deepEqual(tags('WeightTraining'), ['fitness'])
  assert.deepEqual(tags('Walk'), ['walking'])
  assert.deepEqual(tags('Kitesurf'), [])
})

test('writeActivities keeps hand-edited body, photos, description and merges tags', async () => {
  const dir = await tmp()
  const file = join(dir, '2026-09-27-strava-12345678901.md')
  await writeFile(file, [
    '---',
    'title: "Old title"',
    'description: Sunset loop with Sam',
    'photos:',
    '  - "/images/activities/a.jpg"',
    '  - /images/activities/b.jpg',
    'tags: ["running", "seawall"]',
    'source: "strava"',
    '---',
    'Legs felt great.',
    '',
  ].join('\n'))
  const r = await writeActivities(dir, [normalize('strava', stravaRun)], 'strava')
  assert.equal(r.written, 1)
  const text = await readFile(file, 'utf8')
  const fm = parseFrontMatter(text)
  assert.equal(fm.title, 'Evening Run', 'synced keys still update')
  assert.equal(fm.description, 'Sunset loop with Sam')
  assert.deepEqual(fm.photos, ['/images/activities/a.jpg', '/images/activities/b.jpg'])
  assert.deepEqual(fm.tags, ['running', 'seawall'])
  assert.ok(text.endsWith('---\nLegs felt great.\n'))
  assert.deepEqual(await writeActivities(dir, [normalize('strava', stravaRun)], 'strava'), { written: 0, removed: 0, unchanged: 1 }, 'merge is idempotent')
})

test('writeActivities prunes only stale files inside the fetched date window', async () => {
  const dir = await tmp()
  const old = (name) => writeFile(join(dir, name), toFrontMatter({ title: 'x', source: 'strava' }))
  await old('2026-09-01-strava-1.md') // older than window: keep
  await old('2026-09-15-strava-2.md') // inside window, not returned: prune
  await old('2026-10-30-strava-3.md') // newer than window: keep
  const acts = [normalize('strava', { ...stravaRun, id: 10, start_date_local: '2026-09-10T08:00:00Z' }), normalize('strava', stravaRun)]
  const r = await writeActivities(dir, acts, 'strava')
  assert.equal(r.removed, 1)
  assert.deepEqual((await readdir(dir)).sort(), ['2026-09-01-strava-1.md', '2026-09-10-strava-10.md', '2026-09-27-strava-12345678901.md', '2026-10-30-strava-3.md'])
  assert.equal((await writeActivities(dir, [], 'strava')).removed, 0, 'empty fetch prunes nothing')
})
