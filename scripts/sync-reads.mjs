// apramreads → data/reading.json. Public GitHub Pages site, no key. This site lists and links; it never mirrors posts.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getJson, writeAtomic, isMain, TIMEOUT_MS } from './lib/activity.mjs'

export const SITE = 'https://apramm.github.io/apramreads/'
const SKIP = new Set(['daily-reads']) // the daily log stays on apramreads only
const SAFE_SECTION = /^[\w-]+$/
const SAFE_FILE = /^[\w-]+\.md$/
const SUMMARY_MAX = 160
const BLOCK = /^(#|[-*+] |\d+\. |>|\|)/ // heading, list item, quote, table row
// ponytail: "key: value" = ≤3-word key, no sentence punctuation; matches apramreads' "started reading on: <date>" lines
const META = /^[\w-]+( [\w-]+){0,2}:\s/

const inline = (s) => s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '')

// Title and date rules mirror apramreads' own script.js (extractTitle / extractDate) so both sites agree.
export function parsePost(markdown, file) {
  const text = String(markdown).toWellFormed()
  const lines = text.split('\n')
  const h1 = lines.find((l) => l.startsWith('# '))
  const title = (h1 ? h1.slice(2) : String(file).replace(/\.md$/, '')).trim()
  const date = text.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? ''
  const para = []
  let fence = false
  for (const raw of lines) {
    const l = raw.trim()
    if (/^(```|~~~)/.test(l)) { if (para.length) break; fence = !fence; continue }
    if (fence) continue
    if (!l || BLOCK.test(l)) { if (para.length) break; continue }
    if (!para.length && META.test(l) && !/[.!?]$/.test(l)) continue
    para.push(inline(l))
  }
  let summary = para.join(' ').replace(/\s+/g, ' ').trim()
  if (summary.length > SUMMARY_MAX) summary = `${summary.slice(0, SUMMARY_MAX - 1).trimEnd()}…`
  return { title, date, summary: summary.toWellFormed() } // the cut can split a surrogate pair
}

const postUrl = (site, section, file) => `${site}post.html?${new URLSearchParams({ section, file })}`

// `previous` = the last written items: a post that could not be fetched this time keeps its old entry.
export function toReading({ manifest, posts, previous = [], site = SITE, fetchedAt }) {
  const items = []
  for (const [section, files] of Object.entries(manifest)) {
    if (SKIP.has(section) || !SAFE_SECTION.test(section)) continue
    for (const file of files) {
      if (!SAFE_FILE.test(file)) continue
      const url = postUrl(site, section, file)
      const md = posts[`${section}/${file}`]
      if (md == null) {
        const kept = previous.find((p) => p?.url === url)
        if (kept) items.push(kept)
        continue
      }
      const { title, date, summary } = parsePost(md, file)
      items.push({ section, title, date, summary, url })
    }
  }
  items.sort((a, b) => b.date.localeCompare(a.date)) // ISO strings; '' sorts last; stable → manifest order among ties
  return { fetched_at: fetchedAt, site, items, daily_reads: (manifest['daily-reads'] ?? []).length }
}

// Compare ignoring fetched_at so an unchanged blog → no git diff → no deploy.
const essence = (r) => JSON.stringify({ ...r, fetched_at: undefined })

function checkManifest(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || !Object.values(m).every(Array.isArray)) throw new Error('unexpected manifest shape')
  return m
}

export async function run({ fetch = globalThis.fetch, file = join(process.cwd(), 'data', 'reading.json'), site = SITE, log = console, now = () => new Date().toISOString() } = {}) {
  try {
    const manifest = checkManifest(await getJson(fetch, `${site}blog-manifest.json`))
    const old = await readFile(file, 'utf8').then(JSON.parse).catch(() => null)
    const previous = Array.isArray(old?.items) ? old.items : []
    const posts = {}
    let wanted = 0, failed = 0
    for (const [section, files] of Object.entries(manifest)) {
      if (SKIP.has(section)) continue
      for (const name of files) {
        const key = `${section}/${name}`
        if (!SAFE_SECTION.test(section) || !SAFE_FILE.test(String(name))) { log.warn(`::warning::reads: skipping unsafe name ${JSON.stringify(key)}`); continue }
        wanted++
        try {
          const res = await fetch(`${site}blog/${section}/${name}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          posts[key] = await res.text()
        } catch (err) {
          failed++
          const kept = previous.some((p) => p?.url === postUrl(site, section, name))
          log.warn(`::warning::reads: ${kept ? 'keeping previous entry for' : 'skipping'} ${key}: ${err.message}`)
        }
      }
    }
    if (wanted && failed === wanted) throw new Error(`all ${wanted} post fetches failed`) // an outage must not blank the list
    const reading = toReading({ manifest, posts, previous, site, fetchedAt: now() })
    if (old && essence(old) === essence(reading)) { log.log('reads: unchanged'); return 0 }
    await writeAtomic(file, `${JSON.stringify(reading, null, 2)}\n`)
    log.log(`reads: wrote ${reading.items.length} items (${reading.daily_reads} daily reads stay on apramreads)`)
    return 0
  } catch (err) {
    log.error(`::error::reads sync failed, existing data left untouched: ${err.message}`)
    return 1
  }
}

if (isMain(import.meta.url)) process.exitCode = await run()
