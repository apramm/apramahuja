# Implementation plan

Branch: `hugo-revamp`. Contract: `docs/SPEC.md`. Each task has one owner and a disjoint set of
paths, so agents can run in parallel in the same tree.

## Phase 0: cleanup (lead, sequential)

- [x] Remove the Next.js app: `pages/ components/ lib/ styles/ build/ .next/ node_modules/
      package.json package-lock.json .eslintrc.json prettier.config.js .prettierignore`
- [x] Untrack `public/` (build output); `.gitignore` → `public/`, `resources/`, `.hugo_build.lock`, `.env`
- [x] Delete fabricated `content/experience/research-assistant.md`
- [x] `vercel.json` (Hugo 0.165.0, `hugo --minify --gc`, output `public`)
- [x] `hugo.yaml` baseURL → apramahuja.com, YAML params per spec
- [x] Remove GitHub Pages workflow `hugo.yml`

## Phase 1: build (parallel)

| # | Task | Agent | Owns |
|---|---|---|---|
| 1 | Layouts, CSS, light/dark theme, all pages, partials, fonts | frontend (frontend-ui-engineering) | `layouts/` (except `partials/mark.html`), `static/css/`, `static/fonts/`, `static/js/theme.js` |
| 2 | Real content from resume, archetypes, schema migration, example tags | content | `content/`, `archetypes/`, `hugo.yaml` params |
| 3 | Strava / Hevy / Last.fm sync, shared lib, tests, workflows, `.env.example` | integrations (security-and-hardening + TDD) | `scripts/sync-*`, `scripts/strava-auth.mjs`, `scripts/lib/`, `scripts/*.test.mjs`, `.github/`, `data/`, `.env.example` |
| 4 | Mountain generator, GLB + SVG poster, mark partial + lazy loader, vendored model-viewer | 3D | `scripts/make-mountain.mjs`, `static/models/`, `static/js/mark.js`, `static/js/vendor/`, `layouts/partials/mark.html` |

Interfaces between them come only from SPEC: front-matter fields, `data/music.json` shape, and
partial name `mark.html` (`{{ partial "mark.html" . }}`).

## Phase 2: review (parallel, read-only)

| Review | Agent |
|---|---|
| Correctness, readability, duplication | code-reviewer |
| Secrets, workflow permissions, token handling | security-auditor |
| Weight, fonts, images, lazy JS | web-performance-auditor |

## Phase 3: fix + verify (lead)

- [x] Apply confirmed findings
- [x] Clean-checkout build (`git clone` to temp, `hugo --minify`)
- [x] Browser check: 320 / 390 / 1280, light + dark, keyboard focus
- [x] README rewrite
- [x] Commit on `hugo-revamp`; the user merges to `main` (Vercel deploys)

## User actions after merge

1. Vercel project: framework preset "Hugo", or rely on `vercel.json`. Check that the domain still points there.
2. GitHub secrets: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`,
   `LASTFM_API_KEY`, optionally `HEVY_API_KEY`.
3. Install a scrobbler (Marvis Pro / NepTunes) pointed at Last.fm user `aprammusic`.
