---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
description: ""        # one line, lowercase ok
outcome: ""            # optional, e.g. "1st prize, IEEE EDT"
tags: []               # technologies, e.g. [Kotlin, FastAPI]
featured: false        # true = eligible for the homepage (max 4)
weight: 0              # optional ordering for featured projects (lower first)
status: "active"       # complete | active | archived
github: ""             # optional repo URL
demo: ""               # optional live/demo URL
doc: ""                # optional key on apramm.github.io/docs (?doc=<key>)
image: ""              # optional, page bundle resource or /images/... (file in assets/images/)
image_alt: ""          # optional; empty = decorative
example: false         # true marks placeholder content
---

## what it does

## how it works

## what i learned
