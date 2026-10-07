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
