// Hevy (Pro API) → content/activities/*.md as type gym.
// Shape per https://api.hevyapp.com/docs: { page, page_count, workouts: [{ id, title, start_time, end_time, ... }] }.
import { join } from 'node:path'
import { normalize, writeActivities, getJson, isMain, DEFAULT_TZ } from './lib/activity.mjs'

export async function run({ env = process.env, fetch = globalThis.fetch, dir = join(process.cwd(), 'content', 'activities'), log = console } = {}) {
  if (!env.HEVY_API_KEY) { log.log('hevy: skipping, missing HEVY_API_KEY'); return 0 }
  try {
    const body = await getJson(fetch, 'https://api.hevyapp.com/v1/workouts?page=1&pageSize=10', {
      headers: { 'api-key': env.HEVY_API_KEY, accept: 'application/json' },
    })
    if (!Array.isArray(body?.workouts)) throw new Error('Hevy response had no workouts list')
    const activities = body.workouts.map((w) => normalize('hevy', w, { tz: env.SITE_TZ || DEFAULT_TZ }))
    const r = await writeActivities(dir, activities, 'hevy')
    log.log(`hevy: ${activities.length} workouts (${r.written} written, ${r.unchanged} unchanged, ${r.removed} removed)`)
    return 0
  } catch (err) {
    log.error(`::error::hevy sync failed, existing files left untouched: ${err.message}`)
    return 1
  }
}

if (isMain(import.meta.url)) process.exitCode = await run()
