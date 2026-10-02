# Apram Ahuja — Hugo personal site

This site is now a Hugo site. Projects, experience, activities, interests, photos, and the homepage “Now” section are content files, so adding content does not require editing templates.

## Run locally

Install Hugo Extended (the workflow uses Hugo `0.133.1`), then run:

```bash
hugo server --buildDrafts --navigateToChanged
```

Open `http://localhost:1313`.

Build the site with:

```bash
node scripts/strava-sync.mjs
hugo --minify
```

If Strava credentials are not configured, the sync step intentionally skips and the local Markdown activities still build normally.

## Add content

Use Hugo archetypes to create new Markdown files:

```bash
hugo new projects/my-project.md
hugo new experience/my-role.md
hugo new activities/my-run.md
hugo new interests/running.md
hugo new photos/new-photo.md
```

Then edit the generated frontmatter and Markdown body. The templates discover new files automatically.

The schemas are defined in:

- `archetypes/projects.md`
- `archetypes/experience.md`
- `archetypes/activities.md`
- `archetypes/interests.md`
- `archetypes/photos.md`

Images belong in `static/images/`. Reference them from frontmatter as `/images/filename.jpg`.

Edit `content/now.md` to update the three homepage status lines:

```yaml
building: "what I am building"
reading: "what I am reading"
training: "what I am training for"
```

## Strava integration

The public athlete URL is only used as a profile link. Activity synchronization uses Strava OAuth and happens before Hugo builds:

```text
Strava OAuth API
      ↓
scripts/strava-sync.mjs
      ↓
content/activities/strava-<id>.md
      ↓
Hugo static pages
```

Create a Strava application at https://www.strava.com/settings/api and configure the callback URL for the one-time OAuth authorization flow. Store the resulting refresh token in the build environment; never put secrets in `static/`, `content/`, or browser JavaScript.

Copy `.env.example` to `.env` for local use and provide:

```text
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REFRESH_TOKEN=
```

For the initial authorization, set `STRAVA_CLIENT_ID` and optionally `STRAVA_REDIRECT_URI`, then run:

```bash
npm run strava:auth-url
```

Open the printed URL, approve access, and copy the `code` from the callback URL. Exchange it once with Strava:

```bash
curl -X POST https://www.strava.com/oauth/token \
  -d client_id="$STRAVA_CLIENT_ID" \
  -d client_secret="$STRAVA_CLIENT_SECRET" \
  -d code="PASTE_CODE_HERE" \
  -d grant_type=authorization_code
```

Save the returned `refresh_token` as `STRAVA_REFRESH_TOKEN`. The callback code is short-lived; the refresh token is what the build uses.

The sync script refreshes the access token server-side, imports the latest 30 activities, normalizes them into the same frontmatter schema as manual activities, and links each imported activity back to Strava. It only deletes generated files whose names start with `strava-`; hand-authored Markdown activities are preserved.

For GitHub Actions, add `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, and `STRAVA_REFRESH_TOKEN` as repository secrets. If any are missing, the workflow builds from local content without failing.

Hevy can use the same model later: an importer should write Markdown files into `content/activities/` with `activity_type: "gym"` and `source: "hevy"`. The templates do not depend on Strava-specific fields.

## Deployment

`.github/workflows/hugo.yml` builds the site on pushes to `main`, optionally syncs Strava, and uploads the Hugo `public/` directory as a Pages artifact. In repository settings, set Pages → Source to **GitHub Actions**.

Personal configuration is in `hugo.yaml`, including the resume, Strava, GitHub, LinkedIn, and email links.
