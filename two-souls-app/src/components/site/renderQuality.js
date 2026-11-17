// More than native resolution on a 1x display, with bounded allocations on large
// screens and mobile GPUs. The multiplier changes only after sustained pressure.
export function getRenderQuality({ width, height, devicePixelRatio = 1, maxTextureSize = 8192, deviceMemory = 8, capture = false, multiplier = 1 }) {
  const w = Math.max(1, width), h = Math.max(1, height);
  const constrained = deviceMemory <= 4 || w < 700;
  const pixelBudget = capture ? 8300000 : constrained ? 3200000 : 5600000;
  const preferred = capture ? 2.5 : Math.max(1.6, Math.min(devicePixelRatio, 2.5));
  const ratio = Math.min(preferred * multiplier, Math.sqrt(pixelBudget / (w * h)), maxTextureSize / Math.max(w, h));
  const pixelRatio = ratio;
  const drawingWidth = Math.max(1, Math.floor(w * pixelRatio));
  const drawingHeight = Math.max(1, Math.floor(h * pixelRatio));
  const refractionScale = constrained ? .8 : .85;
  return {
    pixelRatio,
    drawingWidth,
    drawingHeight,
    refractionWidth: Math.max(1, Math.floor(drawingWidth * refractionScale)),
    refractionHeight: Math.max(1, Math.floor(drawingHeight * refractionScale)),
    pixelBudget,
  };
}

export function createAdaptiveQuality() {
  let multiplier = 1, average = 16.7, warmup = 0, slow = 0, fast = 0, cooldown = 0;
  return {
    get multiplier() { return multiplier; },
    resetTiming() { warmup = 0;slow = 0;fast = 0;average = 16.7; },
    observe(milliseconds) {
      // Long tab/scheduling gaps are not evidence of GPU pressure.
      if (milliseconds <= 0 || milliseconds > 120) return false;
      const dt = milliseconds / 1000;
      warmup += dt;cooldown = Math.max(0, cooldown - dt);
      average += (milliseconds - average) * (1 - Math.exp(-dt * 2));
      if (warmup < 2 || cooldown > 0) return false;
      slow = average > 27 ? slow + dt : 0;
      fast = average < 18.5 ? fast + dt : 0;
      if (slow > 1.8 && multiplier > .65) {
        multiplier = Math.max(.65, multiplier - .1);slow = 0;fast = 0;cooldown = 6;return true;
      }
      if (fast > 10 && multiplier < 1) {
        multiplier = Math.min(1, multiplier + .05);slow = 0;fast = 0;cooldown = 10;return true;
      }
      return false;
    },
  };
}
