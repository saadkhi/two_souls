# Perfume media pipeline

The project integrates Open Generative AI's cinematic prompt compiler with Freefield's real ComfyUI workflow manifests. This is a creator asset pipeline; the live landing remains an interactive Three.js and Anime.js scene. The pipeline can prepare image generation, video generation, image/video upscaling and frame interpolation jobs without a GPU. Executing those jobs requires a separately configured Freefield backend.

## What is integrated

- Open Generative AI: `buildNanoBananaPrompt`, camera/lens/focal/aperture vocabulary, already vendored at `src/vendor/open-generative-ai/promptUtils.js`.
- Freefield: the actual `cinema-studio`, `cinema-video`, `upscale`, `upscale-video`, and `smooth` app manifests and API workflow graphs, plus upstream value resolution and binding logic.
- Project glue: `scripts/media-pipeline.mjs` validates inputs, applies a deterministic seed, resolves the real graph node bindings, exports all required assets, and can delegate execution to the upstream Freefield CLI.

No GPU job, AI enhancement, or generated media output is implied by a prepared bundle. The command prints that distinction and records `generated: false` in `requirements.json`. Changes to the live WebGL resolution and motion are independent of this offline media pipeline.

## Prepare a bundle offline

From the perfume project directory:

```bash
node scripts/media-pipeline.mjs prepare --app cinema-studio --seed 221 --focal 50 --aperture f/4 --set resolution=2
node scripts/media-pipeline.mjs prepare --app cinema-video --seed 221 --set duration=5
node scripts/media-pipeline.mjs prepare --app upscale --file image=public/media/noir-oud-photographic.png --set scale=2
node scripts/media-pipeline.mjs prepare --app upscale-video --file clip=public/films/noir-oud.mp4
node scripts/media-pipeline.mjs prepare --app smooth --file clip=public/films/noir-oud.mp4 --set factor=2 --set mode=true
```

Default output is `.output/media-pipeline/<app>`, which is ignored by Git. Set `--out /absolute/path` to choose another directory. Inputs with spaces must be quoted, for example `--file 'clip=/path/my clip.mp4'`.

Available cinematic flags are `--prompt`, `--camera`, `--lens`, `--focal`, `--aperture`, and `--seed`. The defaults describe the Two Souls bottle, a full-frame cinema camera, a Premium Modern Prime lens at 50 mm, f/4, soft cross lighting, and an emerald/gold palette. `--set name=value` handles other manifest inputs; select values must match their manifest options. Upstream multiple selects accept JSON lists. The seed defaults to 221 and must be a fixed nonnegative integer, so repeated preparations produce the same workflow.

Each bundle contains:

- `job.json`: resolved inputs, input asset hashes, workflow hash and exact source provenance.
- `workflow.api.json`: the actual Freefield graph with prompts, choices and file names bound to node inputs.
- `app.json`: the selected upstream manifest.
- `requirements.json`: model files, model licenses, input limits and backend requirements.
- `cinematic-brief.txt` for cinematic apps, compiled with Open Generative AI.
- `assets/` for source media copied into the bundle.

The graph's file inputs use the bundled asset names. When importing it directly into a ComfyUI backend, copy those assets to its input area or use that backend's upload mechanism. The project's run command performs uploads through Freefield's SDK path instead.

## Execute later with a GPU backend

Both repositories are cloned in the workspace:

- `/workspace/work/open-generative-ai`
- `/workspace/work/freefield`

Freefield's runner needs Node 22.6 or newer and its npm dependencies installed in that checkout. Its `COMFY_BASE_URL` must point to a **Comfy API v2 gateway/proxy**, not directly to bare ComfyUI on port 8188. The backend must have the selected app's custom nodes and model pack installed. Freefield documents local GPU and Modal setup in its README.

Configure `COMFY_BASE_URL`, optional `FREEFIELD_TOKEN`, and optional `FREEFIELD_ROOT` in the process environment or an ignored local environment file. Tokens are never included in the prepared bundle, command-line arguments, or frontend build. Avoid `VITE_` variables for credentials.

```bash
# Install runner dependencies once in the cloned Freefield checkout.
cd /workspace/work/freefield
npm install

# Return to this project. Read backend values from your ignored local file.
cd /workspace/work/perfume
node --env-file=.env.media.local scripts/media-pipeline.mjs run --bundle .output/media-pipeline/smooth
```

An example ignored `.env.media.local` has these names; fill them locally with your own configured backend:

```dotenv
COMFY_BASE_URL=https://your-freefield-gateway.example
FREEFIELD_TOKEN=
FREEFIELD_ROOT=/workspace/work/freefield
```

Execution uses Freefield's upstream `server/cli.ts` with subprocess argument arrays. It validates the bundle and assets first, verifies the selected upstream app/workflow still matches the pinned files, and writes returned media to `<bundle>/results` unless `--out` is supplied. The live website is not automatically changed by AI output: review a generated asset before integrating or publishing it. No backend is configured in this workspace, so execution has been tested using an injected mock runner only.

## GPU and model requirements

Freefield's `upscale` and `upscale-video` apps use SeedVR2 (approximately 4 GB of weights, Apache-2.0). `smooth` uses FILM frame interpolation (approximately 0.07 GB of weights, Apache-2.0). Runtime VRAM depends on input resolution and video length. These cannot run merely by increasing WebGL render resolution.

`cinema-studio` uses FLUX3 and its accompanying text encoder/VAE under the FLUX Kommunity License. `cinema-video` combines those assets with LTX models under the LTX Community License; it is a substantially larger GPU workflow. The exact files and licenses are retained in the upstream manifests and every prepared bundle. Repository code is MIT; model weight licenses are separate.

## Provenance and validation

Open Generative AI source: https://github.com/Anil-matcha/Open-Generative-AI
Pinned compiler source commit: `eeccd4f108c5c19dda0c3650adc2845104082b41` (`src/lib/promptUtils.js`).

Freefield source: https://github.com/neuregex/freefield
Pinned app/binder source commit: `f3d32ce2e3128c58bb2fe38c8942edf87cdb2e4c` (`apps/*`, `server/runner.ts`, file-input predicate from `server/registry.ts`). MIT notices are retained under `src/vendor/`.

Run `node --test scripts/test-media-pipeline.mjs`. Tests cover compiled prompt settings, actual node bindings, reproducible bundles, input validation, absent-backend errors, asset/workflow integrity, safe subprocess argument handling and token redaction. They do not claim successful GPU inference.
