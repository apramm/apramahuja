# apramahuja.com — spec

Status: approved direction (2026-10-01). This file overrides the visual direction in `CLAUDE.md`
where they disagree (single column instead of hero photo + multi-column grid). Everything else in
`CLAUDE.md` still applies.

## Goal

A quiet, single-column personal site in the style of minimal researcher homepages
(akshatkalra.com, danluu.com, thume.ca). Text does the design work. Updating the site means
editing Markdown and pushing.

## Non-goals

No CMS, no frontend framework, no cards/grids on the homepage, no analytics dashboard, no hero
image, no client-side calls to Strava / Last.fm / Hevy / apramreads.

## Stack & hosting

- Hugo **0.165.0 extended**, pinned identically in `vercel.json` and GitHub Actions.
- No Hugo theme dependency: own `layouts/` + one stylesheet.
- Hosted on **Vercel** (existing apramahuja.com domain). Vercel builds on push to `main`.
- `baseURL: https://apramahuja.com/`.
- Node 20+ only for `scripts/` (sync + model generation). No runtime npm deps; scripts use
  stdlib + `fetch`.
- Next.js app is removed. `public/` is build output and is not tracked.

## Visual system

- Layout: one centered column, `max-width: 640px`, side gutter ≥ 16px (`1.25rem` on phones,
  `2rem` desktop), safe-area aware. No horizontal scroll at 320px.
- Type: **Newsreader** (text, headings) + **Geist Mono** (dates, labels, stats, link row).
  Self-hosted woff2 in `static/fonts/`, `font-display: swap`, with system fallbacks.
  Base 17px / 1.55. Section labels are small lowercase mono in `--muted`.
- Color: tokens only, 5 per theme.

  | token | light | dark |
  |---|---|---|
  | `--bg` | `#FBFBF9` | `#121413` |
  | `--fg` | `#151816` | `#E6E8E3` |
  | `--muted` | `#5F6661` | `#9AA29C` |
  | `--rule` | `#E2E4DE` | `#2A2F2C` |
  | `--accent` | `#2F6B7A` | `#7DB6C4` |

  All text pairs meet WCAG AA (4.5:1) on `--bg`.
- **Light + dark**: light by default, regardless of the OS setting. A small text toggle
  (`light / dark`) in the footer sets `data-theme` on `<html>` and stores it in
  `localStorage` (wrapped in try/catch). A ≤ 1 KB inline script in `<head>` applies the stored
  choice before first paint. Token blocks: `:root` (light), `:root[data-theme=dark]`.
  Changing the script means updating its `sha256` in the CSP in `vercel.json`.
- Links: `--accent`, underline on hover/focus. Entry titles: `--fg` with a faint underline
  (`--rule`). Visible `:focus-visible` outline in `--accent`.
- Motion: none except the 3-bar "listening" indicator, which is disabled
  under `prefers-reduced-motion: reduce`.

## Pages

| URL | Source | Content |
|---|---|---|
| `/` | `content/_index.md`, `content/now.md`, collections, `data/music.json` | see Homepage |
| `/projects/` | `content/projects/*.md` | all projects, dated list, newest first; featured first |
| `/projects/<slug>/` | one file | title, one-line description, outcome, tags, links, body |
| `/experience/` | `content/experience/*.md` | full list incl. highlights + education |
| `/activities/` | `content/activities/*.md` | dated feed grouped by year, filter-free |
| `/activities/<slug>/` | one file | stats table, notes, photos, external link |
| `/photos/` | `content/photos/*.md` | grouped by year, 2-col (phone) / 3-col grid, lazy, Hugo-resized |
| `/interests/` | `content/interests/*.md` | short list; each links to related content via tags |
| `/now/` | `content/now.md` | same list as homepage + "updated <date>" |
| `/404.html` | layout | one line + link home |

## Homepage (top to bottom)

1. **Header**: name (Newsreader 24px), one-line subtitle (`params.subtitle`), mono link row
   `github · resume · linkedin · strava · leetcode · email` from `params.links`; the email href is
   percent-encoded in the href (no JS) so plain-text scrapers miss it. portrait floated right (see Portrait).
   (120px desktop, 84px phone).
2. **now**: items from `content/now.md` `now:` list (`label`, `value`, optional `link`, optional `logo`), then a
   **listening** line from `data/music.json` → `recent[0]`: "listening to *Track* by Artist ·
   last.fm · <relative time>". Hidden if no data.
3. **experience**: all `experience` pages where `kind: work`, newest first, max 4:
   "role @ org" + optional one `summary` line, dates right-aligned mono. Link "full experience →".
   Optional `logo: "logos/<file>"` (under `assets/images/`) renders a 20px square left of the
   title (also on `/experience/`, education rows, and now items); light chip behind it in dark mode.
4. **projects**: `featured: true`, sorted by `weight` then date, max 4: "title: description",
   `outcome` on second line, year right. Link "all projects →".
5. **reading**: items from `data/reading.json` (written by the apramreads sync), newest first,
   max 4, through `entry-row.html`: title links to the post on apramreads, `summary` on the second
   line, started date right-aligned mono (empty when unknown). Link "more at apramreads →" to the
   apramreads home, where the daily reading log lives. Section absent when the file is missing or
   has no items. Books, essays and any future apramreads section appear here; daily reads never do.
6. **recently outside**: latest 4 activities: `date | activity | stats | 44px photo` (same
   `activity-row.html` as `/activities/`). Fixed-width mono columns.
   Link "all activity →".
7. **education**: `experience` pages where `kind: education`.
8. **Footer**: "built with hugo · updated <last build date>" + theme toggle.

Placeholder content shows a small `example` tag (from `example: true` front matter).

## Content model (YAML front matter)

```yaml
# projects/<slug>.md
title: "PILOT"
date: 2026-03-01
description: "multi-agent voice assistant for android"   # one line, lowercase ok
outcome: "1st prize, IEEE EDT"                           # optional
tags: [Kotlin, FastAPI, Groq]
featured: true
weight: 1                                                # optional ordering
status: "complete"                                       # complete | active | archived
github: ""                                               # optional
demo: ""                                                 # optional
link: ""                                                 # optional project page (lab, event)
doc: ""                                                  # optional key on apramm.github.io/docs (?doc=<key>)
doc_label: ""                                             # optional link text for doc, default "write-up"
image: ""                                                # optional, page bundle or /images/...
example: false

# experience/<slug>.md
title: "Backend Software Engineer Intern"
organization: "Mastercard"
kind: work                     # work | education
start: 2026-05
end: 2026-09                   # or "present"
location: "Vancouver, BC"
summary: "resilience testing for kafka / nats clusters"
highlights: [ "...", "..." ]
tags: [Java, Spring Boot, Kafka]
link: ""

# activities/<yyyy-mm-dd>-<slug>.md   (manual or generated)
title: "Evening run"
date: 2026-09-27T18:10:00-07:00
activity: run                  # run | hike | ride | swim | gym | walk | soccer | other
distance_km: 8.4               # optional
duration: "44:21"              # display string
moving_seconds: 2661           # optional, for sorting/aggregates
elevation_m: 120               # optional
location: "Vancouver"
source: manual                 # manual | strava | hevy
source_id: ""                  # provider id, used for idempotent sync
source_url: ""
photos: []                     # paths
example: false

# photos/<slug>.md   (or page bundle with image file)
title: "Garibaldi Lake"
date: 2025-08-10
image: "garibaldi.jpg"         # bundle resource, resized by Hugo
alt: "..."                     # required
location: ""
related: []                    # optional content paths

# interests/<slug>.md
title: "Running"
description: "one line"
tags: [running]                # pages sharing a tag are listed under the interest
weight: 1

# now.md
title: "Now"
updated: 2026-10-01
now:
  - { label: "building", value: "PILOT, a voice agent for android", link: "/projects/pilot/" }
```

`hugo.yaml` params: `name`, `subtitle`, `description`, `resume`, `links{github, linkedin, strava,
email}`, `lastfm.user` (`aprammusic`), `docsBase` (`https://apramm.github.io/docs/?doc=`).
Resume link is `params.resume` everywhere, so a local PDF can replace it by config.

Archetypes exist for every collection so `hugo new projects/x.md` produces a valid file.

## Data sync (build-time only)

```
Strava ────┐
Hevy  ─────┼─ scripts/sync-*.mjs ─> content/activities/*.md, data/music.json, data/reading.json ─> git commit ─> Vercel build
Last.fm ───┤   (GitHub Action cron, every 15 min + manual dispatch)
apramreads ┘
```

- Each provider is one script: `sync-strava.mjs`, `sync-hevy.mjs`, `sync-lastfm.mjs`,
  `sync-reads.mjs`, sharing `scripts/lib/activity.mjs` (normalize → front matter → write file named
  `<date>-<source>-<id>.md`; JSON writers use its `getJson` and `writeAtomic`).
- Missing env vars → log "skipping" and exit 0. Any API error → exit non-zero **without
  touching existing files** (write to temp, then rename). The site always builds from the last
  good data.
- Idempotent: re-running with the same data produces no git diff.
- Hand edits survive: a resync keeps an existing file's body, `photos` and `description`, and
  merges `tags`. Stale files are pruned only inside the fetched date window.
- Synced activities get default `tags` by activity (run→running, hike→hiking, ride→cycling,
  swim→swimming, gym→fitness, walk→walking) so interest pages find them.
- Strings are made well-formed (`toWellFormed`); dates must be ISO or the record is rejected;
  generated filenames must match `^[\w-]+\.md$`.
- Strava: OAuth refresh-token flow (client id/secret + refresh token as Actions secrets).
  If Strava returns a rotated refresh token the job writes the data, logs `::error::` naming the
  secret, and fails so GitHub emails the owner. `scripts/strava-auth.mjs` prints the authorize URL
  and exchanges a code for the first refresh token locally. Scope `read,activity:read`. Only
  `visibility: everyone` activities are published.
- Strava photos: for each published activity with `total_photo_count > 0`, one call to
  `GET /activities/{id}/photos?size=1024&photo_sources=true`; the largest entry in `urls` is
  downloaded to `assets/images/activities/<id>-<n>.<ext>` and committed (Hugo resizes it to webp, so
  only same-origin images ship). Existing files are reused, never re-downloaded or deleted.
  Downloads: https only, exact host allowlist in `sync-strava.mjs` (Strava's CloudFront hosts), no
  redirects, no auth header, `image/jpeg|png|webp` checked against magic bytes, 8 MB cap, timeout,
  temp + rename. Photo GPS (`location`) is not stored. A photo failure logs `::warning::` and the
  activity is still written. Front matter: `photos: [{src, alt}]`, alt = caption or
  `"<title>, photo <n>"`; synced entries first in Strava order, then hand-added ones; an existing
  entry with the same `src` wins (hand-edited alt survives).
- Hevy: `GET https://api.hevyapp.com/v1/workouts` with `api-key` header (`HEVY_API_KEY`,
  Hevy Pro). Maps to `activity: gym`, duration from start/end, title from workout title. UTC
  times are converted to `SITE_TZ` (default `America/Vancouver`).
- Last.fm: `user.getRecentTracks` (limit 10) + `user.getTopTracks period=7day` (limit 5) with
  `LASTFM_API_KEY`; user from `LASTFM_USER` or `hugo.yaml`. Writes `data/music.json`:
  `{ fetched_at, user, recent:[{track, artist, album, url, played_at}], top_week:[{track, artist, plays, url}] }`.
  No album art downloaded.
- apramreads (`sync-reads.mjs`): the reading blog at `https://apramm.github.io/apramreads/`
  (repo `apramm/apramreads`, plain Markdown, no front matter) stays the home of all reading;
  this site only lists and links. No key: the script reads the public `blog-manifest.json`
  (`{ "<section>": ["<file>.md", …] }`) and then every file in sections other than `daily-reads`,
  so a new apramreads folder such as `blog/essays/` is listed with no change here. Section names
  must match `^[\w-]+$` and file names `^[\w-]+\.md$`; anything else is skipped with a warning.
  Each file is parsed the way apramreads' own `script.js` does: `title` = first `# ` heading
  (file name without `.md` if none), `date` = first `YYYY-MM-DD` anywhere in the file (empty if
  none), `summary` = first paragraph that is not a heading, list, code fence or `key: value` line,
  collapsed to one line and cut to 160 characters. Strings are made well-formed.
  Writes `data/reading.json`:
  `{ fetched_at, site, items:[{ section, title, date, summary, url }], daily_reads }` with items
  newest first and undated last, `url` = `<site>post.html?section=<s>&file=<f>` (query-encoded),
  `site` = the apramreads base URL, `daily_reads` = number of files in that section (shown
  nowhere yet; it costs nothing because it comes from the manifest). Written only when something
  other than `fetched_at` changed, so an unchanged blog produces no commit and no deploy. A failed
  or malformed fetch (non-2xx, timeout, manifest not an object of arrays) exits 1 and leaves the
  existing file untouched; one unreadable post is skipped with `::warning::` and the rest are
  still written. Freshness is the 15-minute cron; apramreads itself is not changed.
- Secrets live only in GitHub Actions secrets and local `.env` (gitignored). Nothing secret is
  read by Hugo or shipped to the browser. `.env.example` documents every variable.
- Workflow `sync.yml`: checkout (`persist-credentials: false`) → node 22 → run four syncs
  (each `continue-on-error`; the apramreads step needs no secret) → commit `data/`/`content/activities`/`assets/images/activities` changes as
  `github-actions[bot]` → push `main` with the token passed only to that step → fail the job if
  any provider failed. `permissions: {}` at workflow level, `contents: write` on the job. Every
  action pinned by commit SHA; Dependabot bumps them. Workflow `ci.yml`: on PR/push, `node --test 'scripts/*.test.mjs'` and
  `hugo --minify` with the pinned version.

## Portrait

- `params.portrait.src` (an image in `assets/`, default `images/APRAM.jpg`) is shown as a circle
  (128px, floated right of the name on desktop; 88px above the name on phones). `layouts/home.html` takes a centred
  square crop and serves 256w/512w WebP. Change the photo by replacing the file or the param.

## Performance & accessibility budgets

- Homepage: HTML + CSS ≤ 30 KB gzipped, excluding fonts. Fonts ≤ 2 files preloaded.
  JavaScript: only the inline theme script.
- Images: Hugo-resized WebP with `srcset`, `loading="lazy"`, explicit width/height.
- Semantic landmarks (`header`, `main`, `footer`, `nav`), one `h1` per page, ordered headings,
  skip link, 44px touch targets on link rows, alt text required for photos, Lighthouse
  a11y ≥ 95.

## Acceptance

1. `hugo --minify` from a clean checkout builds with 0 errors/warnings on 0.165.0.
2. All pages in the table render; every link in the header resolves.
3. `hugo new projects/test.md` → appears on `/projects/` without template edits.
4. Light, dark, and toggle work; no flash of wrong theme.
5. 320px, 390px, 1280px widths: no horizontal scroll, readable rows.
6. Sync scripts: `node --test 'scripts/*.test.mjs'` passes (normalization, idempotency, failure keeps files).
7. No secret appears in `public/` or in any client JS.
8. README covers local dev, adding each content type, now/music, sync setup, deploy.
9. With `data/reading.json` present the homepage shows a `reading` section whose rows link to
   apramreads posts and whose dates match the files; with the file deleted the section is absent
   and `hugo --minify` still builds clean. `sync-reads.mjs` run twice against the same blog
   produces no diff.
