# Reading Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the books and non-daily posts from apramreads as a dated `reading` list on the apramahuja.com homepage, each row linking out to apramreads, refreshed by the existing 15-minute sync.

**Architecture:** A new `scripts/sync-reads.mjs` (same shape as `scripts/sync-lastfm.mjs`) fetches the public `blog-manifest.json` from `https://apramm.github.io/apramreads/`, fetches every Markdown post outside `daily-reads/`, extracts title / first ISO date / first paragraph, and writes `data/reading.json` only when content changed. `layouts/home.html` renders that JSON through the existing `entry-row.html` partial. The GitHub Action `sync.yml` gains one step. Nothing changes in the apramreads repo, nothing runs in the browser, no secret is needed.

**Tech Stack:** Hugo 0.165.0 extended (Go templates), Node 22 ESM scripts with stdlib only (`node:test`, `node:fs/promises`, global `fetch`), GitHub Actions, Vercel.

**Spec:** `docs/SPEC.md`, sections "Homepage" item 5 (`reading`), "Data sync" bullet "apramreads (`sync-reads.mjs`)", and "Acceptance" item 9. Read those three before starting any task.

## Global Constraints

- Hugo **0.165.0 extended** (`vercel.json`, `.github/workflows/ci.yml`); Node **22** in CI. Run tests on local Node and `npx node@22`.
- Scripts use stdlib + `fetch` only. No npm dependencies, no `package.json`.
- Shared helpers come from `scripts/lib/activity.mjs`: `getJson(fetchFn, url)`, `writeAtomic(path, content)`, `isMain(import.meta.url)`, `TIMEOUT_MS`. Do not re-implement them.
- Any API error → exit 1 **without touching the existing file** (write to temp, then rename). Missing/failed data never breaks the build.
- Idempotent: re-running with the same upstream data produces no git diff (`fetched_at` alone must not cause a write).
- Strings are made well-formed with `String.prototype.toWellFormed()`.
- Design: one 640px column, lowercase mono section labels, dated list rows via `layouts/partials/entry-row.html`, no cards, no new JS, no new CSS unless a row visibly breaks. The CSP in `vercel.json` is untouched (no inline script changes).
- Section label text is `reading`; footer link text is `more at apramreads →`; the arrow is the literal `→` already used by the other `.more` links.
- Nothing in `data/reading.json` or templates may reference `daily-reads` posts.
- `AGENTS.md` at the repo root is an untracked copy of `CLAUDE.md` the owner keeps for another tool. Do not edit, add or commit it.
- Commit messages end with: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- Branch: `reading-sync` (already created from `origin/main`; spec commit `3ecebbf` is on it). PR to `main`; the owner merges, Vercel deploys.

**Parallel execution note:** Tasks 1, 2 and 3 own disjoint files and may run in parallel in the same tree. If they do, the agents **skip their commit steps** and the lead commits each task's files as it lands (avoids `index.lock` races). Tasks 4 to 6 are lead-only and sequential.

---

## File map

| Path | Task | Responsibility |
|---|---|---|
| `scripts/sync-reads.mjs` (create) | 1 | Fetch manifest + posts, parse, write `data/reading.json` |
| `scripts/reads.test.mjs` (create) | 1 | `node:test` suite for parsing, shaping, and `run()` failure modes |
| `.github/workflows/sync.yml` (modify) | 1 | New `Sync apramreads` step; failure check includes it |
| `layouts/home.html` (modify) | 2 | `reading` section between `projects` and `recently outside` |
| `README.md`, `CLAUDE.md` (modify) | 3 | Document the new source, file, and how to feature a post |
| `data/reading.json` (create) | 4 | Real data from a local run of the script |
| `docs/superpowers/plans/2026-10-06-reading-sync.md` | — | this plan |

---

### Task 1: `scripts/sync-reads.mjs` + tests + workflow step

**Files:**
- Create: `scripts/sync-reads.mjs`
- Create: `scripts/reads.test.mjs`
- Modify: `.github/workflows/sync.yml` (steps list and the final `Fail if any provider failed` step)
- Read first: `scripts/sync-lastfm.mjs` (the pattern), `scripts/sync.test.mjs` (test style), `scripts/lib/activity.mjs` lines 185–233 (`writeAtomic`, `getJson`, `isMain`)

**Interfaces:**
- Consumes: `getJson`, `writeAtomic`, `isMain`, `TIMEOUT_MS` from `./lib/activity.mjs`.
- Produces (used by Task 2's template and Task 4's data commit):
  - `export const SITE = 'https://apramm.github.io/apramreads/'`
  - `export function parsePost(markdown: string, file: string): { title: string, date: string, summary: string }`
  - `export function toReading({ manifest, posts, site?, fetchedAt }): { fetched_at, site, items: Array<{ section, title, date, summary, url }>, daily_reads: number }`
    where `manifest` is `{ [section]: string[] }` and `posts` is `{ [`${section}/${file}`]: markdown }`.
  - `export async function run({ fetch?, file?, site?, log?, now? }): Promise<0|1>`
  - File written: `data/reading.json`, pretty-printed with 2 spaces and a trailing newline, `items` newest first, undated last.

- [ ] **Step 1: Write the failing parsing and shaping tests**

Create `scripts/reads.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parsePost, toReading, SITE } from './sync-reads.mjs' // `run` is added to this line in step 5

const tmp = () => mkdtemp(join(tmpdir(), 'reads-'))
const resp = (body, status = 200, type = 'text/plain') => new Response(body, { status, headers: { 'content-type': type } })
const json = (body, status = 200) => resp(JSON.stringify(body), status, 'application/json')
function capture() {
  const lines = []
  const log = (...a) => lines.push(a.join(' '))
  return { lines, logger: { log, warn: log, error: log } }
}

const MEDITATIONS = `# Meditations by Marcus Aurelius

started reading on: 2026-09-15

This book is a journal of marcus aurelius reflecting on stoic philosophy in his life

## Key Takeaways
still reading ...
`
const manifest = { books: ['meditations.md', 'algorithm-design.md'], 'daily-reads': ['2026-02-08.md', '2026-02-09.md'] }
const posts = {
  'books/meditations.md': MEDITATIONS,
  'books/algorithm-design.md': '# Algorithm Design\n\nstarted reading on: 2026-02-21\n\nThis book is about algorithms\n',
}

test('parsePost: title from the H1, date = first ISO date, summary = first prose paragraph', () => {
  assert.deepEqual(parsePost(MEDITATIONS, 'meditations.md'), {
    title: 'Meditations by Marcus Aurelius',
    date: '2026-09-15',
    summary: 'This book is a journal of marcus aurelius reflecting on stoic philosophy in his life',
  })
})

test('parsePost: file name without .md when there is no H1; empty date when none', () => {
  assert.deepEqual(parsePost('just words\n', 'no-title.md'), { title: 'no-title', date: '', summary: 'just words' })
})

test('parsePost: skips lists, fences, quotes and tables before the paragraph; joins its lines; strips inline markdown; caps at 160', () => {
  const long = 'word '.repeat(60).trim()
  const md = ['- a list first', '```js', 'code()', '```', '> quote', '| a | b |', `A [link](https://x.y) with *emphasis* and ![img](i.png). ${long}`, 'second line of the same paragraph', '', 'next paragraph'].join('\n')
  const p = parsePost(md, 'x.md')
  assert.ok(p.summary.startsWith('A link with emphasis and . word'), p.summary)
  assert.ok(p.summary.length <= 160, `len ${p.summary.length}`)
  assert.ok(p.summary.endsWith('…'))
  assert.ok(!p.summary.includes('next paragraph'))
})

test('parsePost: "key: value" lines before the paragraph are metadata; a sentence containing a colon is prose', () => {
  const md = '# T\n\ndate: 2026-01-01\nstatus: reading\n\nThis book covers two things: x and y.\n'
  assert.equal(parsePost(md, 't.md').summary, 'This book covers two things: x and y.')
})

test('toReading: skips daily-reads, sorts newest first with undated last, builds apramreads urls, counts daily reads', () => {
  const r = toReading({
    manifest: { ...manifest, essays: ['no-date.md'] },
    posts: { ...posts, 'essays/no-date.md': '# Essay\n\nwords\n' },
    fetchedAt: '2026-10-06T00:00:00.000Z',
  })
  assert.equal(r.fetched_at, '2026-10-06T00:00:00.000Z')
  assert.equal(r.site, SITE)
  assert.equal(r.daily_reads, 2)
  assert.deepEqual(r.items.map((i) => [i.section, i.title, i.date]), [
    ['books', 'Meditations by Marcus Aurelius', '2026-09-15'],
    ['books', 'Algorithm Design', '2026-02-21'],
    ['essays', 'Essay', ''],
  ])
  assert.equal(r.items[0].url, 'https://apramm.github.io/apramreads/post.html?section=books&file=meditations.md')
  assert.equal(r.items[0].summary, 'This book is a journal of marcus aurelius reflecting on stoic philosophy in his life')
  assert.deepEqual(Object.keys(r.items[0]), ['section', 'title', 'date', 'summary', 'url'])
})

test('toReading: posts missing from the fetched set are left out; lone surrogates are replaced', () => {
  const r = toReading({ manifest: { books: ['a.md', 'b.md'] }, posts: { 'books/a.md': '# a\ud800\n' }, fetchedAt: 'now' })
  assert.deepEqual(r.items.map((i) => i.title), ['a�'])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/reads.test.mjs`
Expected: FAIL at import time with `Cannot find module '.../scripts/sync-reads.mjs'`.

- [ ] **Step 3: Write the parsing and shaping code**

Create `scripts/sync-reads.mjs`:

```js
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
  return { title, date, summary }
}

export function toReading({ manifest, posts, site = SITE, fetchedAt }) {
  const items = []
  for (const [section, files] of Object.entries(manifest)) {
    if (SKIP.has(section) || !SAFE_SECTION.test(section)) continue
    for (const file of files) {
      const md = posts[`${section}/${file}`]
      if (md == null) continue
      const { title, date, summary } = parsePost(md, file)
      items.push({ section, title, date, summary, url: `${site}post.html?${new URLSearchParams({ section, file })}` })
    }
  }
  items.sort((a, b) => b.date.localeCompare(a.date)) // ISO strings; '' sorts last; stable → manifest order among ties
  return { fetched_at: fetchedAt, site, items, daily_reads: (manifest['daily-reads'] ?? []).length }
}
```

- [ ] **Step 4: Run the tests to verify parsing and shaping pass**

Run: `node --test scripts/reads.test.mjs`
Expected: the six tests above PASS.

- [ ] **Step 5: Add the failing `run()` tests**

Change the import line at the top of `scripts/reads.test.mjs` to
`import { parsePost, toReading, run, SITE } from './sync-reads.mjs'`, then append:

```js
// --- run(): network + file behaviour ---
function fetchFor(files, m = manifest) {
  const calls = []
  const fn = async (url, opts = {}) => {
    url = String(url)
    calls.push(url)
    assert.ok(opts.signal, 'every request needs a timeout signal')
    if (url === `${SITE}blog-manifest.json`) return json(m)
    const rel = url.slice(`${SITE}blog/`.length)
    return rel in files ? resp(files[rel]) : resp('nope', 404)
  }
  return { fn, calls }
}

test('run: writes reading.json, never fetches daily reads, unchanged content → no rewrite, failure keeps the file', async () => {
  const file = join(await tmp(), 'reading.json')
  const { lines, logger } = capture()
  const f = fetchFor(posts)
  assert.equal(await run({ fetch: f.fn, file, log: logger, now: () => '2026-10-06T00:00:00.000Z' }), 0)
  assert.ok(!f.calls.some((u) => u.includes('daily-reads')), 'daily reads are never fetched')
  const first = await readFile(file, 'utf8')
  assert.ok(first.endsWith('}\n'), 'pretty JSON with trailing newline')
  const data = JSON.parse(first)
  assert.equal(data.items.length, 2)
  assert.equal(data.items[0].title, 'Meditations by Marcus Aurelius')
  assert.equal(data.daily_reads, 2)

  assert.equal(await run({ fetch: fetchFor(posts).fn, file, log: logger, now: () => '2026-10-06T06:00:00.000Z' }), 0)
  assert.equal(await readFile(file, 'utf8'), first, 'only fetched_at differs → no diff')
  assert.match(lines.join('\n'), /unchanged/)

  assert.equal(await run({ fetch: async () => resp('gone', 500), file, log: logger }), 1)
  assert.equal(await readFile(file, 'utf8'), first)
  assert.match(lines.join('\n'), /::error::/)
})

test('run: malformed manifest exits 1 without writing', async () => {
  const file = join(await tmp(), 'reading.json')
  for (const bad of [[], 'x', { books: 'meditations.md' }, null, 42]) {
    assert.equal(await run({ fetch: async () => json(bad), file, log: capture().logger }), 1, JSON.stringify(bad))
    await assert.rejects(readFile(file))
  }
})

test('run: one unreadable or unsafe post is a ::warning::, the rest are still written, unsafe names are never fetched', async () => {
  const file = join(await tmp(), 'reading.json')
  const { lines, logger } = capture()
  const m = { books: ['meditations.md', 'missing.md', '../etc/passwd.md', 'bad name.md'], 'weird/sec': ['x.md'] }
  const f = fetchFor(posts, m)
  assert.equal(await run({ fetch: f.fn, file, log: logger }), 0)
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).items.map((i) => i.title), ['Meditations by Marcus Aurelius'])
  assert.ok(!f.calls.some((u) => u.includes('..') || u.includes('weird') || u.includes('bad name')), 'unsafe names are never fetched')
  const out = lines.join('\n')
  assert.match(out, /::warning::.*missing\.md/)
  assert.match(out, /::warning::.*passwd/)
})
```

- [ ] **Step 6: Run the tests to verify the new ones fail**

Run: `node --test scripts/reads.test.mjs`
Expected: `SyntaxError: The requested module './sync-reads.mjs' does not provide an export named 'run'` (the whole file fails to load until step 7).

- [ ] **Step 7: Implement `run()`**

Append to `scripts/sync-reads.mjs`:

```js
// Compare ignoring fetched_at so an unchanged blog → no git diff → no deploy.
const essence = (r) => JSON.stringify({ ...r, fetched_at: undefined })

function checkManifest(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || !Object.values(m).every(Array.isArray)) throw new Error('unexpected manifest shape')
  return m
}

export async function run({ fetch = globalThis.fetch, file = join(process.cwd(), 'data', 'reading.json'), site = SITE, log = console, now = () => new Date().toISOString() } = {}) {
  try {
    const manifest = checkManifest(await getJson(fetch, `${site}blog-manifest.json`))
    const posts = {}
    for (const [section, files] of Object.entries(manifest)) {
      if (SKIP.has(section)) continue
      for (const name of files) {
        const key = `${section}/${name}`
        if (!SAFE_SECTION.test(section) || !SAFE_FILE.test(String(name))) { log.warn(`::warning::reads: skipping unsafe name ${JSON.stringify(key)}`); continue }
        try {
          const res = await fetch(`${site}blog/${section}/${name}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          posts[key] = await res.text()
        } catch (err) {
          log.warn(`::warning::reads: skipping ${key}: ${err.message}`)
        }
      }
    }
    const reading = toReading({ manifest, posts, site, fetchedAt: now() })
    const old = await readFile(file, 'utf8').then(JSON.parse).catch(() => null)
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
```

- [ ] **Step 8: Run the whole suite on local Node and on Node 22**

Run: `node --test 'scripts/*.test.mjs'` then `npx node@22 --test 'scripts/*.test.mjs'`
Expected: all tests PASS in both (the existing Strava/Hevy/Last.fm tests included). If `npx node@22` prompts to install, accept.

- [ ] **Step 9: Run the script for real once, without writing into the repo, to see the live parse**

Run: `D=$(mktemp -d) && node -e "import('./scripts/sync-reads.mjs').then(m => m.run({ file: process.argv[1] })).then(() => console.log(require('fs').readFileSync(process.argv[1],'utf8')))" "$D/reading.json"; rm -rf "$D"`
Expected: exit 0, three `books` items (`Meditations by Marcus Aurelius` 2026-09-15, `Algorithm Design by Jon Kleinberg and Eva Tardos 2005` 2026-02-21, `Introduction to Compiler Construction` 2026-02-08), `daily_reads: 14`. Each `summary` is the one-sentence description from the post. If the live site has grown, check the shape, not the exact list. Nothing is written inside the repo.

- [ ] **Step 10: Add the workflow step**

In `.github/workflows/sync.yml`, insert after the `Sync Last.fm` step (before `Commit changes`):

```yaml
      - name: Sync apramreads
        id: reads
        continue-on-error: true
        run: node scripts/sync-reads.mjs
```

Change the commit message line `git commit -m "data: sync activities and music"` to `git commit -m "data: sync activities, music and reading"`.

Replace the last step with:

```yaml
      - name: Fail if any provider failed
        if: steps.strava.outcome == 'failure' || steps.hevy.outcome == 'failure' || steps.lastfm.outcome == 'failure' || steps.reads.outcome == 'failure'
        run: |
          echo "::error::Provider sync failed (strava=${{ steps.strava.outcome }}, hevy=${{ steps.hevy.outcome }}, lastfm=${{ steps.lastfm.outcome }}, reads=${{ steps.reads.outcome }}). See the step logs above."
          exit 1
```

The `Commit changes` step already stages `data`, so `data/reading.json` is committed with no further change. Do not add any `env:` to the new step: it needs no secret.

- [ ] **Step 11: Validate the workflow YAML parses**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/sync.yml','utf8'); if(!/id: reads/.test(y)||!/steps\.reads\.outcome == 'failure'/.test(y)) {console.error('missing');process.exit(1)}; console.log('ok')"` and `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/sync.yml')); print('yaml ok')"` (if PyYAML is missing, `ruby -ryaml -e "YAML.load_file('.github/workflows/sync.yml'); puts 'yaml ok'"`).
Expected: `ok` and `yaml ok`.

- [ ] **Step 12: Commit**

```bash
git add scripts/sync-reads.mjs scripts/reads.test.mjs .github/workflows/sync.yml
git commit -m "sync: list apramreads books and posts in data/reading.json

Fetches the public manifest and every post outside daily-reads, parses
title / first date / first paragraph the way apramreads' script.js does,
and writes only when content changed. No key; failures keep the old file.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Homepage `reading` section

**Files:**
- Modify: `layouts/home.html` (insert between the `projects` section's closing `{{ end }}` and the `recently outside` block that begins `{{ with first 4 (where site.RegularPages "Section" "activities").ByDate.Reverse }}`)
- Read first: `layouts/partials/entry-row.html` (the row contract), `layouts/partials/now-list.html` (how `hugo.Data.music` is read), `docs/SPEC.md` Homepage item 5

**Interfaces:**
- Consumes: `data/reading.json` with the shape produced by Task 1: `{ fetched_at, site, items: [{ section, title, date, summary, url }], daily_reads }`. In Hugo it is `hugo.Data.reading`.
- Consumes: `partial "entry-row.html"` with `(dict "title" t "href" u "sub" s "date" d)`; all keys except `title` optional; `sub` renders as a muted second line, `date` as the mono right column.
- Produces: `<section aria-labelledby="reading">` on `/`.

- [ ] **Step 1: Create a fixture so the build has data to render**

Create `data/reading.json` (temporary; Task 4 overwrites it with real data, and Task 2 does **not** commit it):

```json
{
  "fetched_at": "2026-10-06T00:00:00.000Z",
  "site": "https://apramm.github.io/apramreads/",
  "items": [
    { "section": "books", "title": "Meditations by Marcus Aurelius", "date": "2026-09-15", "summary": "This book is a journal of marcus aurelius reflecting on stoic philosophy in his life", "url": "https://apramm.github.io/apramreads/post.html?section=books&file=meditations.md" },
    { "section": "books", "title": "Algorithm Design by Jon Kleinberg and Eva Tardos 2005", "date": "2026-02-21", "summary": "This book is about algorithms", "url": "https://apramm.github.io/apramreads/post.html?section=books&file=algorithm-design.md" },
    { "section": "books", "title": "Introduction to Compiler Construction", "date": "2026-02-08", "summary": "This book is interesting to understanding how logic/program works between different source and target languages in a compiler", "url": "https://apramm.github.io/apramreads/post.html?section=books&file=intro-to-compiler.md" },
    { "section": "essays", "title": "An undated essay", "date": "", "summary": "", "url": "https://apramm.github.io/apramreads/post.html?section=essays&file=undated.md" },
    { "section": "essays", "title": "A fifth item that must not render", "date": "", "summary": "", "url": "https://apramm.github.io/apramreads/post.html?section=essays&file=fifth.md" }
  ],
  "daily_reads": 14
}
```

- [ ] **Step 2: Build and confirm the section is absent (the failing state)**

Run: `OUT=$(mktemp -d) && hugo --minify --quiet -d "$OUT" && grep -c 'aria-labelledby=reading' "$OUT/index.html"; rm -rf "$OUT"`
Expected: build succeeds and `grep -c` prints `0` (exit code 1 from grep is fine).

- [ ] **Step 3: Add the section to `layouts/home.html`**

Insert this block directly after the `projects` section (after its `{{ end }}`) and before the `recently outside` block:

```html
{{ $reading := hugo.Data.reading | default dict }}
{{ with $reading.items }}
<section aria-labelledby="reading">
  {{ partial "section-label.html" (dict "id" "reading" "text" "reading") }}
  <ul class="rows">{{ range first 4 . }}<li>{{ partial "entry-row.html" (dict "title" .title "href" .url "sub" .summary "date" .date) }}</li>{{ end }}</ul>
  <p class="more"><a href="{{ $reading.site }}">more at apramreads →</a></p>
</section>
{{ end }}
```

Notes for the implementer: `hugo.Data.reading` is `nil` when `data/reading.json` is missing, so `default dict` plus `with ... .items` hides the whole section. `entry-row.html` skips `sub` and `date` when they are empty strings, so undated items render with just a title. Hugo's template escaping turns `&` in the href into `&amp;`, which is correct HTML.

- [ ] **Step 4: Build and verify the rendered HTML**

Run:
```bash
OUT=$(mktemp -d) && hugo --minify --quiet -d "$OUT" && H="$OUT/index.html" \
&& grep -c 'aria-labelledby=reading' "$H" \
&& grep -o 'post.html?section=books&amp;file=[a-z-]*\.md' "$H" | sort -u \
&& grep -c 'An undated essay' "$H" \
&& grep -c 'A fifth item that must not render' "$H"; \
grep -o 'aria-labelledby=[a-z]*' "$H" | tr '\n' ' '; echo; \
grep -o '<a href=https://apramm.github.io/apramreads/>more at apramreads →</a>' "$H"; rm -rf "$OUT"
```
Expected, in order: `1`; the three book URLs; `1`; `0` (grep exits 1 here, that is the point); section order `now experience projects reading outside education` (minified attribute values have no quotes); the `more at apramreads →` anchor printed once.

- [ ] **Step 5: Verify the file-missing case**

Run: `K=$(mktemp -d) && mv data/reading.json "$K/" && OUT=$(mktemp -d) && hugo --minify -d "$OUT" 2>&1 | tail -2; grep -c 'aria-labelledby=reading' "$OUT/index.html"; rm -rf "$OUT"; mv "$K/reading.json" data/reading.json && rmdir "$K"`
Expected: build output shows no WARN/ERROR lines and `0`.

- [ ] **Step 6: Visual check at phone and desktop width**

Run `hugo server -p 1313 --disableLiveReload` in the background. Open `http://localhost:1313/` in a browser at 1280px and at 390px (headless Chrome refuses windows under 500px, so for the phone view make a wrapper HTML page with `<iframe src="http://localhost:1313/" width="390" height="900">`), in light and dark (click the footer `theme:` toggle). Check: the `reading` label sits between `projects` and `recently outside`; each row shows title, muted summary on the second line, date on the right; on 390px the date drops under the title like the project rows; no horizontal scroll. Save screenshots next to the plan's scratch output (not in the repo). Stop the server.

- [ ] **Step 7: Commit the template only**

```bash
git add layouts/home.html
git commit -m "home: reading section from data/reading.json, links out to apramreads

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

`data/reading.json` stays uncommitted here; Task 4 replaces it with real data and commits it.

---

### Task 3: Docs

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Do not touch: `AGENTS.md` (untracked copy the owner keeps)

**Interfaces:**
- Consumes: names from Task 1 (`scripts/sync-reads.mjs`, `data/reading.json`, section `reading`, link `more at apramreads →`).

- [ ] **Step 1: README, "What updates on its own" table**

After the row `| Gym workouts | Hevy (optional, needs \`HEVY_API_KEY\`) | every 15 min |` add:

```markdown
| **reading** list | [apramreads](https://apramm.github.io/apramreads/): books and every section except the daily reads (no key) | every 15 min |
```

In the paragraph below the table change `runs the three scripts in \`scripts/\`` to `runs the four scripts in \`scripts/\`` and `(\`content/activities/\`, \`assets/images/activities/\`, \`data/music.json\`)` to `(\`content/activities/\`, \`assets/images/activities/\`, \`data/music.json\`, \`data/reading.json\`)`.

- [ ] **Step 2: README, "Homepage now and music" section**

Rename the heading to `## Homepage "now", music and reading` and add a bullet after the **listening** one:

```markdown
- **reading:** read from `data/reading.json`, which the apramreads sync writes from the public
  blog manifest. Every apramreads section except `daily-reads` is listed (newest four on the
  homepage, each linking to the post on apramreads). To feature a new kind of post, add a folder
  under `blog/` in the apramreads repo; nothing changes here. Delete the file to hide the section.
```

- [ ] **Step 3: README, "Data sync" section**

Rename the heading to `## Data sync (Strava, Hevy, Last.fm, apramreads)` and replace the diagram with:

```
Strava ────┐
Hevy  ─────┼─ scripts/sync-*.mjs ──> content/activities/*.md, data/music.json, data/reading.json ──> commit ──> Vercel build
Last.fm ───┤   GitHub Action .github/workflows/sync.yml, every 15 min + manual "Run workflow"
apramreads ┘
```

After the paragraph that starts `Visitors never contact these APIs.` add:

```markdown
apramreads needs no key: the script reads the public `blog-manifest.json` and the Markdown posts
from <https://apramm.github.io/apramreads/>, takes each post's `# title`, first `YYYY-MM-DD` and
first paragraph, and writes `data/reading.json`. Daily reads are skipped on purpose; they stay on
apramreads. If a post cannot be fetched it is skipped with a warning and the rest are written.
```

Change `To run a sync locally, put the keys in \`.env\` (it's gitignored) and run
\`node --env-file=.env scripts/sync-strava.mjs\`.` to end with: `... \`node --env-file=.env scripts/sync-strava.mjs\`. The apramreads sync needs no keys: \`node scripts/sync-reads.mjs\`.`

- [ ] **Step 4: README, "Layout of the repo"**

Change `data/         music.json (written by the sync)` to `data/         music.json, reading.json (written by the syncs)`.

- [ ] **Step 5: CLAUDE.md**

In **Commands**, change the comment on the sync line to `# also sync-lastfm.mjs, sync-hevy.mjs; sync-reads.mjs needs no .env`.

In **Map**, change the `data/` line to `data/         music.json (Last.fm sync), reading.json (apramreads sync: books + non-daily posts, links out)` and the `scripts/` line to start `scripts/      sync-strava|lastfm|hevy|reads.mjs, ...` (keep the rest of that line).

In **Data flow**, change the first sentence to: `Strava, Hevy, Last.fm and apramreads (public, no key) → \`scripts/sync-*.mjs\` (in the GitHub Action every 15 min) → commit to \`main\` → Vercel deploy.`

Add to **Gotchas**:

```markdown
- apramreads posts have no front matter. `sync-reads.mjs` parses `# title`, the first ISO date
  and the first paragraph the same way apramreads' `script.js` does; keep the two in step if that
  format changes. Daily reads (`blog/daily-reads/`) are skipped by name.
```

- [ ] **Step 6: Check every path named in the docs exists or is created by this plan**

Run: `grep -o 'scripts/sync-[a-z]*\.mjs\|data/[a-z]*\.json' README.md CLAUDE.md | sort -u`
Expected: every printed path is one of `scripts/sync-strava.mjs`, `scripts/sync-lastfm.mjs`, `scripts/sync-hevy.mjs`, `scripts/sync-reads.mjs`, `data/music.json`, `data/reading.json`, and both `scripts/sync-reads.mjs` and `data/reading.json` appear. The `sync-strava|lastfm|hevy|reads.mjs` shorthand in the Map is not matched by the grep and is fine.

- [ ] **Step 7: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: apramreads reading sync

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4 (lead): real data, full verification

**Files:**
- Create/replace: `data/reading.json` (from a live run)

- [ ] **Step 1: Generate the real file**

Run: `rm -f data/reading.json && node scripts/sync-reads.mjs && cat data/reading.json`
Expected: exit 0, log `reads: wrote 3 items (14 daily reads stay on apramreads)` (counts may be higher if the blog grew), three book items newest first, every `url` starting `https://apramm.github.io/apramreads/post.html?section=books&file=`.

- [ ] **Step 2: Idempotency against the live site**

Run: `node scripts/sync-reads.mjs && git status --short data/`
Expected: log `reads: unchanged`; `git status` shows `?? data/reading.json` only once (no second change).

- [ ] **Step 3: Full test + build**

Run: `node --test 'scripts/*.test.mjs' && npx node@22 --test 'scripts/*.test.mjs' && hugo --minify --gc 2>&1 | tail -3`
Expected: all tests pass on both Node versions; Hugo prints its summary with no WARN/ERROR.

- [ ] **Step 4: Rendered output check with real data**

Run: `grep -o 'aria-labelledby=[a-z]*' public/index.html | tr '\n' ' '; echo; grep -o 'post.html?section=books&amp;file=[a-z-]*\.md' public/index.html | sort -u; grep -rl 'daily-reads' public/ || echo 'no daily-reads anywhere in public/'`
Expected: `now experience projects reading outside education`; three book URLs; `no daily-reads anywhere in public/`.

- [ ] **Step 5: Commit the data**

```bash
git add data/reading.json
git commit -m "data: reading list from apramreads

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5 (lead): review pass

- [ ] **Step 1: Dispatch two read-only reviewers in parallel** on the diff `git diff origin/main...reading-sync`:
  - `agent-skills:code-reviewer`: correctness of `parsePost` edge cases (fence inside paragraph, CRLF files, H1 after other headings), idempotency, template nil-safety, test quality.
  - `agent-skills:security-auditor`: the new step runs with no secrets and `permissions` unchanged; fetched Markdown is only ever JSON-encoded and HTML-escaped by Hugo; path pieces are allowlisted before any URL is built; no redirects or content types matter since nothing is executed or saved as a file other than the JSON.
  Skip the performance auditor: no new JS, CSS or images.

- [ ] **Step 2: Apply confirmed findings** with the TDD loop from Task 1 (failing test first), re-run `node --test 'scripts/*.test.mjs'` and `hugo --minify`, commit each fix separately.

---

### Task 6 (lead): PR

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin reading-sync
```

`gh` is not installed; use the GitHub MCP tool `mcp__github__create_pull_request` with `owner: apramm`, `repo: apramahuja`, `head: reading-sync`, `base: main`, title `Reading list synced from apramreads`, and a body that summarises: what shows on the homepage, the new script and workflow step, that daily reads stay on apramreads, how to feature a new post type (new folder in apramreads), the verification done (tests on Node local + 22, clean build, screenshots), and ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 2: Report to the owner**: PR link, Vercel preview URL once the deployment comment appears, and the one manual step after merge: none (the sync step needs no secret; the first scheduled run after merge commits `data/reading.json` changes as the blog changes).
