# Gilmar Sales Blog

Personal Jekyll blog site deployed on GitHub Pages.

## Build

```bash
bundle exec jekyll serve
```

## Structure

- `_posts/` — blog posts in Markdown with YAML front matter
- `_layouts/` — HTML layouts (default → post)
- `_includes/` — reusable Liquid components (post.html, pagination.html, footer.html, search.html, social.html)
- `_sass/` — Sass partials (main.scss compiled to compressed style)
- `css/` — generated CSS (do not edit directly; rebuild from `_sass/`)
- `images/` — static assets (bubble.svg, sparse-sets.png, grid.svg)
- `projects/index.html` — project showcase page
- `search.json` — Jekyll-generated JSON search index for the static search

## Config

- `_config.yml` — site title, author, pagination (5 posts/page), plugins (jekyll-feed, jekyll-paginate)
- `Gemfile` — Jekyll ~> 4.3, webrick for local serving

## Post Format

```yaml
---
layout: post
title:  "Post Title"
date:   YYYY-MM-DD HH:MM:SS -0300
author: Gilmar Sales
categories: category1 category2
---
```

## Key Quirks

- Theme toggle stores preference in `localStorage` key `gs-theme`; anti-flash script applies it before first render
- MathJax (tex-mml-chtml) loaded in default layout for LaTeX rendering in posts
- Font Awesome 6 via CDN in default layout
- Pagination component included twice on index.html (before and after post list)
- `search.json` uses `layout: null` to output raw JSON; it loops `site.posts` via Liquid