import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parsePost, toReading, run, SITE } from './sync-reads.mjs'

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

test('toReading: skips daily-reads, sorts newest first with undated last, builds apramreads urls', () => {
  const r = toReading({
    manifest: { ...manifest, essays: ['no-date.md'] },
    posts: { ...posts, 'essays/no-date.md': '# Essay\n\nwords\n' },
    fetchedAt: '2026-10-06T00:00:00.000Z',
  })
  assert.equal(r.fetched_at, '2026-10-06T00:00:00.000Z')
  assert.equal(r.site, SITE)
  assert.deepEqual(Object.keys(r), ['fetched_at', 'site', 'items'])
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

// --- run(): network + file behaviour ---
function fetchFor(files, m = manifest) {
  const calls = []
  const fn = async (url, opts = {}) => {
    url = String(url)
    calls.push(url)
    assert.ok(opts.signal, 'every request needs a timeout signal')
    assert.equal(opts.redirect, 'error', 'no redirects')
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

test('run: a post that fails to fetch keeps its entry from the previous reading.json; a changed post rewrites the file', async () => {
  const file = join(await tmp(), 'reading.json')
  const { lines, logger } = capture()
  const ok = fetchFor(posts).fn
  assert.equal(await run({ fetch: ok, file, log: logger, now: () => '2026-10-06T00:00:00.000Z' }), 0)
  const first = await readFile(file, 'utf8')
  const algo = JSON.parse(first).items.find((i) => i.title === 'Algorithm Design')
  assert.ok(algo)

  const flaky = (url, opts) => (String(url).endsWith('/algorithm-design.md') ? resp('busy', 503) : ok(url, opts))
  assert.equal(await run({ fetch: flaky, file, log: logger, now: () => '2026-10-06T06:00:00.000Z' }), 0)
  const second = await readFile(file, 'utf8')
  const items = JSON.parse(second).items
  assert.equal(items.length, 2, 'the failed post keeps its previous entry')
  assert.deepEqual(items.find((i) => i.title === 'Algorithm Design'), algo)
  assert.equal(second, first, 'nothing really changed → no rewrite')
  assert.match(lines.join('\n'), /::warning::.*algorithm-design\.md/)

  const edited = { ...posts, 'books/meditations.md': MEDITATIONS.replace('This book is a journal', 'A fresh summary line') }
  assert.equal(await run({ fetch: fetchFor(edited).fn, file, log: logger, now: () => '2026-10-06T12:00:00.000Z' }), 0)
  const third = await readFile(file, 'utf8')
  assert.notEqual(third, first, 'a real upstream change rewrites the file')
  assert.match(third, /A fresh summary line of marcus aurelius/)
})

test('run: every post failing exits 1 and leaves the file untouched', async () => {
  const dir = await tmp()
  const file = join(dir, 'reading.json')
  assert.equal(await run({ fetch: fetchFor(posts).fn, file, log: capture().logger }), 0)
  const first = await readFile(file, 'utf8')
  const down = async (url) => (String(url) === `${SITE}blog-manifest.json` ? json(manifest) : resp('busy', 503))
  const { lines, logger } = capture()
  assert.equal(await run({ fetch: down, file, log: logger }), 1)
  assert.equal(await readFile(file, 'utf8'), first)
  assert.match(lines.join('\n'), /::error::/)

  const fresh = join(dir, 'fresh.json')
  assert.equal(await run({ fetch: down, file: fresh, log: capture().logger }), 1)
  await assert.rejects(readFile(fresh), 'no previous file and nothing fetched → nothing written')
})

test('parsePost: a summary cut inside an emoji is still well-formed and within 160', () => {
  const p = parsePost(`${'a'.repeat(158)}😀 tail words\n`, 'x.md')
  assert.ok(p.summary.isWellFormed(), JSON.stringify(p.summary))
  assert.ok(p.summary.length <= 160, `len ${p.summary.length}`)
})

test('parsePost: pathological input stays fast and bounded', () => {
  const md = `# ${'T'.repeat(5000)}\n\n${'!['.repeat(200000)}\n`
  const t0 = performance.now()
  const p = parsePost(md, 'x.md')
  const ms = performance.now() - t0
  assert.ok(ms < 1000, `took ${Math.round(ms)} ms`)
  assert.equal(p.title.length, 200)
  assert.ok(p.summary.length <= 160, `len ${p.summary.length}`)
  assert.ok(p.summary.isWellFormed())
})

test('parsePost: a title cut inside an emoji is still well-formed', () => {
  assert.ok(parsePost(`# ${'a'.repeat(199)}😀\n`, 'x.md').title.isWellFormed())
})

test('toReading: previous entries fill in for posts that were not fetched, but never for unsafe names', () => {
  const prev = (file, title, date = '2026-01-01') => ({ section: 'books', title, date, summary: 's', url: `${SITE}post.html?${new URLSearchParams({ section: 'books', file })}` })
  const r = toReading({
    manifest: { books: ['a.md', 'b.md', '../x.md'] },
    posts: { 'books/a.md': '# fresh a\n\n2026-05-01\n' },
    previous: [prev('a.md', 'old a'), prev('b.md', 'old b', null), prev('../x.md', 'evil')], // a hand-edited file may hold a non-string date
    fetchedAt: 'now',
  })
  assert.deepEqual(r.items.map((i) => i.title), ['fresh a', 'old b'])
})

test('run: an upstream error body cannot inject a workflow command', async () => {
  for (const [status, body] of [[500, 'oops\n::notice title=Deploy OK::all good'], [200, 'x\n::notice x']]) {
    const file = join(await tmp(), 'reading.json')
    const { lines, logger } = capture()
    assert.equal(await run({ fetch: async () => resp(body, status), file, log: logger }), 1, `status ${status}`)
    const out = lines.join('\n').split('\n')
    assert.ok(out.some((l) => l.startsWith('::error::')), 'the failure is still reported')
    assert.ok(!out.some((l) => l.startsWith('::notice')), JSON.stringify(out))
  }
})

test('run: a manifest with no usable posts leaves an existing file untouched and exits 1', async () => {
  const dir = await tmp()
  const file = join(dir, 'reading.json')
  assert.equal(await run({ fetch: fetchFor(posts).fn, file, log: capture().logger }), 0)
  const first = await readFile(file, 'utf8')
  const empty = { 'daily-reads': ['2026-02-08.md'] }
  const { lines, logger } = capture()
  assert.equal(await run({ fetch: fetchFor(posts, empty).fn, file, log: logger }), 1)
  assert.equal(await readFile(file, 'utf8'), first)
  assert.match(lines.join('\n'), /::error::.*blank/)

  const fresh = join(dir, 'fresh.json')
  assert.equal(await run({ fetch: fetchFor(posts, empty).fn, file: fresh, log: capture().logger }), 0)
  assert.deepEqual(JSON.parse(await readFile(fresh, 'utf8')).items, [], 'first run on an empty manifest still writes an empty list')
})
