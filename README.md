# apramahuja.com

A single-column personal site built with [Hugo](https://gohugo.io). Content is Markdown, and git
is the CMS. The design and the content schema are specified in [`docs/SPEC.md`](docs/SPEC.md).

## Updating the site

Most of the site updates itself. The rest is one Markdown file and a push.

### What updates on its own

| What | Where it comes from | How often |
|---|---|---|
| **recently outside** + `/activities/` | Strava (runs, hikes, soccer…), including your activity photos | every 30 min |
| Gym workouts | Hevy (optional, needs `HEVY_API_KEY`) | every 30 min |
| **listening** line | Last.fm `aprammusic` (Apple Music → a scrobbler app → Last.fm) | every 30 min |
| "updated" date in the footer | the build itself | every deploy |

Every 30 minutes, the `sync` GitHub Action runs the three scripts in `scripts/`. They fetch your
latest data with the keys stored in GitHub Secrets, write it into the repo
(`content/activities/`, `assets/images/activities/`, `data/music.json`) and commit it. That
commit triggers Vercel, which rebuilds the site in under a minute. Visitors only ever load static
pages, so the site doesn't depend on Strava or Last.fm being up. If one of them fails, the site
keeps the last good data and GitHub emails you. To sync right away, open **Actions → sync → Run
workflow** on GitHub.

The schedule is set in `.github/workflows/sync.yml`. Every 30 minutes stays well within the free
limits: the repo is public, so Actions minutes are free; a run only commits (and deploys) when
something changed; and a run makes 2 Strava API calls plus one per activity that has new photos.
GitHub can start scheduled runs 5–20 minutes late when it's busy, so treat it as "about every
half hour".

Only Strava activities set to **Everyone** are published. To hide an activity, make it private on
Strava and the next sync removes it (this works for your 30 most recent activities; delete older files by hand). Notes you add to a synced activity's Markdown file survive
later syncs.

### Add a new job (about 2 minutes)

```sh
hugo new experience/acme.md      # creates content/experience/acme.md from the template
```

Fill in the fields it creates:

```yaml
title: "Software Engineer Intern"
organization: "Acme"
kind: work                # or: education
start: 2027-01
end: present              # or e.g. 2027-04
summary: "one line about the problem you solved and the result"
highlights:
  - "What you did, how, and the measurable result."
tags: [Go, Kubernetes]
logo: "logos/acme.png"    # optional: drop a small PNG into assets/images/logos/
```

Then `git add -A && git commit -m "Add Acme" && git push`. Vercel deploys it, and the homepage
shows the four newest jobs automatically. Projects work the same way (`hugo new
projects/x.md`, with `featured: true` to put one on the homepage), and so do photos and interests.
The table below lists them all.

### Edit by hand

- **now** (building / training / teaching): edit `content/now.md`.
- **name, subtitle, header links, resume link**: edit `params` in `hugo.yaml`.
- **photo**: replace `assets/images/APRAM.jpg` (or change `params.portrait` in `hugo.yaml`).

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
- **name, subtitle, links, resume:** these are `params` in `hugo.yaml`. To use a local PDF for
  the resume, put the file in `static/` and change `params.resume`.

## Data sync (Strava, Hevy, Last.fm)

```
Strava ─┐
Hevy  ──┼─ scripts/sync-*.mjs ──> content/activities/*.md, data/music.json ──> commit ──> Vercel build
Last.fm ┘   GitHub Action .github/workflows/sync.yml, every 30 min + manual "Run workflow"
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
static/       fonts, favicon
data/         music.json (written by the sync)
scripts/      sync scripts and tests, Strava auth helper
docs/         SPEC.md, PLAN.md, vendor notes
```
