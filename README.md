# YVER — Chapters of the World

Static site for the YVER outerwear brand. One page, no build tools, no dependencies.

- `index.html` — the site (home, Atlas, the Skrei chapter, piece pages)
- `brand/brand-book.html` — brand book (logo, colour, type, photo brief)
- `brand/*.svg` — wordmark and monogram
- `CNAME` — custom domain for GitHub Pages

## Editing

The sources live in `../kalt-studio/` (written for the Claude artifact viewer, which supplies the
`<head>`). After changing a source, rebuild the standalone pages:

    sh build.sh

## Hosting

Works as-is on GitHub Pages, Cloudflare Pages or Vercel — it is plain static files.
