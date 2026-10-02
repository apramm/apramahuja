// Strava → content/activities/*.md. Secrets come from env only; nothing secret is logged.
import { join } from 'node:path'
import { normalize, writeActivities, getJson, isMain } from './lib/activity.mjs'

const REQUIRED = ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_REFRESH_TOKEN']

export async function run({ env = process.env, fetch = globalThis.fetch, dir = join(process.cwd(), 'content', 'activities'), log = console } = {}) {
  const missing = REQUIRED.filter((k) => !env[k])
  if (missing.length) { log.log(`strava: skipping, missing ${missing.join(', ')}`); return 0 }
  try {
    const token = await getJson(fetch, 'https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: env.STRAVA_CLIENT_ID, client_secret: env.STRAVA_CLIENT_SECRET, refresh_token: env.STRAVA_REFRESH_TOKEN, grant_type: 'refresh_token' }),
    })
    if (!token.access_token) throw new Error('Strava token response had no access token')
    if (token.refresh_token && token.refresh_token !== env.STRAVA_REFRESH_TOKEN) {
      log.warn('::warning::Strava rotated the refresh token. Run `node scripts/strava-auth.mjs` to get a fresh one and update the STRAVA_REFRESH_TOKEN repository secret, or future syncs may fail.')
    }
    const list = await getJson(fetch, 'https://www.strava.com/api/v3/athlete/activities?per_page=30', {
      headers: { authorization: `Bearer ${token.access_token}` },
    })
    if (!Array.isArray(list)) throw new Error('Strava activities response was not a list')
    const activities = list.filter((a) => !a.private && a.visibility !== 'only_me').map((a) => normalize('strava', a))
    const r = await writeActivities(dir, activities, 'strava')
    log.log(`strava: ${activities.length} activities (${r.written} written, ${r.unchanged} unchanged, ${r.removed} removed)`)
    return 0
  } catch (err) {
    log.error(`::error::strava sync failed, existing files left untouched: ${err.message}`)
    return 1
  }
}

if (isMain(import.meta.url)) process.exitCode = await run()
