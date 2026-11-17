# Reusable 3D perfume component

`PerfumeBottle.js` contains the bottle model, physical glass and liquid materials, sloshing, studio lighting, mist, and Anime.js choreography in one readable JavaScript module. It exports a standalone bottle and a complete scrolling experience. It uses React, Three.js, and Anime.js; no Tailwind, router, or original website files are required.

## Run the included demo

Use Node.js **20.19+ or 22.12+**.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm run build` for a production build and `npm run preview` to preview it.

## Add it to another React website

1. Copy `PerfumeBottle.js` into your components folder.
2. Copy `public/perfume-assets` into your website's public folder.
3. Install the dependencies below. React and React DOM may already be installed.

```sh
npm install three@0.171.0 animejs@4.5.0
```

Keep your website's existing React version (18 or newer). The included demo supplies React and React DOM 18.2. Keep **Three.js at 0.171.0**: the glass refraction implementation uses that version's shader internals. The `.js` component already has its JSX compiled, so it does not need a special JSX loader.

### Complete scrolling experience

```jsx
import { PerfumeExperience } from './components/PerfumeBottle.js';

export default function Page() {
  return <PerfumeExperience />;
}
```

The bottle stays centered while the page scrolls, rotates, lifts its cap, sprays, and sloshes. Text chapters fade between scenes. Pause and spray controls are included. Five chapters and a `500svh` section height are provided by default. Progress follows the entire document, including content before or after this component. Avoid placing the story inside an ancestor with `overflow: hidden/auto` if you want it to stick to the browser viewport.

Customize the text with one or more chapters:

```jsx
<PerfumeExperience
  height="500svh"
  chapters={[
    { eyebrow: 'THE FRAGRANCE', title: 'An unforgettable presence.', description: 'Discover Noir Oud.' },
    { eyebrow: 'THE DETAILS', title: 'Made to linger.', description: 'Warm woods, amber, and oud.' },
    { eyebrow: 'THE RITUAL', title: 'One final touch.', description: 'Experience the fine mist.' },
  ]}
/>
```

`PerfumeExperience` also accepts `assetBaseUrl`, `environmentUrl`, `fallbackImageUrl`, `className`, and `style`.

### Standalone bottle

```jsx
import PerfumeBottle from './components/PerfumeBottle.js';

// Automatic 12-second loop in a normal page section.
<PerfumeBottle style={{ height: 600, borderRadius: 24 }} />

// Follow the entire document's scroll, with the bottle fixed in the viewport.
<PerfumeBottle
  scroll
  style={{ position: 'fixed', inset: 0, height: '100svh', pointerEvents: 'none' }}
/>

// Drive the pose from your own timeline, slider, or scroll library.
<PerfumeBottle progress={0.6} />
```

For the fixed example, add your own scrollable page content and layer text above the bottle. Use `PerfumeExperience` if you want that layout included.

| Bottle prop | Default | Purpose |
| --- | --- | --- |
| `progress` | Unset | Controlled position from `0` to `1`; changes ease internally. Takes priority over `scroll`. |
| `scroll` | `false` | Bind animation to the entire document's scroll. With neither `progress` nor `scroll`, the animation loops. |
| `paused` | `false` | Pause motion. |
| `sprayTrigger` | `0` | Increment to request a manual spray. It waits until the cap is clear; sprays have a 2.7-second cooldown. |
| `onSprayChange` | Unset | Receives the manual spray's busy state. Automatic scroll spraying is not reported here. |
| `onProgress` | Unset | Receives displayed, smoothed progress. Use a ref or direct style updates instead of calling React `setState` every frame. |
| `onReady` | Unset | Receives `true` after the first 3D render; `false` while initializing or using the static fallback. |
| `assetBaseUrl` | `/perfume-assets` | Public directory containing the supplied assets. |
| `environmentUrl` | From asset directory | Override the HDR studio environment URL; `null` uses procedural studio lighting only. |
| `fallbackImageUrl` | From asset directory | Override the fallback image URL; `null` disables the image. |
| `respectReducedMotion` | `true` | Respect the visitor's reduced-motion preference. |
| `className`, `style` | Unset | Customize the container. Its default height is `600px`. |
| `ariaLabel` | Built-in description | Accessible description of the scene. |

Manual spray example:

```jsx
import { useState } from 'react';
import PerfumeBottle from './components/PerfumeBottle.js';

export default function ProductPreview() {
  const [spray, setSpray] = useState(0);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PerfumeBottle
        progress={0.72}
        sprayTrigger={spray}
        onSprayChange={setBusy}
      />
      <button disabled={busy} onClick={() => setSpray(value => value + 1)}>
        {busy ? 'Spraying…' : 'Spray perfume'}
      </button>
    </>
  );
}
```

## Next.js

The component module includes `'use client'`. Import it from your App Router page or a client component. If your wrapper uses hooks or callback props, put `'use client'` at the top of that wrapper too. Copy assets to your application's `public/perfume-assets` directory.

## Assets and rendering

- `studio-small-03-2k.hdr`: the full-resolution 2K studio environment. Its CC0 attribution and source are in `public/perfume-assets/STUDIO-LICENSE.md`.
- `noir-oud-photographic.png`: the supplied product illustration used when WebGL cannot initialize.
- Labels, surface textures, bottle geometry, and mist are generated by the component.

No GPU server, ComfyUI installation, API key, or AI service is needed. Rendering uses the visitor's browser and requires **WebGL 2**. Resolution adjusts to screen size and sustained rendering performance. The supplied HDR image improves reflections; procedural studio lighting remains available if it cannot load.

When WebGL is unavailable, the fallback image stays visible and the text story still follows scrolling. Reduced-motion preferences stop the automatic loop and mist, and scroll-driven poses change without easing. The bottle artwork retains the Two Souls / Noir Oud label; edit `createLabelTextures` in the component file to change the branding.

For a subdirectory deployment, set `assetBaseUrl` to its public path, for example `/shop/perfume-assets`. For externally hosted assets, use URLs served with appropriate cross-origin access headers. If you do not want any image requests, pass `environmentUrl={null}` and `fallbackImageUrl={null}`.
