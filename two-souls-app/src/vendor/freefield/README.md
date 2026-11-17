# Freefield integration sources

Source: https://github.com/neuregex/freefield
Pinned commit: `f3d32ce2e3128c58bb2fe38c8942edf87cdb2e4c`
License: MIT, copyright (c) 2026 Sammir Femat (neuregex); see `LICENSE`.

The five `apps/*/app.json` and `workflow.api.json` pairs are copied unchanged from that revision: `cinema-studio`, `cinema-video`, `upscale`, `upscale-video`, and `smooth`.

`bindings.js` adapts the dependency-free value resolution, coercion, template expansion and workflow input binding portion of `server/runner.ts`. TypeScript annotations were removed and the file-input predicate from `server/registry.ts` was inlined. The Comfy SDK, registry loader, GPU gateway and job execution code are not bundled into the website.

The project CLI at `scripts/media-pipeline.mjs` uses these functions and actual workflows to prepare reproducible media jobs. Its optional run mode delegates to Freefield's own CLI in a separate checkout. No AI inference runs in the static landing page. Model weights are not included, and their individual licenses remain listed in each app manifest and prepared `requirements.json`.
