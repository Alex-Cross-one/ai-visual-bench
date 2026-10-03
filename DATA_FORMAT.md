# Dataset format, version 2

`assets/manifest.json` is the canonical input. `node sync-data.mjs` validates relationships and regenerates `assets/data.js`; `node build.mjs` performs that synchronization automatically. Do not edit `data.js` by hand.

## Collections

- `categories[]`: stable `id`, display `name`, and optional `description`
- `prompts[]`: stable `id`, `title`, `summary`, `categoryId`, `tags[]`, `requirements[]`, exact `promptText`, `promptFile`, `promptArtifact` when supplied (otherwise all three null with `promptStatus: "not_provided"`), source archive name, `coverRunId`, and ordered `runIds[]`
- `runs[]`: globally unique `id`, owning `promptId`, original `model`, `reasoning_effort`, the six original Token fields, `screenshot`, `source`, `session`, nullable `originalError`, and `artifacts[]`

A `promptArtifact` or each run artifact records its original filename, relative `path`, `bytes`, and `sha256`. Run paths must point to original files that have not been modified. `cached_input_tokens` and `reasoning_output_tokens` are subsets, not extra totals.

## Add a real dataset

1. Copy the original prompt and model files byte-for-byte under `artifacts/<prompt-id>/...`. New datasets should use their own directory to prevent filename collisions. The existing bottle-ocean paths remain unchanged for compatibility.
2. Add or reuse the relevant category. Add one test record with the exact prompt text when supplied. If absent, mark it not_provided and use only observed artifact metadata for the title, summary, and tags; never reconstruct a prompt.
3. Add each model output as a run. Use unique IDs, even when the same model appears in multiple prompts or repeated runs. Assign the owning `promptId` and list those run IDs on that prompt only.
4. Choose a real run as the live HTML cover. Preserve and label recorded failures rather than repairing benchmark results. Do not create demonstration records or scores to fill the library.
5. Record byte sizes and SHA-256 hashes. Run synchronization, tests and build, then deploy the resulting application through your own hosting configuration.

The app derives prompt counts, model counts, file counts, categories, search matches and navigation directly from these collections. Comparisons cannot cross prompt boundaries. No new UI component or API route is required. Rebuild the Worker so its permitted run index includes the new runs; shared ratings require the configured database.

## Privacy and execution

Original source previews run automatically when visible in isolated sandbox frames. Explicit Stop and runtime failures suppress automatic restarting. Changing datasets is a maintainer operation; this site does not accept uploads or modify artifacts in the browser.

`rendering: "svg"` identifies self-contained SVG runs; omitted rendering retains the original WebGL label. Optional `execution_time_seconds` is copied only when it exists in original session metadata. It is not inferred from tokens.
