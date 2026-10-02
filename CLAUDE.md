> **Current direction (2026-10-01):** `docs/SPEC.md` is the source of truth. It replaces the hero-photo, multi-column homepage below with a single 640px column (light + dark), hosted on Vercel. `docs/PLAN.md` tracks the build. Everything else in this file still applies.

# Build my personal website: minimalist portfolio + digital garden + activity home base

Build a complete, production-quality personal website based on the requirements below.

The website should feel like a **minimalist personal home on the internet**, not a corporate portfolio and not a fitness dashboard.

The three ideas to combine are:

1. **Minimalist portfolio** — projects, experience, resume
2. **Personal digital garden** — interests, notes, things I'm learning/thinking about
3. **Activity-focused home base** — running, hiking, workouts, photos, and other life activities

Use the attached/reference homepage image as the primary visual inspiration. Reproduce its overall visual hierarchy, spacing, typography, density, and editorial feeling, but make the implementation clean, responsive, accessible, and maintainable.

---

## Core design philosophy

The site should feel:

* minimal
* calm
* editorial
* personal
* sophisticated
* highly readable
* lightweight
* slightly outdoorsy without becoming a "fitness website"
* timeless rather than trendy

Avoid:

* flashy gradients
* excessive animations
* huge hero text
* glassmorphism
* excessive rounded cards
* SaaS/dashboard aesthetics
* excessive JavaScript
* unnecessary UI chrome
* generic AI-generated portfolio layouts
* giant skill bars
* progress meters
* excessive icons
* dark-mode-first visual design
* anything that looks like a startup landing page

Think:

**Hugo + no-style-please + personal digital garden + beautifully designed outdoor journal.**

Typography and whitespace should do most of the design work.

---

# Technology / architecture

Prefer a static-site architecture.

Use:

* Hugo
* Markdown content
* YAML/TOML frontmatter
* simple templates/partials
* minimal JavaScript
* CSS that is easy to understand and modify
* responsive design
* semantic HTML
* accessible navigation
* Git-based workflow

If you believe another static-site generator is materially better for these requirements, explain why before changing the architecture. Otherwise use Hugo.

The most important architectural requirement is:

> Adding content should feel like creating a Markdown file.

I should not need to edit HTML to add a new project, experience, hike, run, note, or photo.

---

# Content structure

Design the content system around collections such as:

```text
content/
├── _index.md
├── projects/
│   ├── project-one.md
│   └── project-two.md
├── experience/
│   ├── company-one.md
│   └── company-two.md
├── activities/
│   ├── 2026-09-07-evening-run.md
│   └── 2026-09-05-garibaldi-hike.md
├── notes/
│   └── example-note.md
├── interests/
│   ├── running.md
│   ├── hiking.md
│   └── photography.md
└── photos/
```

The exact organization can be improved if Hugo's content model suggests something better.

Every content type should have a clear frontmatter schema.

For example:

```yaml
---
title: "Example Project"
date: 2026-09-01
description: "A short description."
tags:
  - Python
  - Web
featured: true
image: "/images/projects/example.jpg"
github: "https://github.com/..."
demo: "https://..."
---
```

Activities should support fields such as:

```yaml
---
title: "Evening Run"
date: 2026-09-07
activity_type: "run"
distance: 8.4
distance_unit: "km"
duration: "44:21"
location: "Vancouver"
elevation: 120
source: "strava"
source_url: "..."
photos:
  - "/images/activities/run-01.jpg"
  - "/images/activities/run-02.jpg"
---
```

The exact schema can be improved during implementation.

---

# Homepage

The homepage is the most important page.

It should approximately follow this structure:

```text
--------------------------------------------------

YOUR NAME

short navigation                         social links


Hi, I'm [Name].

Building things, exploring outdoors,
and staying curious.

Short personal introduction.

Building       ...
Reading        ...
Training       ...

                         [large personal/outdoor photo]

--------------------------------------------------

Recent Activity                    Featured Projects

Running / Hiking / Gym             Project
                                    Project
[activity list]                     Project

--------------------------------------------------

Photos                             Quick Links

[photo] [photo] [photo]             GitHub
[photo] [photo] [photo]             LinkedIn
                                    Strava
                                    Hevy
                                    Resume

--------------------------------------------------

Experience                         Interests

timeline                            Hiking
                                    Running
Company                              Fitness
Company                              Photography
Education                            Books
                                    Learning

--------------------------------------------------

footer
```

Do NOT copy this literally if the design can be improved, but preserve this information hierarchy.

The homepage should be scannable in approximately 30 seconds.

A visitor should immediately understand:

* who I am
* what I do
* what I'm currently interested in
* what I've built
* what I've been doing recently
* where to find my resume
* where to find my activities

---

# Hero section

The hero should be understated.

Something along the lines of:

```text
Hi, I'm [Name].

Building things, exploring outdoors,
and staying curious.
```

Then a short paragraph explaining who I am.

Beside or underneath it should be a large, tasteful photograph.

Do not make the hero consume the entire viewport.

The user should see additional content without scrolling through a giant landing-page hero.

---

# "Now" / current status

Include a compact section showing what I'm currently doing.

Examples:

```text
Building      personal project
Reading       ...
Training      ...
Learning      ...
```

This should be easy to update from Markdown/frontmatter rather than hardcoded into the template.

Ideally support a simple:

```text
content/now.md
```

or equivalent.

---

# Recent Activity

This should be one of the defining features of the website.

Create a unified activity feed capable of displaying:

* running
* hiking
* gym/workouts
* cycling
* other activities later

The feed should look editorial and lightweight.

Example:

```text
RUN
8.4 km · 44:21
Vancouver
Sep 7

HIKE
Garibaldi Lake
14.2 km · +820 m
Sep 5

GYM
Upper Body
Hevy
Sep 4
```

Each activity should be clickable.

An activity detail page can show:

* activity title
* date
* type
* distance
* duration
* elevation
* location
* source
* photos
* description/notes
* map if available
* external activity link

Do not turn this into a giant analytics dashboard.

The activity information should remain visually subordinate to the overall personal-site aesthetic.

---

# Strava integration

My Strava profile is:

https://www.strava.com/athletes/144141823

Use this as the canonical Strava profile link.

I want the site to eventually support automatically displaying my activities from Strava.

Implement the integration in a way that is secure and maintainable.

Important:

A public athlete URL is NOT sufficient for unrestricted API access.

If automatic synchronization requires Strava OAuth:

* implement OAuth properly
* never expose a Strava client secret in frontend code
* store tokens server-side or through an appropriate server-side/build-time mechanism
* document required environment variables
* document the Strava application setup
* handle token refresh
* handle API failures gracefully
* do not make the whole website dependent on Strava being available

Use a fallback architecture:

```text
Strava API
    ↓
sync/import process
    ↓
local activity data
    ↓
Hugo/static site
```

Prefer importing/synchronizing activity data during a build or scheduled process rather than making every visitor request data directly from Strava.

The site should still work if Strava is unavailable.

If full OAuth/API integration cannot be implemented in the current environment, build the interface and data model so it is ready for integration, and use local example activity data rather than pretending the API works.

Also include a visible link to my Strava profile.

---

# Hevy integration

I also want to support Hevy workouts.

Design the activity architecture so Hevy can eventually be another data source:

```text
Strava ──┐
         ├──> activity model ──> website
Hevy ────┘
```

Do not couple the entire activity UI specifically to Strava.

If Hevy has an appropriate API/integration mechanism, structure the code so it can be added as a provider.

If API access isn't available, support importing workout data through a local JSON/Markdown format.

The important thing is that:

**Run + hike + gym should look like different types of the same activity system.**

---

# Photos

Create a dedicated `/photos` section.

Photos should not just be decorative assets.

They should be first-class content that can be associated with:

* activities
* projects
* hikes
* trips
* notes
* other experiences

The photo page should feel like a minimal personal photo archive.

Example:

```text
Photos

2026

[image] [image] [image]
[image] [image] [image]

2025

[image] [image] [image]
[image] [image] [image]
```

Use responsive image handling and lazy loading.

Do not create a complicated masonry library unless it materially improves the design.

---

# Projects

Projects should have their own collection.

Homepage should show a small selection of featured projects.

Project pages should support:

* title
* description
* date
* technologies
* images
* GitHub link
* demo link
* explanation
* what I learned
* status

Projects should be easy to add by creating one Markdown file.

---

# Experience

Create a clean chronological experience page.

Do NOT make it look like a standard corporate résumé template.

Use an editorial timeline or clean list.

Each experience should support:

* organization
* role
* start date
* end date
* location
* description
* achievements
* technologies
* optional links

The homepage should show a concise subset.

There should be a link to the full experience page.

---

# Resume

My resume is available here:

https://apramm.github.io/docs/?doc=resume

Use this as the canonical resume link.

Add a prominent but tasteful "Resume" link in the navigation and/or quick-links area.

Do not recreate the entire resume unnecessarily if linking to it is sufficient.

If a local PDF copy is later added, make it possible to replace the external link through configuration without changing templates.

---

# Digital garden / interests

Create an `/interests` or `/garden` area.

This should be lightweight.

Possible categories:

* Running
* Hiking & outdoors
* Fitness
* Photography
* Books
* Software
* Learning
* Other interests

Interests should be able to link to notes, projects, activities, or other content.

For example:

```text
Running

Things I've learned from running.
Projects related to running.
Recent runs.
Books/articles I'm reading.
```

The goal is not to create a full knowledge-management system.

It should simply make the site feel alive and personal.

---

# Navigation

Keep navigation extremely simple.

Suggested:

```text
Home
Experience
Projects
Activities
Photos
Interests
Resume
```

On mobile, make navigation compact and accessible.

Avoid hamburger-menu complexity unless genuinely necessary.

---

# Visual design

Use the reference image as the visual target.

The design should have:

* warm white/off-white background
* dark readable text
* restrained secondary text
* subtle borders/dividers
* generous whitespace
* excellent typography
* editorial layout
* restrained accent color
* subtle icons only where useful
* high-quality photography
* consistent spacing system

Typography should feel sophisticated but highly readable.

Consider a serif display face paired with a clean sans-serif, or another restrained editorial combination.

Do not use five different fonts.

Do not over-style individual sections.

---

# Responsive design

The desktop design should feel spacious.

The mobile design should feel intentionally designed rather than simply stacked.

On mobile:

* typography remains comfortable
* navigation remains easy
* activity rows remain readable
* photos become a clean grid
* project cards simplify
* columns collapse intelligently
* no horizontal scrolling
* touch targets are accessible

---

# Accessibility

Build with accessibility in mind:

* semantic HTML
* keyboard navigation
* visible focus states
* alt text
* appropriate heading hierarchy
* sufficient contrast
* reduced-motion support
* accessible navigation
* responsive text sizing

Do not sacrifice readability for visual minimalism.

---

# Performance

Keep the site fast.

Prefer:

* static HTML
* optimized images
* responsive image sizes
* lazy loading
* minimal JavaScript
* no unnecessary third-party scripts
* no giant frontend framework unless absolutely necessary

The site should still feel fast on a slow mobile connection.

---

# Content management philosophy

This is extremely important.

I want to be able to add a project by doing something like:

```text
cp project-template.md content/projects/new-project.md
```

Then edit Markdown.

Same for experiences:

```text
content/experience/new-role.md
```

Same for activities:

```text
content/activities/my-hike.md
```

Same for notes:

```text
content/notes/my-note.md
```

The website should automatically discover and render them.

Do not build an admin CMS unless absolutely necessary.

Git + Markdown should be the CMS.

---

# Configuration

Put personal/global information in a configuration file rather than hardcoding it into templates.

For example:

```yaml
name: "YOUR NAME"
tagline: "Building things, exploring outdoors, and staying curious."

links:
  github: "..."
  linkedin: "..."
  strava: "https://www.strava.com/athletes/144141823"
  resume: "https://apramm.github.io/docs/?doc=resume"
```

Make the site's personal information easy to change.

---

# Deployment

Make the project straightforward to deploy through GitHub Pages or another static hosting provider.

Include:

* build instructions
* local development instructions
* deployment instructions
* environment variable documentation for Strava
* content authoring documentation
* image/content conventions

If using GitHub Actions, provide a working workflow.

---

# Seed content

Create realistic placeholder/example content so the website looks complete when first launched.

Do not invent real claims about me.

Clearly mark placeholder content where appropriate.

The structure should make it obvious where I should replace the examples with my actual:

* projects
* experiences
* interests
* activities
* photos
* current status

---

# Code quality

Organize the implementation cleanly.

Use reusable Hugo partials/components for:

* navigation
* activity rows
* project rows/cards
* experience entries
* photo grids
* metadata
* footer
* page headers

Avoid duplicating markup.

Keep CSS understandable.

Do not create an unnecessarily complicated design system.

---

# Final deliverable

Produce a complete working website, not just a mockup.

Before finishing:

1. Verify all pages render.
2. Verify mobile responsiveness.
3. Verify Markdown content creation works.
4. Verify project/experience/activity collections work.
5. Verify photos work.
6. Verify external links work.
7. Verify the Strava integration architecture is secure.
8. Verify the resume link works.
9. Verify accessibility basics.
10. Verify the site can be built from a clean checkout.

Also provide a concise README explaining:

* how to run locally
* how to add a project
* how to add an experience
* how to add an activity
* how to add photos
* how to edit the homepage/"Now" section
* how Strava synchronization works
* how to configure Strava credentials
* how to deploy

The finished result should feel like:

> **a beautiful, quiet corner of the internet that happens to contain a résumé.**

It should communicate both **what I do professionally** and **what I do because I enjoy being alive**.

Do not make it feel like a résumé with a fitness widget attached.
