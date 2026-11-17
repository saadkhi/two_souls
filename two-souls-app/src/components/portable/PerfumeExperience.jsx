'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PerfumeBottle from './PerfumeBottle.jsx';
import { createChapterChoreography } from '../site/perfumeChoreography.js';

const defaultChapters = [
  { eyebrow: 'TWO HEARTS. ONE FRAGRANCE.', title: 'Some things are felt.', description: 'A fragrance that speaks before you do.' },
  { eyebrow: '01 / THE FIRST IMPRESSION', title: 'A quiet beginning.', description: 'A composition that unfolds, one note at a time.' },
  { eyebrow: '02 / AT THE HEART', title: 'Depth. Without words.', description: 'Oud resin. Warm woods. An intimate accord.' },
  { eyebrow: '03 / THE RELEASE', title: 'One press. A world unfolds.', description: 'A fine mist. A fleeting moment. An unmistakable presence.' },
  { eyebrow: '04 / THE LASTING IMPRESSION', title: 'The moment passes. You remain.', description: 'Your own signature, long after the moment has passed.' },
];

// Scoped selectors keep the component independent of the host website's CSS.
const styles = `
[data-perfume-experience] { color: #efe8d9; background: #0b100e; isolation: isolate; font-family: Arial, sans-serif; }
[data-perfume-experience] *, [data-perfume-experience] *::before, [data-perfume-experience] *::after { box-sizing: border-box; }
[data-perfume-experience] .ts-perfume-stage { position: sticky; top: 0; height: 100svh; overflow: hidden; }
[data-perfume-experience] .ts-perfume-copy { position: absolute; z-index: 2; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 6vw; width: 35%; pointer-events: none; }
[data-perfume-experience] .ts-perfume-eyebrow { color: #c0a77b; font-size: 10px; letter-spacing: .19em; line-height: 1.6; margin: 0 0 20px; }
[data-perfume-experience] .ts-perfume-title { font-family: Georgia, serif; font-size: clamp(30px, 3.4vw, 60px); font-weight: 400; line-height: 1.06; letter-spacing: -.04em; margin: 0 0 24px; }
[data-perfume-experience] .ts-perfume-description { color: #b7bcb6; font-size: 14px; line-height: 1.7; margin: 0; }
[data-perfume-experience] .ts-perfume-controls { position: absolute; z-index: 3; left: 6vw; right: 6vw; bottom: 24px; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 10px; letter-spacing: .12em; }
[data-perfume-experience] .ts-perfume-controls button { appearance: none; font: inherit; letter-spacing: inherit; color: inherit; background: #101a14; border: 1px solid #72715c; padding: 12px 16px; cursor: pointer; border-radius: 0; line-height: 1.4; }
[data-perfume-experience] .ts-perfume-controls button:disabled { opacity: .5; cursor: default; }
[data-perfume-experience] .ts-perfume-controls button:focus-visible { outline: 2px solid #e2caa0; outline-offset: 4px; }
[data-perfume-experience] .ts-perfume-scroll-label { margin-right: auto; }
[data-perfume-experience] .ts-perfume-progress { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; z-index: 4; background: #ffffff12; }
[data-perfume-experience] .ts-perfume-progress > span { display: block; height: 100%; background: #c0a77b; transform: scaleX(0); transform-origin: left; }
@media (max-width: 760px) {
  [data-perfume-experience] .ts-perfume-copy { width: 100%; justify-content: flex-start; padding: 7vh 7vw 0; background: linear-gradient(#0b100ed9, transparent 45%); }
  [data-perfume-experience] .ts-perfume-title { max-width: 75%; font-size: clamp(30px, 7vw, 44px); margin-bottom: 10px; }
  [data-perfume-experience] .ts-perfume-eyebrow { margin-bottom: 12px; }
  [data-perfume-experience] .ts-perfume-description { max-width: 85%; font-size: 12px; }
  [data-perfume-experience] .ts-perfume-scroll-label { display: none; }
  [data-perfume-experience] .ts-perfume-controls { justify-content: center; }
}
`;

/** Optional ready-made scroll story. Progress follows the whole document. */
export default function PerfumeExperience({
  chapters = defaultChapters, height = '500svh', assetBaseUrl,
  environmentUrl, fallbackImageUrl, className, style,
}) {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    throw new RangeError('PerfumeExperience needs at least one chapter.');
  }
  const elements = useRef([]);
  const bar = useRef(null);
  const animation = useRef(null);
  const currentProgress = useRef(0);
  const [paused, setPaused] = useState(false);
  const [spray, setSpray] = useState(0);
  const [busy, setBusy] = useState(false);
  const [canSpray, setCanSpray] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);

  const update = useCallback(progress => {
    currentProgress.current = progress;
    const states = animation.current?.sample(progress);
    elements.current.forEach((element, index) => {
      if (!element || !states?.[index]) return;
      const pose = states[index];
      const visible = pose.opacity > .001;
      element.style.opacity = String(pose.opacity);
      element.style.visibility = visible ? 'visible' : 'hidden';
      element.style.transform = `translateY(${pose.shift}px)`;
      element.setAttribute('aria-hidden', String(index !== Math.min(chapters.length - 1, Math.floor(progress * chapters.length))));
    });
    if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
    // This updates React only at the cap-open boundaries, not every animation frame.
    setCanSpray(progress >= .51 && progress <= .84);
  }, [chapters.length]);

  useEffect(() => {
    animation.current = createChapterChoreography(chapters.length);
    update(currentProgress.current);
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    change();query.addEventListener('change', change);
    return () => { animation.current.dispose();animation.current = null;query.removeEventListener('change', change); };
  }, [chapters.length, update]);

  return <section data-perfume-experience="" className={className} aria-label="Perfume story" style={{ position: 'relative', height, ...style }}>
    <style>{styles}</style>
    <div className="ts-perfume-stage">
      <PerfumeBottle scroll paused={paused} sprayTrigger={spray} onSprayChange={setBusy} onProgress={update} onReady={setRendererReady}
        assetBaseUrl={assetBaseUrl} environmentUrl={environmentUrl} fallbackImageUrl={fallbackImageUrl}
        style={{ height: '100%', width: '100%' }}/>
      {chapters.map((chapter, index) => <article key={index} className="ts-perfume-copy"
        ref={element => { elements.current[index] = element; }} aria-hidden={index !== 0}
        style={{ opacity: index === 0 ? 1 : 0, visibility: index === 0 ? 'visible' : 'hidden' }}>
        <p className="ts-perfume-eyebrow">{chapter.eyebrow}</p>
        <h2 className="ts-perfume-title">{chapter.title}</h2>
        <p className="ts-perfume-description">{chapter.description}</p>
      </article>)}
      <div className="ts-perfume-controls">
        <span className="ts-perfume-scroll-label">SCROLL TO DISCOVER</span>
        <button type="button" disabled={!rendererReady || !canSpray || busy || reduced} onClick={() => { setPaused(false);setSpray(value => value + 1); }}
          title={!rendererReady ? 'Spray needs a WebGL-capable browser' : reduced ? 'Spray animation is disabled by your reduced motion preference' : !canSpray ? 'Scroll until the cap lifts to spray' : undefined}>
          {busy ? 'RELEASING FRAGRANCE…' : 'PRESS TO SPRAY'}
        </button>
        <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'RESUME MOTION' : 'PAUSE MOTION'}</button>
      </div>
      <div className="ts-perfume-progress" aria-hidden="true"><span ref={bar}/></div>
    </div>
  </section>;
}
