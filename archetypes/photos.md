---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
image: ""              # bundle resource (resized by Hugo) or /images/...
alt: ""                # required: describe what is in the photo
location: ""           # optional
related: []            # optional content paths, e.g. ["/activities/2026-09-20-garibaldi-lake-hike"]
example: false         # true marks placeholder content
---
