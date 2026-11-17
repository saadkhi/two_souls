# Two Souls cinematic landing

The home route is a centered five-chapter React, Three.js and Anime.js experience. `ScrollExperience.jsx` derives progress from the entire document scroll range, smooths it with a frame-rate-independent spring, and shares that progress with the product scene and text. Scrolling backward reverses the choreography. Pause controls and reduced-motion preferences remain available.

## Three-dimensional product

`createPerfumeBottle.js` builds an actual 3D flacon: bevelled physical glass, a thick base, translucent amber perfume and meniscus, pickup tube, front and rear foil labels, a metal atomizer, and a separate ribbed cap. `PerfumeScene.jsx` renders it under a softbox reflection environment with directional lighting. The bottle rotates through its side and rear views; its visible silhouette, reflections and label perspective come from mesh geometry rather than blended photographs.

The rendering now uses full-alpha physical transmission and separate refractive indices for glass (1.52) and perfume (1.36). `createOpticalRenderer.js` captures the liquid into a linear HDR target before the outer glass refracts it, avoiding the transparent-liquid overlay limitation in Three.js r171. Interior and final passes have separate cameras so their native transmission buffers are not repeatedly reallocated. Tone mapping is applied to the final output. A locally hosted CC0 studio HDRI supplies reflections; a 512-pixel cube capture of procedural softboxes is the fallback. Labels are 1536×1792, with separate foil/roughness maps and subtle cap/metal microtextures.

`renderQuality.js` supersamples ordinary displays at 1.6× and supports up to 2.5× on high-density displays, subject to viewport pixel and GPU texture limits. Sustained slow frames lower resolution gradually; recovery is deliberately slower to avoid flicker. Refraction uses a proportionate HDR target with mipmaps. The yaw track uses monotone Hermite interpolation through intermediate views, while cap/pump/float tracks ease acceleration at their boundaries.

`perfumeChoreography.js` uses Anime.js 4 paused timelines and explicit object keyframes for the turn, tilt, float, cap lift, and nozzle press. Seeking from the shared page clock makes forward and reverse scrolling deterministic. A separate Anime.js atomizer timeline starts from the current pump position when the spray button is pressed. Three.js particles originate at the model's nozzle and fade naturally. The film dialog runs the same 3D choreography on a persistent clock, preserving its position across pause/resume and returning to the same physical pose at each loop.

The photographic concept artwork at `public/media/noir-oud-photographic.png` is retained only as a fallback when WebGL cannot initialize. It is generated concept art, not a photograph of a manufactured product. The old multi-view image assets and rendered MP4 remain in the source archive but are not used by the active 3D scene.

The liquid has its own motion in `liquidMotion.js`. The bottle's world quaternion determines the gravity-relative waterline, while angular motion and pump movement excite a damped slosh and small ripples. Liquid motion continues settling after scroll stops and freezes with the motion control. Quaternion deltas use the shortest rotation, so the film's full-turn loop does not cause an artificial impulse. `liquidGeometry.js` updates the surface, side-wall rim and meniscus together, recalculates reflected-light normals, preserves the area-weighted fill volume, and limits wave height to the glass cavity. This is a lightweight free-surface approximation rather than a general fluid solver.

## Validation

Run `npm run test:cinematic`, then `npm run build`. Tests cover motion continuity, liquid containment/volume, model/material properties, refraction-pass ordering and cleanup, render budgets, and prepared media workflows. These CPU checks do not replace browser-based WebGL visual verification.

## Upstream integration

Open Generative AI source: https://github.com/Anil-matcha/Open-Generative-AI
Reviewed upstream commit: `eeccd4f108c5c19dda0c3650adc2845104082b41`.
The MIT-licensed `src/lib/promptUtils.js` is retained at `src/vendor/open-generative-ai/promptUtils.js`, with its license alongside. `buildNanoBananaPrompt` compiles the downloadable cinematic brief in the film viewer. No hosted AI generation API or API key is required for this scene.

The creator pipeline also integrates Freefield's actual cinema, upscale and frame-interpolation graphs with that prompt compiler. See `docs/MEDIA-PIPELINE.md`. Both source repositories are present in `/workspace/work/`; the selected code/workflows and licenses are included in this project. Prepared bundles are ready for a separately configured Freefield GPU gateway. No GPU generation or AI upscaling was executed for this rendering update.

The repository includes the sample catalog and cinematic assets. Persistent accounts, orders, admin changes, and uploads require the Postgres, Blob, and server-side environment values documented in `docs/VERCEL.md`. Shop, tracking, and policy routes remain linked.
