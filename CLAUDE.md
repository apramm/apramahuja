# apramahuja.com: working notes for Claude

The live personal site of Apram Ahuja (CS @ UBC). It's a single-column Hugo site, hosted on
Vercel, and content is Markdown. **Source of truth for design and schema: `docs/SPEC.md`.** The
original product brief is in `docs/BRIEF.md` (history only; the SPEC overrides it). The README
covers how to update the site.

## Commands

```sh
hugo server                          # local preview, http://localhost:1313
hugo --minify --gc                   # production build → public/ (gitignored)
node --test 'scripts/*.test.mjs'     # sync tests; quote the glob (Node 22 rejects a directory)
node --env-file=.env scripts/sync-strava.mjs   # also sync-lastfm.mjs, sync-hevy.mjs
```

Pinned versions: Hugo **0.165.0** extended (`vercel.json` and `.github/workflows/ci.yml`),
Node **22** in CI. Run the tests on both local Node and `npx node@22` when changing scripts.

## Map

```
content/      projects/ experience/ activities/ photos/ interests/ now.md   (YAML front matter)
layouts/      home.html, baseof.html, section dirs; partials/ (entry-row, exp-row, activity-row, img, logo, now-list…)
assets/       css/site.css (the only stylesheet, tokens on :root) · images/ (Hugo-processed: APRAM.jpg portrait, logos/, activities/)
static/       fonts/ (self-hosted Newsreader + Geist Mono), favicon.ico
data/         music.json (written by the Last.fm sync)
scripts/      sync-strava|lastfm|hevy.mjs, lib/activity.mjs (normalize/front matter/atomic writes), strava-auth.mjs, *.test.mjs
.github/      workflows/sync.yml (cron every 15 min, commits data to main), ci.yml (tests + hugo build), dependabot.yml
vercel.json   Hugo version, cache headers, CSP
```

## Data flow

Strava, Hevy and Last.fm → `scripts/sync-*.mjs` (in the GitHub Action every 15 min) → commit to
`main` → Vercel deploy. Visitors never call the APIs. Secrets live in GitHub Actions secrets and in
the local `.env` (gitignored): `STRAVA_CLIENT_ID` (224310, not secret), `STRAVA_CLIENT_SECRET`,
`STRAVA_REFRESH_TOKEN`, `LASTFM_API_KEY`, optional `HEVY_API_KEY`. Repo variables: `LASTFM_USER`
(default `aprammusic` from `hugo.yaml`) and `SITE_TZ`.

## Gotchas (each one has bitten before)

- **Never print or `cat` `.env`, and never echo tokens.** To check it, print only key names and
  value lengths. Write a refresh token straight into `.env` with a script.
- **CSP hash:** `vercel.json` allows the one inline theme script in `layouts/baseof.html` by its
  sha256. If you edit that script, recompute the hash from the *minified* build output and update
  `vercel.json`, or the theme toggle silently breaks in production.
- Activity kind is the `activity:` field, **not `type:`**, because `type` is reserved by Hugo for
  layout lookup.
- Strava: scope `read,activity:read`; only `visibility: everyone` activities are published.
  Photo downloads are allowlisted to Strava's CDN hosts. The photos API is skipped when every
  photo for an activity is already on disk (this keeps the 15-min cron under rate limits).
- Sync scripts preserve hand edits (body, `photos`, `description`, merged `tags`) and prune only
  inside the fetched date window. Failures never touch existing files.
- tzdata 2026c puts America/Vancouver on permanent UTC-7 from Nov 2026; DST tests use
  America/Los_Angeles.
- Don't sync faster than 15 min: Vercel Hobby allows 100 deploys/day and music changes often.
- `hugo --minify` decodes HTML entities in attributes, so the email is percent-encoded in the
  href (no plain address in output).
- Headless Chrome has a 500px minimum window. For phone screenshots, render the site inside
  320/390px iframes on a wrapper page.
- Images: put them in `assets/` (not `static/`) so Hugo resizes them to WebP; render them through
  `partials/img.html`.

## Conventions

- Design: one 640px column, light by default (light/dark toggle), five color tokens, Newsreader +
  Geist Mono, lowercase labels, dated lists, no cards, and no JS except the theme toggle. Keep it
  quiet.
- Copy: never invent facts about Apram; take them from his resume
  (https://apramm.github.io/docs/?doc=resume) or ask. Mark placeholders `example: true`. Write
  one-liners as problem → result.
- Workflow the owner likes: a spec/plan first, then specialized parallel agents with disjoint file
  ownership, a review pass (code, security, perf/a11y), screenshots before shipping, and a PR to
  `main` (Vercel previews on branches; production deploys on merge).
- Commit messages end with the `Co-Authored-By` line from the session instructions.
