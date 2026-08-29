# Gilmar Sales Blog

Personal Jekyll blog site deployed on GitHub Pages.

## Build

Requires **Ruby 3.4** and Bundler:

```bash
gem install bundler
bundle install
bundle exec jekyll serve
```

On Windows, if `bundle exec jekyll` fails with `command not found: jekyll` (common with `vendor/bundle`), use either:

```powershell
.\bin\jekyll.bat serve
# or
ruby bin/jekyll serve
```

If gems are missing, reset the local bundle path and reinstall:

```powershell
bundle config unset path
Remove-Item -Recurse -Force vendor/bundle -ErrorAction SilentlyContinue
bundle install
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
- `docs/design-system.md` — design tokens, components, theme, and breakpoints
- `tools/index.html` — interactive tools hub (card grid)
- `tools/benchmarks/` — Google Benchmark JSON viewer (upload + localStorage)

## Config

- `_config.yml` — site title, author, pagination (5 posts/page), plugins (jekyll-feed, jekyll-paginate)
- `Gemfile` — Ruby ~> 3.4, Jekyll ~> 4.4, stdlib gems (csv, base64, bigdecimal, logger) for Ruby 3.4+

## Post Format

```yaml
---
layout: post
title:  "Post Title"
date:   YYYY-MM-DD HH:MM:SS -0300
author: Gilmar Sales
categories: topic1 topic2
---
```

Posts use Jekyll `categories` as tópicos (`/topics/`). Do not add a separate `tags` taxonomy for posts.

## Key Quirks

- Theme toggle stores preference in `localStorage` key `gs-theme`; anti-flash script applies it before first render
- MathJax (tex-mml-chtml) loaded in default layout for LaTeX rendering in posts
- Font Awesome 6 via CDN in default layout
- Pagination component included twice on index.html (before and after post list)
- `search.json` uses `layout: null` to output raw JSON; it loops `site.posts` via Liquid