---
# filename: content/activities/<yyyy-mm-dd>-<slug>.md
#   e.g. hugo new activities/2026-09-27-evening-run.md
# synced files are named <date>-<source>-<id>.md by scripts/
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
activity: run              # run | hike | ride | swim | gym | walk | other
distance_km: 0         # optional
duration: ""           # display string, e.g. "44:21" or "1h 05m"
moving_seconds: 0      # optional, for sorting/aggregates
elevation_m: 0         # optional, metres gained
location: ""
source: manual         # manual | strava | hevy
source_id: ""          # provider id, used for idempotent sync
source_url: ""         # link to the activity on the provider
photos: []             # image paths
tags: []               # e.g. [running], so interest pages can list it
example: false         # true marks placeholder content
---
