export const clampProgress = value => Math.max(0, Math.min(1, value));
export const smoothstep = value => {
  const x = clampProgress(value);
  return x * x * (3 - 2 * x);
};

// An analytic, critically damped spring is independent of the display refresh rate.
// It eases both acceleration and settling without introducing a bouncing bottle.
export function advanceScroll(state, elapsed) {
  const dt = Math.max(0, Math.min(elapsed, .05));
  const speed = 12;
  const offset = state.progress - state.target;
  const decay = Math.exp(-speed * dt);
  const change = (state.velocity + speed * offset) * dt;
  state.progress = clampProgress(state.target + (offset + change) * decay);
  state.velocity = (state.velocity - speed * change) * decay;
  if (Math.abs(state.progress - state.target) < .00001 && Math.abs(state.velocity) < .0001) {
    state.progress = state.target;
    state.velocity = 0;
  }
  return state.progress;
}

export function mistEnvelope(age) {
  return smoothstep(age / .35) * (1 - smoothstep((age - 1.25) / 1.45));
}
