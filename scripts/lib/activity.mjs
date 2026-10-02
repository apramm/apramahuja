// Shared activity model: provider record → SPEC front matter → idempotent, atomic files.
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const TIMEOUT_MS = 15_000
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

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

// Strava's start_date_local is local wall time with a fake "Z"; utc_offset (seconds) gives the real offset.
function stravaLocalDate(a) {
  const off = Number(a.utc_offset) || 0
  const sign = off < 0 ? '-' : '+'
  const abs = Math.abs(off)
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0')
  return `${String(a.start_date_local).slice(0, 19)}${sign}${hh}:${mm}`
}

const str = (v) => (typeof v === 'string' ? v : '')
const positive = (n) => (Number.isFinite(n) && n > 0 ? n : undefined)

function requireId(id) {
  const s = String(id ?? '')
  if (!SAFE_ID.test(s)) throw new Error(`unsafe or missing activity id: ${JSON.stringify(s).slice(0, 80)}`)
  return s
}

export function normalize(source, r) {
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
    const start = Date.parse(r.start_time)
    if (!Number.isFinite(start)) throw new Error(`Hevy workout ${id} has no valid start_time`)
    const secs = Math.max(0, Math.round((Date.parse(r.end_time) - start) / 1000)) || 0
    a = {
      title: str(r.title) || 'Workout',
      date: r.start_time,
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
  return { ...out, source, source_id: a.source_id, source_url: a.source_url, photos: [], example: false }
}

// JSON scalars/arrays are valid YAML, and JSON string escaping makes any title safe on one line.
export function toFrontMatter(obj, body = '') {
  const lines = Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
  return `---\n${lines.join('\n')}\n---\n${body}`
}

export const filenameFor = (a) => `${a.date.slice(0, 10)}-${a.source}-${a.source_id}.md`

async function readOr(path, fallback) {
  try { return await readFile(path, 'utf8') } catch { return fallback }
}

export async function writeAtomic(path, content) {
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, content)
  await rename(tmp, path)
}

// Call ONLY after a fully successful fetch: writes changed files, then prunes this source's stale files.
export async function writeActivities(dir, activities, source) {
  await mkdir(dir, { recursive: true })
  const keep = new Set()
  let written = 0, unchanged = 0, removed = 0
  for (const a of activities) {
    if (a.source !== source) throw new Error(`activity source ${a.source} != ${source}`)
    const name = filenameFor(a)
    keep.add(name)
    const path = join(dir, name)
    const content = toFrontMatter(a)
    if ((await readOr(path, null)) === content) { unchanged++; continue }
    await writeAtomic(path, content)
    written++
  }
  const generated = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${source}-[A-Za-z0-9_-]+\\.md$`)
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || keep.has(entry.name) || !generated.test(entry.name)) continue
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
