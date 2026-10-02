// Shared activity model: provider record → SPEC front matter → idempotent, atomic files.
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const TIMEOUT_MS = 15_000
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const ISO_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const SAFE_FILE = /^[\w-]+\.md$/
export const DEFAULT_TZ = 'America/Vancouver'

// Default tags so interest pages can relate activities by tag; hand-added tags are merged in on resync.
const DEFAULT_TAGS = { run: ['running'], hike: ['hiking'], ride: ['cycling'], swim: ['swimming'], gym: ['fitness'], walk: ['walking'], other: [] }

const STRAVA_TYPES = {
  run: ['Run', 'TrailRun', 'VirtualRun'],
  hike: ['Hike', 'Snowshoe'],
  ride: ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'EMountainBikeRide', 'VirtualRide', 'Velomobile', 'Handcycle'],
  swim: ['Swim'],
  gym: ['WeightTraining', 'Workout', 'Crossfit', 'HighIntensityIntervalTraining', 'Yoga', 'Pilates'],
  walk: ['Walk'],
}

export function stravaType(sportType) {
  for (const [type, names] of Object.entries(STRAVA_TYPES)) if (names.includes(sportType)) return type
  return 'other'
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60))
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm.padStart(2, '0')}:${ss}` : `${mm}:${ss}`
}

function offset(seconds) {
  const abs = Math.abs(seconds)
  return `${seconds < 0 ? '-' : '+'}${String(Math.floor(abs / 3600)).padStart(2, '0')}:${String(Math.floor((abs % 3600) / 60)).padStart(2, '0')}`
}

// Strava's start_date_local is local wall time with a fake "Z"; utc_offset (seconds) gives the real offset.
function stravaLocalDate(a) {
  const local = typeof a.start_date_local === 'string' ? a.start_date_local : ''
  if (!ISO_LOCAL.test(local)) throw new Error(`Strava activity ${a.id} has an invalid start_date_local`)
  return `${local.slice(0, 19)}${offset(Number(a.utc_offset) || 0)}`
}

// UTC instant → wall time in `tz` with that moment's offset (DST-correct), e.g. 2026-09-24T19:00:00-07:00.
export function localIso(ms, tz = DEFAULT_TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(ms).map((x) => [x.type, x.value]))
  const wall = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
  return `${wall}${offset(Math.round((Date.parse(`${wall}Z`) - Math.floor(ms / 1000) * 1000) / 1000))}`
}

const str = (v) => (typeof v === 'string' ? v.toWellFormed() : '')
const positive = (n) => (Number.isFinite(n) && n > 0 ? n : undefined)

function requireId(id) {
  const s = String(id ?? '')
  if (!SAFE_ID.test(s)) throw new Error(`unsafe or missing activity id: ${JSON.stringify(s).slice(0, 80)}`)
  return s
}

export function normalize(source, r, { tz = DEFAULT_TZ } = {}) {
  let a
  if (source === 'strava') {
    const id = requireId(r.id)
    if (!/^\d+$/.test(id)) throw new Error(`unexpected Strava id: ${id}`)
    const km = positive(Number(r.distance) / 1000)
    a = {
      title: str(r.name) || 'Activity',
      date: stravaLocalDate(r),
      activity: stravaType(r.sport_type || r.type),
      distance_km: km && Math.round(km * 10) / 10,
      duration: formatDuration(r.moving_time),
      moving_seconds: Math.round(Number(r.moving_time) || 0),
      elevation_m: positive(Math.round(Number(r.total_elevation_gain))),
      location: str(r.location_city),
      source_id: id,
      source_url: `https://www.strava.com/activities/${id}`,
    }
  } else if (source === 'hevy') {
    const id = requireId(r.id)
    const raw = typeof r.start_time === 'string' ? r.start_time : ''
    // Hevy times are UTC; a zoneless value is treated as UTC, never as the runner machine's local time.
    const start = ISO_LOCAL.test(raw) ? Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`) : NaN
    if (!Number.isFinite(start)) throw new Error(`Hevy workout ${id} has no valid start_time`)
    const secs = Math.max(0, Math.round((Date.parse(r.end_time) - start) / 1000)) || 0
    a = {
      title: str(r.title) || 'Workout',
      date: localIso(start, tz),
      activity: 'gym',
      duration: formatDuration(secs),
      moving_seconds: secs,
      location: '',
      source_id: id,
      source_url: '', // Hevy has no public per-workout URLs
    }
  } else {
    throw new Error(`unknown source: ${source}`)
  }
  // Fixed SPEC key order; drop undefined optionals.
  const out = {}
  for (const k of ['title', 'date', 'activity', 'distance_km', 'duration', 'moving_seconds', 'elevation_m', 'location']) if (a[k] !== undefined) out[k] = a[k]
  return { ...out, tags: [...DEFAULT_TAGS[out.activity]], source, source_id: a.source_id, source_url: a.source_url, photos: [], example: false }
}

// JSON scalars/arrays are valid YAML, and JSON string escaping makes any title safe on one line.
export function toFrontMatter(obj, body = '') {
  const lines = Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
  return `---\n${lines.join('\n')}\n---\n${body}`
}

export const filenameFor = (a) => `${a.date.slice(0, 10)}-${a.source}-${a.source_id}.md`

// Reads back our own JSON-per-line front matter plus the plain YAML a human is likely to hand-write
// (bare scalars, `- item` block lists, `[a, b]` flow lists).
// ponytail: tolerant YAML subset, not a YAML parser; nested maps/multiline scalars are ignored (kept as-is only if they are in the body).
export function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { data: {}, body: text }
  const scalar = (v) => { try { return JSON.parse(v) } catch { return v.replace(/^(['"])(.*)\1$/, '$2') } }
  const data = {}
  let listKey = null
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.*?)\s*$/)
    if (item && listKey) { data[listKey].push(scalar(item[1])); continue }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*?)\s*$/)
    if (!kv) { listKey = null; continue }
    const [, k, v] = kv
    listKey = v === '' ? k : null
    if (v === '') data[k] = []
    else if (/^\[.*\]$/.test(v)) { try { data[k] = JSON.parse(v) } catch { data[k] = v.slice(1, -1).split(',').map((x) => scalar(x.trim())).filter((x) => x !== '') } }
    else data[k] = scalar(v)
  }
  return { data, body: m[2] }
}

// Hand edits win for body, photos, description; tags are unioned. Every other key is owned by the sync.
function mergeExisting(a, existing) {
  if (existing == null) return { fm: a, body: '' }
  const { data, body } = parseFrontMatter(existing)
  const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
  const { title, ...rest } = a
  return {
    fm: {
      title,
      description: typeof data.description === 'string' && data.description ? data.description : undefined,
      ...rest,
      tags: [...new Set([...a.tags, ...strings(data.tags)])],
      photos: Array.isArray(data.photos) ? strings(data.photos) : a.photos,
    },
    body,
  }
}

async function readOr(path, fallback) {
  try { return await readFile(path, 'utf8') } catch { return fallback }
}

export async function writeAtomic(path, content) {
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, content)
  await rename(tmp, path)
}

// Call ONLY after a fully successful fetch: writes changed files, then prunes this source's stale files
// whose date lies inside the fetched window (older history beyond the API page is never deleted).
export async function writeActivities(dir, activities, source) {
  await mkdir(dir, { recursive: true })
  const keep = new Set()
  let written = 0, unchanged = 0, removed = 0
  for (const a of activities) {
    if (a.source !== source) throw new Error(`activity source ${a.source} != ${source}`)
    const name = filenameFor(a)
    if (!SAFE_FILE.test(name)) throw new Error(`unsafe activity filename: ${JSON.stringify(name).slice(0, 80)}`)
    keep.add(name)
  }
  const days = [...keep].map((n) => n.slice(0, 10)).sort()
  for (const a of activities) {
    const path = join(dir, filenameFor(a))
    const existing = await readOr(path, null)
    const { fm, body } = mergeExisting(a, existing)
    const content = toFrontMatter(fm, body)
    if (existing === content) { unchanged++; continue }
    await writeAtomic(path, content)
    written++
  }
  const generated = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${source}-[A-Za-z0-9_-]+\\.md$`)
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || keep.has(entry.name) || !generated.test(entry.name)) continue
    const day = entry.name.slice(0, 10)
    if (!days.length || day < days[0] || day > days.at(-1)) continue
    // Ownership evidence: only delete files whose front matter still claims this source.
    if (!(await readOr(join(dir, entry.name), '')).includes(`\nsource: "${source}"\n`)) continue
    await unlink(join(dir, entry.name))
    removed++
  }
  return { written, removed, unchanged }
}

export async function getJson(fetchFn, url, options = {}) {
  const res = await fetchFn(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

export const isMain = (metaUrl) => Boolean(process.argv[1]) && fileURLToPath(metaUrl) === resolve(process.argv[1])
