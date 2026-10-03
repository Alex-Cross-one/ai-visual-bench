# AI Visual Bench

[Explore the live AI Visual Bench](https://bottle-ocean-benchmark.fizzy-tulip-7700.chatgpt.site)

**Repository status:** this source snapshot does not yet include the original test artifacts. A fresh clone cannot run the full gallery or the artifact-dependent build/tests. The live site may include newer features and data.

A multilingual, prompt-first archive for comparing original AI-generated visual outputs. This source snapshot supports Simplified Chinese, Traditional Chinese, and English.

## App capabilities

The following capabilities require the original test artifacts, which can be explored on the live site but are not included in this repository.

- Two test prompts and 16 model runs in the snapshot manifest, referencing 49 original artifacts
- Live, sandboxed HTML previews and comparison of up to six models
- Model navigation, source viewing, screenshots, original prompts, and token usage
- Anonymous 1–10 community ratings, shared averages, and vote counts backed by a database
- Search, categories, sorting, deep links, and responsive layouts

The datasets described in this snapshot are **Ocean in a Bottle (瓶中沧海)** and **Pelican Riding a Bicycle (鹈鹕骑自行车)**, with eight model runs each. The second dataset did not include its original prompt when this source snapshot was created, and this version labels that explicitly. Original errors are retained as evidence rather than silently repaired.

## Architecture

The interface is plain HTML, CSS, and JavaScript. The backend is a Cloudflare Worker using two bindings:

- `ASSETS`: serves the built static files
- `DB`: a Cloudflare D1 database for ratings and rate limits

The gallery can be inspected as static files, but shared ratings require the Worker and initialized D1 database. GitHub Pages alone does not provide this backend. There are no model-provider API keys or paid model calls in the app.

## Build and test

Use Node.js 22.13 or newer (the backend test suite uses `node:sqlite`) and npm. The complete build and test commands below require the matching `artifacts/` dataset, which is currently absent from this repository.

```sh
npm ci
npm test
npm run build
```

The build writes `dist/client/` and `dist/server/index.js`. It synchronizes runtime data from `assets/manifest.json` and embeds the permitted run IDs in the Worker.

Tests cover artifact hashes and token arithmetic, semantic DOM behavior, localization, six-preview lifecycle and cleanup, rating UI errors, input validation, same-origin protection, database constraints, rate limits, and SQLite durability across reopen. The SQLite adapter tests backend logic; they do not replace a real D1 deployment check. Browser rendering of WebGL scenes also requires a WebGL-capable browser and access to the originals' jsDelivr/unpkg dependencies.

## Deploy your own instance

This repository contains source and migrations, not the original deployment identity or database contents. Use your own Cloudflare account and database. Install Wrangler using its official npm package if needed.

1. Copy `wrangler.example.json` to `wrangler.local.json`.
2. Create a D1 database and replace the example `database_name` and `database_id`. Keep the binding name `DB`, the `ASSETS` binding, and `run_worker_first` enabled.
3. In `server/worker.js`, set `ORIGIN` to your deployment's exact HTTPS origin. This is required for rating writes. For local testing, use the exact origin served by your local Worker and a browser that accepts the secure cookie.
4. Run `npm run build` after changing the origin.
5. Apply the migrations and deploy with your own configuration:

```sh
npx wrangler d1 migrations apply ai-visual-bench --local --config wrangler.local.json
npx wrangler dev --config wrangler.local.json
# After configuring your actual deployment and verifying it:
npx wrangler d1 migrations apply ai-visual-bench --remote --config wrangler.local.json
npx wrangler deploy --config wrangler.local.json
```

Replace `ai-visual-bench` in the migration commands if you chose another database name. The generated migration `drizzle/0000_fair_aqueduct.sql` is immutable once applied; create new migrations for later schema changes. `npm run db:generate` generates migrations from `db/schema.ts` using Drizzle.

The example is a deployment starting point. Review provider pricing, account permissions, your domain, database binding, and operational limits before deploying. The example database ID is deliberately not a usable production ID.

## Ratings and privacy

A random browser identity is stored in a one-year `HttpOnly; Secure; SameSite=Strict` cookie. The database stores its SHA-256 hash, run ID, integer score, and creation/update timestamps. Each browser identity has one editable vote per run. Aggregate APIs return average, count, and that browser's own score, without exposing voter IDs.

The application does not collect an IP address, fingerprint, name, or email. Your hosting provider may maintain its own service logs. There is no account login, analytics integration, or service worker. The language preference is stored locally.

This is anonymous community feedback, not verified one-person-one-vote or a controlled scientific evaluation. Clearing cookies or using another browser creates another identity. The backend limits writes per browser and across the site; these are basic abuse limits, not comprehensive anti-bot protection.

## Artifact fidelity and sandboxing

`assets/manifest.json` records filenames, sizes, and SHA-256 hashes for the 49 original artifacts referenced by this snapshot. The artifact files themselves have not been added to this repository. Private export reports, source archive ZIPs, local paths, credentials, hosting metadata, and actual vote data are excluded.

Live previews use `sandbox="allow-scripts"` without same-origin, popup, form, or navigation privileges. A derived preview wrapper adds a restrictive CSP and error reporting; the original files are unchanged. Direct HTML artifact responses are served as downloads with additional sandbox headers. Keep these server protections when deploying elsewhere.

## Data and project layout

- `assets/manifest.json`: canonical prompt/run/artifact data
- `assets/`: interface, localization, preview lifecycle, and rating client
- `artifacts/`: expected location for original HTML, screenshots, sessions, and prompt; these files are not included in the repository
- `server/worker.js`: static serving and ratings API
- `db/schema.ts`, `drizzle/`: schema and migrations
- `test*.mjs`: automated checks
- `build.mjs`, `sync-data.mjs`: build and data synchronization

See [DATA_FORMAT.md](DATA_FORMAT.md) for adding tests. Routes are `#/`, `#/prompts/<prompt-id>`, and `#/prompts/<prompt-id>/runs/<run-id>`.

## License

No open-source license has been selected for this repository.
