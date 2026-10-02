// Last.fm → data/music.json. Read-only public API key; no album art downloaded.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getJson, writeAtomic, isMain } from './lib/activity.mjs'

const https = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : '')
const text = (v) => (typeof v === 'string' ? v : typeof v?.['#text'] === 'string' ? v['#text'] : typeof v?.name === 'string' ? v.name : '')
const list = (t) => (t == null ? [] : [].concat(t)) // Last.fm returns an object, not an array, for a single item

export function toMusic({ recent, top, user, fetchedAt }) {
  if (!recent?.recenttracks || !top?.toptracks) throw new Error('unexpected Last.fm response shape')
  return {
    fetched_at: fetchedAt,
    user,
    recent: list(recent.recenttracks.track).slice(0, 10).map((t) => ({
      track: text(t.name),
      artist: text(t.artist),
      album: text(t.album),
      url: https(t.url),
      played_at: t['@attr']?.nowplaying === 'true' || !t.date?.uts ? fetchedAt : new Date(Number(t.date.uts) * 1000).toISOString(),
    })),
    top_week: list(top.toptracks.track).slice(0, 5).map((t) => ({
      track: text(t.name),
      artist: text(t.artist),
      plays: Number(t.playcount) || 0,
      url: https(t.url),
    })),
  }
}

// Compare ignoring fetched_at (and now-playing timestamps, which equal it) so unchanged music → no git diff.
function essence(m) {
  return JSON.stringify({ ...m, fetched_at: undefined, recent: m.recent?.map((t) => (t.played_at === m.fetched_at ? { ...t, played_at: undefined } : t)) })
}

async function defaultUser() {
  const yaml = await readFile(join(process.cwd(), 'hugo.yaml'), 'utf8').catch(() => '')
  return yaml.match(/^\s*lastfm:\s*\n\s+user:\s*["']?([A-Za-z0-9_.-]+)/m)?.[1] || 'aprammusic'
}

export async function run({ env = process.env, fetch = globalThis.fetch, file = join(process.cwd(), 'data', 'music.json'), log = console, now = () => new Date().toISOString() } = {}) {
  if (!env.LASTFM_API_KEY) { log.log('lastfm: skipping, missing LASTFM_API_KEY'); return 0 }
  try {
    const user = env.LASTFM_USER || (await defaultUser())
    const call = (params) => getJson(fetch, `https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ ...params, user, api_key: env.LASTFM_API_KEY, format: 'json' })}`)
    const [recent, top] = await Promise.all([
      call({ method: 'user.getrecenttracks', limit: '10' }),
      call({ method: 'user.gettoptracks', period: '7day', limit: '5' }),
    ])
    for (const r of [recent, top]) if (r?.error) throw new Error(`Last.fm error ${r.error}: ${r.message}`)
    const music = toMusic({ recent, top, user, fetchedAt: now() })
    const old = await readFile(file, 'utf8').then(JSON.parse).catch(() => null)
    if (old && essence(old) === essence(music)) { log.log('lastfm: unchanged'); return 0 }
    await writeAtomic(file, `${JSON.stringify(music, null, 2)}\n`)
    log.log(`lastfm: wrote ${music.recent.length} recent, ${music.top_week.length} top tracks`)
    return 0
  } catch (err) {
    log.error(`::error::lastfm sync failed, existing data left untouched: ${err.message}`)
    return 1
  }
}

if (isMain(import.meta.url)) process.exitCode = await run()
