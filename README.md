# YVER — Chapters of the World

Static site for the YVER outerwear brand. One page, no dependencies, deployed on Cloudflare Workers.

- `public/index.html` — the site (home, Atlas, the Skrei chapter, piece pages)
- `public/brand/brand-book.html` — brand book (logo, colour, type, photo brief)
- `public/brand/*.svg` — wordmark and monogram
- `wrangler.jsonc` — Cloudflare config: serve `./public` as static assets, no server code

## Editing

The sources live in `../kalt-studio/` (written for the Claude artifact viewer, which supplies the
`<head>`). After changing a source, rebuild the standalone pages:

    sh build.sh

## Deploying

Cloudflare Workers builds run `npx wrangler deploy` on every push to `main`.
