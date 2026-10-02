// Strava → content/activities/*.md. Secrets come from env only; nothing secret is logged.
import { access, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { normalize, writeActivities, writeAtomic, getJson, isMain, TIMEOUT_MS } from './lib/activity.mjs'

const REQUIRED = ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_REFRESH_TOKEN']

// Exact CloudFront hosts Strava's photos API returned (photos, video posters). Not *.cloudfront.net:
// anyone can host there. A new host shows up as a "skipped photo" log line; add it here after checking.
const PHOTO_HOSTS = new Set(['dgtzuqphqg23d.cloudfront.net', 'd35tn3x5zm6xrc.cloudfront.net'])
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/webp': { ext: 'webp', magic: (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' },
}
const EXTS = Object.values(IMAGE_TYPES).map((t) => t.ext)
const exists = (path) => access(path).then(() => true, () => false)

export function photoUrlAllowed(raw) {
  try { const u = new URL(raw); return u.protocol === 'https:' && PHOTO_HOSTS.has(u.hostname) && !u.port && !u.username } catch { return false }
}

// Largest rendition from Strava's `urls: { "<px>": url }`.
const largestUrl = (urls) => Object.entries(urls ?? {}).sort(([a], [b]) => Number(b) - Number(a))[0]?.[1]

// Never follows redirects, never sends credentials, checks type + magic bytes, caps size while streaming.
async function download(fetch, url, base, photoDir) {
  if (!photoUrlAllowed(url)) throw new Error(`host not allowlisted: ${String(url).slice(0, 80)}`)
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const type = IMAGE_TYPES[(res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()]
  if (!type) throw new Error(`unexpected content-type ${res.headers.get('content-type')}`)
  if (Number(res.headers.get('content-length')) > MAX_PHOTO_BYTES) throw new Error('too large')
  const chunks = []
  let size = 0
  for await (const chunk of res.body) {
    size += chunk.byteLength
    if (size > MAX_PHOTO_BYTES) throw new Error('too large')
    chunks.push(chunk)
  }
  const bytes = Buffer.concat(chunks)
  if (!type.magic(bytes)) throw new Error('content does not match its content-type')
  const name = `${base}.${type.ext}`
  await writeAtomic(join(photoDir, name), bytes)
  return name
}

// ≤ 1 photos API call per activity; files already on disk are reused, never re-downloaded or deleted.
async function syncPhotos({ fetch, token, record, activity, photoDir, log }) {
  if (!(Number(record.total_photo_count) > 0)) return []
  const id = activity.source_id // validated digits by normalize()
  let list
  try {
    list = await getJson(fetch, `https://www.strava.com/api/v3/activities/${id}/photos?size=1024&photo_sources=true`, { headers: { authorization: `Bearer ${token}` } })
    if (!Array.isArray(list)) throw new Error('photos response was not a list')
  } catch (err) {
    log.warn(`::warning::strava: photos for ${id} skipped: ${err.message}`)
    return []
  }
  await mkdir(photoDir, { recursive: true })
  const out = []
  for (const [i, p] of list.entries()) {
    const base = `${id}-${i + 1}`
    try {
      let name
      for (const ext of EXTS) if (await exists(join(photoDir, `${base}.${ext}`))) { name = `${base}.${ext}`; break }
      name ??= await download(fetch, largestUrl(p?.urls), base, photoDir)
      const caption = typeof p?.caption === 'string' ? p.caption.toWellFormed().trim().slice(0, 300) : ''
      out.push({ src: `/images/activities/${name}`, alt: caption || `${activity.title}, photo ${i + 1}` })
    } catch (err) {
      log.warn(`::warning::strava: photo ${base} skipped: ${err.message}`)
    }
  }
  return out
}

export async function run({ env = process.env, fetch = globalThis.fetch, dir = join(process.cwd(), 'content', 'activities'), photoDir = join(process.cwd(), 'assets', 'images', 'activities'), log = console } = {}) {
  const missing = REQUIRED.filter((k) => !env[k])
  if (missing.length) { log.log(`strava: skipping, missing ${missing.join(', ')}`); return 0 }
  try {
    const token = await getJson(fetch, 'https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, refresh_token: env.STRAVA_REFRESH_TOKEN, grant_type: 'refresh_token' }),
    })
    if (!token.access_token) throw new Error('Strava token response had no access token')
    // Strava invalidates the old refresh token once it issues a new one, so this needs the owner's action.
    // Sync this run's data anyway, then exit 1 so the workflow fails and GitHub emails the owner.
    const rotated = Boolean(token.refresh_token) && token.refresh_token !== env.STRAVA_REFRESH_TOKEN
    const list = await getJson(fetch, 'https://www.strava.com/api/v3/athlete/activities?per_page=30', {
      headers: { authorization: `Bearer ${token.access_token}` },
    })
    if (!Array.isArray(list)) throw new Error('Strava activities response was not a list')
    // Allowlist: only activities the owner made visible to everyone (excludes followers_only, only_me, missing).
    const kept = list.filter((a) => a.visibility === 'everyone' && !a.private)
    const activities = []
    for (const record of kept) {
      const activity = normalize('strava', record)
      activity.photos = await syncPhotos({ fetch, token: token.access_token, record, activity, photoDir, log })
      activities.push(activity)
    }
    const r = await writeActivities(dir, activities, 'strava')
    log.log(`strava: ${activities.length} activities (${r.written} written, ${r.unchanged} unchanged, ${r.removed} removed)`)
    if (rotated) {
      log.error('::error::Strava rotated the refresh token; the STRAVA_REFRESH_TOKEN secret is now stale. Run `node scripts/strava-auth.mjs` locally and update the STRAVA_REFRESH_TOKEN repository secret.')
      return 1
    }
    return 0
  } catch (err) {
    log.error(`::error::strava sync failed, existing files left untouched: ${err.message}`)
    return 1
  }
}

if (isMain(import.meta.url)) process.exitCode = await run()
