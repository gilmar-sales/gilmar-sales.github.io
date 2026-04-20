# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Stack
- Jekyll 4.3 with Ruby/Bundler
- Plugins: jekyll-feed, jekyll-paginate

## Commands
- `bundle exec jekyll serve` - Local development server (required, not just `jekyll serve`)
- `bundle exec jekyll build` - Production build to _site/
- `bundle install` - Install/update gems after Gemfile changes

## Structure
- Posts go in `_posts/` with format `YYYY-MM-DD-title.ext` (supports .markdown, .md)
- Layouts in `_layouts/`, includes in `_includes/`
- SASS source in `_sass/`, compiled CSS output is managed externally
- Pagination configured for 5 posts per page in _config.yml

## Front Matter
Posts require YAML front matter:
```yaml
---
title: "Post Title"
date: YYYY-MM-DD HH:MM:SS +/-TZ
categories: category1 category2
---
```
