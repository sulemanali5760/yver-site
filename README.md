# YVER — Chapters of the World

Site for the YVER outerwear brand, deployed on Cloudflare Workers at rawajpret.store.

- `public/index.html` — the site (home, Atlas, the Skrei chapter, the Sashiko preview, piece pages)
- `public/orbit.js` — the six Skrei pieces in orbit (three.js), on the Skrei chapter page
- `public/temple-worker.js` — runs Temple Night (behind the home hero and the Sashiko preview) in a Web Worker
- `public/vendor/temple-night.js` — [Temple Night](https://threeui.com/three-js/temple-night/temple-night) by ThreeUI, MIT (`vendor/THREEUI-LICENSE.txt`)
- `public/brand/brand-book.html` — brand book (logo, colour, type, photo brief)
- `public/brand/*.svg` — wordmark and monogram
- `src/worker.js` — serves `public/` and takes piece requests at `POST /api/request` (stored in D1)
- `wrangler.jsonc` — Cloudflare config

## Editing

Edit the files in `public/` directly. (They were once generated from `../kalt-studio/` by `build.sh`;
that script is retired so it can't overwrite later changes.)

The two WebGL scenes use three.js r149 from jsDelivr, pinned in the page's import map; Temple Night was
written against r149. Temple Night loads with the home page (one scene, moved between the hero and the
preview); the orbit loads when its section scrolls near. Without WebGL the orbit hides itself
(the piece grid below it has everything) and the preview keeps its gradient backdrop.

To preview locally, serve `public/` with any static server, e.g. `python3 -m http.server -d public`.
The request form needs the Worker (`npx wrangler dev`); on a plain static server it shows a demo reference.

## Deploying

Cloudflare Workers builds run `npx wrangler deploy` on every push to `main`.
