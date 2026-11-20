import { CAMERA_MAP, LENS_MAP, FOCAL_PERSPECTIVE, APERTURE_EFFECT } from '@/vendor/open-generative-ai/promptUtils';
import { SAMPLE_PRODUCTS } from '@/lib/defaults';

// Drives the cinematic boot loader that index.html paints before this bundle runs.
// Progress follows real milestones; the camera readout cycles through Open
// Generative AI's cinema vocabulary, the same one used to compile the film brief.

export const SCENE_READY_EVENT = 'perfume-scene-ready';

const WEIGHTS = { app: .3, fonts: .15, session: .25, scene: .3 };
const MIN_VISIBLE_MS = 1600; // measured from navigation start, so fast loads never just flash
const MAX_WAIT_MS = 9000; // never hold the store hostage to a slow asset
const LOOKS = [
  ['Full-Frame Cine Digital', 'Classic Anamorphic', 50, 'f/1.4'], // the film brief's look; also the final one
  ['Grand Format 70mm Film', 'Warm Cinema Prime', 85, 'f/1.4'],
  ['Modular 8K Digital', 'Premium Modern Prime', 35, 'f/4'],
  ['Classic 16mm Film', 'Halation Diffusion', 50, 'f/1.4'],
  ['Premium Large Format Digital', 'Swirl Bokeh Portrait', 85, 'f/4'],
];

const steps = new Set();
let started = false;

export function markBootStep(step) {
  if (step in WEIGHTS) steps.add(step);
}

const describe = ([camera, lens, focal, aperture]) => ({
  camera: [camera in CAMERA_MAP ? camera : '', lens in LENS_MAP ? lens : '', `${focal}mm`, aperture].filter(Boolean).join(' · ').toUpperCase(),
  look: [FOCAL_PERSPECTIVE[focal], APERTURE_EFFECT[aperture]].filter(Boolean).join(', '),
});

function noteLines() {
  const product = SAMPLE_PRODUCTS.find(item => item.slug === 'noir-oud') ?? SAMPLE_PRODUCTS[0];
  return [['Top', product?.topNotes], ['Heart', product?.heartNotes], ['Base', product?.baseNotes]]
    .filter(([, notes]) => notes?.length)
    .map(([tier, notes]) => [tier, ...notes].join(' · '));
}

export function initBootLoader() {
  const root = document.getElementById('boot-loader');
  if (!root || started) return;
  started = true;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pick = selector => root.querySelector(selector);
  const percent = pick('[data-bl-percent]'), timecode = pick('[data-bl-timecode]');
  const camera = pick('[data-bl-camera]'), look = pick('[data-bl-look]');
  const note = pick('[data-bl-note]'), status = pick('[data-bl-status]');
  const notes = noteLines();

  // Rack focus: blur the readout in and pull it sharp, as a focus puller would.
  const swap = (element, text) => {
    if (!element || element.textContent === text) return;
    element.textContent = text;
    if (reduced) return;
    element.classList.remove('bl-rack');
    void element.offsetWidth;
    element.classList.add('bl-rack');
  };

  markBootStep('app');
  // Only the landing page waits for the WebGL studio lighting.
  if (window.location.pathname !== '/') markBootStep('scene');
  addEventListener(SCENE_READY_EVENT, () => markBootStep('scene'), { once: true });
  (document.fonts?.ready ?? Promise.resolve()).then(() => markBootStep('fonts'), () => markBootStep('fonts'));

  // Hold the page still underneath without hiding its scrollbar: removing the
  // scrollbar later would resize the page at the moment it is revealed.
  const block = event => event.preventDefault();
  const scrollKeys = new Set([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']);
  const keys = event => { if (scrollKeys.has(event.key)) event.preventDefault(); };
  root.addEventListener('wheel', block, { passive: false });
  root.addEventListener('touchmove', block, { passive: false });
  addEventListener('keydown', keys);

  let shown = 0, last = performance.now(), milestoneAt = last, known = steps.size;
  let lookIndex = 0, noteIndex = 0, nextLook = last + 1500, nextNote = last + 2300, frame = 0;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;cancelAnimationFrame(frame);
    swap(camera, describe(LOOKS[0]).camera);
    swap(look, describe(LOOKS[0]).look);
    if (status) status.textContent = 'Two Souls is ready';
    root.classList.add('bl-locked');
    setTimeout(() => {
      root.classList.add('bl-exit');
      setTimeout(() => {
        removeEventListener('keydown', keys);
        root.remove();
      }, reduced ? 350 : 1150);
    }, reduced ? 0 : 520);
  };

  const tick = now => {
    const dt = Math.min(.1, Math.max(0, now - last) / 1000);
    last = now;
    if (steps.size !== known) { known = steps.size; milestoneAt = now; }
    let achieved = 0;
    for (const step of steps) achieved += WEIGHTS[step];
    const complete = achieved > .999 || now > MAX_WAIT_MS;
    // Between milestones the liquid keeps creeping, so the loader never looks stuck.
    const creep = complete ? 0 : .14 * (1 - Math.exp(-(now - milestoneAt) / 2600));
    const goal = complete ? 1 : Math.min(.96, achieved + creep);
    shown += (goal - shown) * (1 - Math.exp(-dt * (complete ? 5 : 2.6)));
    if (complete && 1 - shown < .004) shown = 1;
    root.style.setProperty('--p', shown.toFixed(4));
    const count = String(Math.floor(shown * 100)).padStart(3, '0');
    if (percent && percent.textContent !== count) percent.textContent = count;

    if (timecode) {
      const frames = Math.floor(now / 1000 * 24);
      const pad = value => String(value).padStart(2, '0');
      const code = `00:${pad(Math.floor(frames / 1440) % 60)}:${pad(Math.floor(frames / 24) % 60)}:${pad(frames % 24)}`;
      if (timecode.textContent !== code) timecode.textContent = code;
    }
    if (!reduced && now >= nextLook) {
      lookIndex = (lookIndex + 1) % LOOKS.length;nextLook = now + 1500;
      const text = describe(LOOKS[lookIndex]);
      swap(camera, text.camera);swap(look, text.look);
    }
    if (!reduced && notes.length && now >= nextNote) {
      noteIndex = (noteIndex + 1) % notes.length;nextNote = now + 2300;
      swap(note, notes[noteIndex]);
    }

    if (shown === 1 && now >= MIN_VISIBLE_MS) { finish(); return; }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  // Animation frames can stall (throttled or embedded views); a plain timer still
  // guarantees the store is revealed.
  setTimeout(finish, Math.max(0, MAX_WAIT_MS + 1500 - performance.now()));
  return () => cancelAnimationFrame(frame);
}
