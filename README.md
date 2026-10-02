# apramahuja.com

A single-column personal site built with [Hugo](https://gohugo.io). Content is Markdown, and git
is the CMS. The design and the content schema are specified in [`docs/SPEC.md`](docs/SPEC.md).

## Run locally

```sh
brew install hugo          # 0.165.0 extended (same version as vercel.json and CI)
hugo server                # http://localhost:1313, live reload
hugo --minify --gc         # production build into public/
node --test 'scripts/*.test.mjs'       # sync script tests (Node 22, no npm install)
```

## Add content

Each item is one file. `hugo new` fills in front matter from `archetypes/`.

| What | Command | Notes |
|---|---|---|
| Project | `hugo new projects/my-project.md` | `featured: true` puts it on the homepage (max 4, ordered by `weight`). `outcome` is the one-line result. `doc: ieee` links to `apramm.github.io/docs/?doc=ieee`. |
| Experience | `hugo new experience/company.md` | `kind: work` or `kind: education`. Dates are `YYYY-MM`, and `end: present` marks a current role. |
| Activity | `hugo new activities/2026-10-04-sunday-long-run.md` | `activity: run \| hike \| ride \| swim \| gym \| walk \| other`. Synced activities appear without any manual work. |
| Photo | `hugo new photos/garibaldi.md` | Put the image in `assets/images/` (or in a page bundle next to `index.md`). Hugo resizes it to WebP. `alt` is required. |
| Interest | `hugo new interests/climbing.md` | Pages that share one of its `tags` are listed on it. |

Set `draft: true` to hide a page, and set `example: true` to label placeholder content.

## Homepage "now" and music

- **now:** edit the `now:` list in `content/now.md` (label, value, optional link) and bump `updated`.
- **listening:** read from `data/music.json`, which the Last.fm sync writes. Delete the file to
  hide the line. The "3h ago" text is computed at build time, so it refreshes each time the sync
  commits.
- **3D mountain:** replace `static/models/mountain.glb` and `static/models/mountain.svg` (the
  poster), or point `params.mark` in `hugo.yaml` at other files. To regenerate the mountain, run
  `node scripts/make-mountain.mjs`.
- **name, subtitle, links, resume:** these are `params` in `hugo.yaml`. To use a local PDF for
  the resume, put the file in `static/` and change `params.resume`.

## Data sync (Strava, Hevy, Last.fm)

```
Strava ─┐
Hevy  ──┼─ scripts/sync-*.mjs ──> content/activities/*.md, data/music.json ──> commit ──> Vercel build
Last.fm ┘   GitHub Action .github/workflows/sync.yml, every 6h + manual "Run workflow"
```

Visitors never contact these APIs. If a provider is down or a key is missing, that script skips or
fails without touching existing files, and the site keeps the last good data. Hand edits to a
synced activity (notes in the body, `photos`) survive later syncs.

Strava photos on public activities are downloaded at sync time into `assets/images/activities/`
and committed with the activity files; Hugo serves resized webp copies from the site itself. Each
photo is fetched once. To add your own photo to a synced activity, put the file in
`assets/images/activities/` and append `{src: "/images/activities/<file>", alt: "..."}` (or just
the path) to its `photos:` list; you can also edit the `alt` of a synced photo.

Add the keys under **GitHub → repo → Settings → Secrets and variables → Actions**:

| Secret | How to get it |
|---|---|
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Create an app at <https://www.strava.com/settings/api>. Set the callback domain to `localhost`. |
| `STRAVA_REFRESH_TOKEN` | Put the ID and secret in a local `.env` file (copy `.env.example`), then run `node scripts/strava-auth.mjs`. Open the URL it prints, approve, copy the `code=` value from the redirect URL, and run `node scripts/strava-auth.mjs --code <code>`. Paste the token it prints. |
| `LASTFM_API_KEY` | <https://www.last.fm/api/account/create>. The username (`aprammusic`) is set in `hugo.yaml`. |
| `HEVY_API_KEY` | Hevy app → Settings → Developer (requires Hevy Pro). This one is optional. |

Optional repository **variables** (not secrets): `LASTFM_USER` overrides the username in
`hugo.yaml`, and `SITE_TZ` sets the time zone for Hevy workout times (default `America/Vancouver`).
Strava only publishes activities set to "Everyone".

To get Apple Music plays into Last.fm, use a scrobbler: Marvis Pro or similar on iOS, or NepTunes or the Last.fm desktop app on macOS.

When a provider fails, the workflow run fails and GitHub emails you, while data from the other
providers is still committed. If Strava rotates the refresh token, the log names the secret to
update.

To run a sync locally, put the keys in `.env` (it's gitignored) and run
`node --env-file=.env scripts/sync-strava.mjs`.

## Deploy

Vercel builds every push to `main`; `vercel.json` sets the Hugo version, build command, cache
headers and CSP. The sync workflow pushes to `main`, which triggers a deploy. CI
(`.github/workflows/ci.yml`) runs the tests and a Hugo build on every PR.

If you change the inline theme script in `layouts/baseof.html`, also update its `sha256` in the
CSP in `vercel.json`, or the theme toggle stops working in production.

## Layout of the repo

```
content/      Markdown: projects, experience, activities, photos, interests, now
layouts/      Hugo templates and partials
assets/       CSS and images (processed and fingerprinted by Hugo)
static/       fonts, 3D model, mark.js, vendored model-viewer, favicon
data/         music.json (written by the sync)
scripts/      sync scripts and tests, Strava auth helper, mountain generator
docs/         SPEC.md, PLAN.md, vendor notes
```
