// Local, one-time helper to get a Strava refresh token. Never run in CI.
//   node scripts/strava-auth.mjs                 → prints the authorize URL
//   node scripts/strava-auth.mjs --code <code>   → prints ONLY the refresh token (paste into GitHub secret STRAVA_REFRESH_TOKEN)
import { readFileSync } from 'node:fs'
import { getJson } from './lib/activity.mjs'

// Tiny .env reader: KEY=VALUE lines, # comments, optional quotes. Real env wins.
try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
} catch {}

const { STRAVA_CLIENT_ID: id, STRAVA_CLIENT_SECRET: secret } = process.env
const i = process.argv.indexOf('--code')
const code = i > -1 ? process.argv[i + 1] : null

if (!id) { console.error('Set STRAVA_CLIENT_ID (in .env or the environment).'); process.exit(1) }

if (!code) {
  const params = new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: 'http://localhost', approval_prompt: 'force', scope: 'read,activity:read_all' })
  console.error('1. Open this URL and approve access.')
  console.error('2. The browser lands on http://localhost/?...&code=XXXX (the page will not load; that is fine).')
  console.error('3. Run: node scripts/strava-auth.mjs --code XXXX\n')
  console.log(`https://www.strava.com/oauth/authorize?${params}`)
  process.exit(0)
}

if (!secret) { console.error('Set STRAVA_CLIENT_SECRET (in .env or the environment).'); process.exit(1) }
try {
  const token = await getJson(globalThis.fetch, 'https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: secret, code, grant_type: 'authorization_code' }),
  })
  if (!token.refresh_token) throw new Error('no refresh_token in response')
  console.log(token.refresh_token)
} catch (err) {
  console.error(`Token exchange failed: ${err.message}`)
  process.exit(1)
}
