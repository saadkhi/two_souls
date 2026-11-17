import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceScroll, mistEnvelope } from '../src/components/site/scrollMotion.js';

test('large scroll jumps accelerate gently, stay bounded and settle at either end', () => {
  const state = { progress: 0, target: 1, velocity: 0 };
  const first = advanceScroll(state, 1 / 60);
  assert.ok(first > 0 && first < .025, 'a scroll jump must not jump the visual pose');
  let previous = first;
  for (let i = 0; i < 120; i++) {
    const value = advanceScroll(state, 1 / 60);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  assert.equal(state.progress, 1);
  state.target = 0;
  for (let i = 0; i < 120; i++) {
    const value = advanceScroll(state, 1 / 60);
    assert.ok(value <= previous && value >= 0);
    previous = value;
  }
  assert.equal(state.progress, 0);
});

test('scroll timing matches across 30, 60 and 120 Hz displays', () => {
  const samples = [30, 60, 120].map(rate => {
    const state = { progress: 0, target: .8, velocity: 0 };
    for (let i = 0; i < rate / 2; i++) advanceScroll(state, 1 / rate);
    return state.progress;
  });
  assert.ok(Math.max(...samples) - Math.min(...samples) < 1e-10);
});

test('reversing mid-scroll stays continuous and a delayed frame cannot skip the story', () => {
  const state = { progress: 0, target: .85, velocity: 0 };
  for (let i = 0; i < 12; i++) advanceScroll(state, 1 / 60);
  const before = state.progress;
  state.target = .1;
  assert.ok(Math.abs(advanceScroll(state, 1 / 60) - before) < .04);
  for (let i = 0; i < 120; i++) advanceScroll(state, 1 / 60);
  assert.equal(state.progress, .1);
  const stalled = { progress: 0, target: 1, velocity: 0 };
  assert.ok(advanceScroll(stalled, 10) < .13);
});

test('mist eases in and out with no hard cutoff and reverses deterministically', () => {
  assert.equal(mistEnvelope(-1), 0);
  assert.equal(mistEnvelope(0), 0);
  assert.equal(mistEnvelope(1), 1);
  assert.equal(mistEnvelope(2.7), 0);
  assert.equal(mistEnvelope(4), 0);
  assert.ok(mistEnvelope(.001) < .0001);
  assert.ok(mistEnvelope(2.699) < .0001);
  const forward = Array.from({ length: 271 }, (_, i) => mistEnvelope(i / 100));
  const backward = Array.from({ length: 271 }, (_, i) => mistEnvelope((270 - i) / 100));
  assert.deepEqual(forward, backward.reverse());
});
