# AGENTS.md

## Commands

```bash
npm install                       # dev dependencies only (wrangler, @playwright/test)
npx playwright install chromium   # once, before the first e2e run
npm start                         # wrangler dev on http://localhost:40451
npm test                          # unit tests (node:test): mastery, scheduler, store, backups, i18n, version
npm run test:e2e                  # Playwright, desktop and mobile
npm run deploy                    # unit tests, then wrangler deploy
```

Workers Builds (Worker settings, Builds) deploys pushes to `main` with an empty build command and
`npm run deploy` as the deploy command; other branches run `npm test` only. Playwright is not part of
the deploy gate: the Workers Builds image cannot start Chromium (no root, no system libraries). Run
`npm run test:e2e` locally before pushing UI changes.

`allowScripts` in `package.json` pins the `esbuild` and `workerd` versions whose install scripts npm
may run. Update it when a Wrangler upgrade changes those versions.

## Versions

- `APP_VERSION` in `public/js/home.js` is the version shown in the footer, starting at 1.00.
- `CACHE` in `public/sw.js` names the service worker cache and carries the same number
  (`divide-and-conquer-v1.00`). Changing it makes installed copies drop the old cache.
- Bump both together on a user-visible release and whenever `SHELL` or the caching rules change.
  `npm test` fails if they differ.

## Architecture

A static site on a Cloudflare Worker with static assets only (`wrangler.jsonc`, custom domain
`divideconquer.tinkered.app`). No server code, no database, no accounts. `public/index.html` with
`public/js/home.js` is the hub: learner picker, session length, backup, restore, delete. Each
activity is a folder under `public/` with its own `index.html`, `js/` and `css/`.

It is a private, non-commercial hobby project. Learner data never leaves the browser; requests reach
only the host (Cloudflare), which is why it needs no terms, provider details or cookie banner. Accounts,
a backend storing user data, analytics, ads, payments or any third-party request would change that and
need a new legal check first (`audyt-prawny-pl` skill; the shared publisher profile is in
`C:\GIT Repos\.tinkered-legal\`). The footer credit "Divide & Conquer vX.XX by Kuba · tinkered.app ·
Privacy" links Kuba to `mailto:kuba@tinkered.app`, tinkered.app to `https://tinkered.app` and Privacy to
`privacy.html`. The tinkered.app logo is inlined in `public/index.html`, so nothing loads from another
origin.

`public/privacy.html` is the GDPR Art. 13 note, built from the shared template in `.tinkered-legal`.
Its hosting, email and rights sections are fixed text from that template; edit only the lead and the
table of what the app stores in the browser, and keep that table in step with `localStorage` keys and
the cache name (`npm test` checks the cache name). `public/js/privacy.js` shows the article for the
current language. The page is `noindex` (meta tag and `X-Robots-Tag` in `_headers`).

## Conventions

- **Data:** learner data lives in `localStorage` under `divide-and-conquer-data`, accessed only through
  [store.js](public/js/store.js) (global `STORE`). Pages redirect to `/` when `STORE.current()` is
  `null`. Fact types: `multiplication` (factorA, factorB), `division` (dividend, divisor),
  `missingFactor` (factorA, product). Everything read from storage or a backup file goes through the
  validators in `store.js`.
- **Backups:** `STORE.exportData()` / `STORE.importData()` define the file format
  (`app: 'divide-and-conquer'`, `version: 1`). Changing stored fields means bumping the version and
  keeping older files importable.
- **Theme:** `public/js/theme.js` loads in `<head>` and sets `data-theme` on `<html>`. Colours are
  tokens in `public/css/style.css`, with the dark set under `:root[data-theme="dark"]`. Never hardcode a
  colour in a page, stylesheet or script; the `theme-color` meta tags, the flag SVGs and the blue of the
  tinkered.app logo are the only exceptions.
- **Translations:** UI strings live in `public/js/translations.js` with matching `pl` and `en` keys.
  `tests/i18n.test.js` lists every page and checks that HTML fallback text matches the English
  catalogue and that no string contains a long dash.
- **PWA:** `public/sw.js` precaches the `SHELL` list so every page works offline, even one the learner
  has never opened. Any file a page loads (HTML, CSS, JS, fonts, icons) must be in `SHELL`; files used
  only at install time, such as the maskable icon, do not need to be. Pages, scripts and styles are
  network-first, fonts and images cache-first.
- **Security headers:** `public/_headers` sets a strict CSP (`script-src 'self'`): no inline scripts,
  no external origins. Inline styles are allowed.

## Adding an activity

Create `public/<name>/index.html` with `js/` and `css/`, copying the `<head>` block and the
`/js/pwa.js` script tag from an existing page. Add a tile to `public/index.html`, the page to
`tests/i18n.test.js`, its files to `SHELL` in `sw.js`, and a fact type to `store.js` if it records
answers.
