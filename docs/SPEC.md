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
image, no client-side calls to Strava / Last.fm / Hevy.

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
- **Light + dark**: follows `prefers-color-scheme` by default. A small text toggle
  (`light / dark / auto`) in the footer sets `data-theme` on `<html>` and stores it in
  `localStorage` (wrapped in try/catch). A ≤ 1 KB inline script in `<head>` applies the stored
  choice before first paint. Token blocks: `:root` (light), `@media (prefers-color-scheme: dark)
  :root:not([data-theme=light])`, `:root[data-theme=dark]`.
- Links: `--accent`, underline on hover/focus. Entry titles: `--fg` with a faint underline
  (`--rule`). Visible `:focus-visible` outline in `--accent`.
- Motion: none except the optional 3D mark and the 3-bar "listening" indicator; both disabled
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
   `github · linkedin · strava · resume · email` from `params.links`. 3D mark floated right
   (120px desktop, 84px phone).
2. **now**: items from `content/now.md` `now:` list (`label`, `value`, optional `link`), then a
   **listening** line from `data/music.json` → `recent[0]`: "listening to *Track* by Artist ·
   last.fm · <relative time>". Hidden if no data.
3. **experience**: all `experience` pages where `kind: work`, newest first, max 4:
   "role @ org" + optional one `summary` line, dates right-aligned mono. Link "full experience →".
4. **projects**: `featured: true`, sorted by `weight` then date, max 4: "title: description",
   `outcome` on second line, year right. Link "all projects →".
5. **recently outside**: latest 4 activities: `date | activity | stats`. Fixed-width mono columns.
   Link "all activity →".
6. **education**: `experience` pages where `kind: education`.
7. **Footer**: "built with hugo · updated <last build date>" + theme toggle.

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
doc: ""                                                  # optional key on apramm.github.io/docs (?doc=<key>)
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
activity: run                  # run | hike | ride | swim | gym | walk | other
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
Strava ─┐
Hevy  ──┼─ scripts/sync-*.mjs ─> content/activities/*.md, data/music.json ─> git commit ─> Vercel build
Last.fm ┘   (GitHub Action cron, every 6h + manual dispatch)
```

- Each provider is one script: `sync-strava.mjs`, `sync-hevy.mjs`, `sync-lastfm.mjs`, sharing
  `scripts/lib/activity.mjs` (normalize → front matter → write file named
  `<date>-<source>-<id>.md`).
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
- Hevy: `GET https://api.hevyapp.com/v1/workouts` with `api-key` header (`HEVY_API_KEY`,
  Hevy Pro). Maps to `activity: gym`, duration from start/end, title from workout title. UTC
  times are converted to `SITE_TZ` (default `America/Vancouver`).
- Last.fm: `user.getRecentTracks` (limit 10) + `user.getTopTracks period=7day` (limit 5) with
  `LASTFM_API_KEY`; user from `LASTFM_USER` or `hugo.yaml`. Writes `data/music.json`:
  `{ fetched_at, user, recent:[{track, artist, album, url, played_at}], top_week:[{track, artist, plays, url}] }`.
  No album art downloaded.
- Secrets live only in GitHub Actions secrets and local `.env` (gitignored). Nothing secret is
  read by Hugo or shipped to the browser. `.env.example` documents every variable.
- Workflow `sync.yml`: checkout (`persist-credentials: false`) → node 22 → run three syncs
  (each `continue-on-error`) → commit `data/`/`content/activities` changes as
  `github-actions[bot]` → push `main` with the token passed only to that step → fail the job if
  any provider failed. `permissions: {}` at workflow level, `contents: write` on the job. Every
  action pinned by commit SHA; Dependabot bumps them. Workflow `ci.yml`: on PR/push, `node --test scripts/` and
  `hugo --minify` with the pinned version.

## 3D mark

- `scripts/make-mountain.mjs` (stdlib only) generates a deterministic low-poly mountain with a
  trail line → `static/models/mountain.glb` (flat-shaded, vertex colors, ≤ 150 KB) and
  `static/models/mountain.svg` poster (same mesh, painter's-algorithm projection, colors via
  `currentColor`/CSS vars so it works in both themes).
- `layouts/partials/mark.html`: renders the SVG poster inline (decorative, `aria-hidden`).
  On first `pointerenter`, `focus` or `click`, `static/js/mark.js` imports a vendored
  `static/js/vendor/model-viewer.min.js` (pinned version) and swaps in `<model-viewer>`
  with `camera-controls`, `disable-zoom`, no AR. Auto-rotate only when motion is allowed.
  The poster stays if JS fails or is disabled.
- Swapping in a personal model later = replace `mountain.glb` + `mountain.svg` (or set
  `params.mark.model` / `params.mark.poster`).

## Performance & accessibility budgets

- Homepage: HTML + CSS ≤ 30 KB gzipped, excluding fonts. Fonts ≤ 2 files preloaded.
  JavaScript before interaction: the inline theme script and the deferred ~1.5 KB `mark.js` listener; the 1 MB viewer loads only on interaction.
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
6. Sync scripts: `node --test scripts/` passes (normalization, idempotency, failure keeps files).
7. No secret appears in `public/` or in any client JS.
8. README covers local dev, adding each content type, now/music, sync setup, deploy.
