import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Quaternion, Vector3 } from 'three';
import { createLiquidMotion } from '../src/components/site/liquidMotion.js';

const orientation = (x = 0, y = 0, z = 0) => new Quaternion().setFromEuler(new Euler(x, y, z));
const advance = (motion, seconds, pose, rate = 60) => {
  for (let i = 0; i < seconds * rate; i++) motion.update(1 / rate, pose);
  return motion.state;
};

test('still liquid stays level without an artificial idle wave', () => {
  const motion = createLiquidMotion();
  advance(motion, 4, { quaternion: orientation() });
  assert.equal(motion.state.slopeX, 0);assert.equal(motion.state.slopeZ, 0);assert.equal(motion.state.ripple, 0);
});

test('the resting waterline counter-rotates into world gravity after a bottle tilt', () => {
  const motion = createLiquidMotion();
  motion.update(1 / 60, { quaternion: orientation() });
  const quaternion = orientation(.09, .8, -.08);
  advance(motion, 4, { quaternion });
  const normal = new Vector3(-motion.state.slopeX, 1, -motion.state.slopeZ).normalize().applyQuaternion(quaternion);
  assert.ok(normal.angleTo(new Vector3(0, 1, 0)) < .0001);
});

test('turning and reversing excite a bounded slosh which settles after motion stops', () => {
  const motion = createLiquidMotion();
  motion.update(1 / 60, { quaternion: orientation() });
  for (let i = 1; i <= 60; i++) motion.update(1 / 60, { quaternion: orientation(0, i / 60, 0) });
  const forward = { ...motion.state };
  assert.ok(forward.slopeZ > .03);assert.ok(forward.ripple > .003);
  for (let i = 1; i <= 60; i++) motion.update(1 / 60, { quaternion: orientation(0, 1 - i / 60, 0) });
  assert.ok(motion.state.slopeZ < -.03);
  assert.ok(Math.abs(motion.state.slopeX) <= .2 && Math.abs(motion.state.slopeZ) <= .2 && motion.state.ripple <= .035);
  advance(motion, 5, { quaternion: orientation() });
  assert.ok(Math.abs(motion.state.slopeX) < .00001 && Math.abs(motion.state.slopeZ) < .00001);
  assert.ok(motion.state.ripple < .00001);
});

test('equivalent quaternion signs and full-turn film wraps do not create impulses', () => {
  const motion = createLiquidMotion();
  const a = orientation(0, Math.PI * 2 - .22, 0);
  const b = orientation(0, -.22, 0);
  motion.update(1 / 60, { quaternion: a });
  for (let i = 0; i < 30; i++) motion.update(1 / 60, { quaternion: i % 2 ? a : b });
  assert.ok(Math.abs(motion.state.slopeX) < 1e-9 && Math.abs(motion.state.slopeZ) < 1e-9);
  assert.ok(motion.state.ripple < 1e-9);
});

test('liquid response is consistent across normal display refresh rates', () => {
  const samples = [30, 60, 120].map(rate => {
    const motion = createLiquidMotion();motion.reset({ quaternion: orientation() });
    for (let i = 1; i <= rate; i++) motion.update(1 / rate, { quaternion: orientation(.04 * i / rate, i / rate, -.03 * i / rate) });
    return { ...motion.state };
  });
  for (const key of ['slopeX', 'slopeZ', 'ripple']) {
    assert.ok(Math.max(...samples.map(value => value[key])) - Math.min(...samples.map(value => value[key])) < .002, key);
  }
});

test('a paused frame freezes state and previous inputs, then resumes identically', () => {
  const paused = createLiquidMotion(), control = createLiquidMotion();
  const initial = { quaternion: orientation() };
  paused.update(1 / 60, initial);control.update(1 / 60, initial);
  const before = { ...paused.state };
  paused.update(0, { quaternion: orientation(.2, 2, .2), press: 1, floatY: .5 });
  assert.deepEqual(paused.state, before);
  const next = { quaternion: orientation(0, .01, 0) };
  assert.deepEqual(paused.update(1 / 60, next), control.update(1 / 60, next));
});

test('a pump press creates a small ripple that decays, and long frames stay finite', () => {
  const motion = createLiquidMotion(), quaternion = orientation();
  motion.update(1 / 60, { quaternion, press: 0 });
  motion.update(1 / 60, { quaternion, press: 1 });
  assert.ok(motion.state.ripple > .01 && motion.state.ripple <= .035);
  advance(motion, 5, { quaternion, press: 1 });
  assert.ok(motion.state.ripple < .00001);
  motion.update(8, { quaternion: orientation(1.55, 4, 1.5), press: 0 });
  assert.ok(Object.values(motion.state).every(Number.isFinite));
  assert.ok(Math.abs(motion.state.slopeX) <= .2 && Math.abs(motion.state.slopeZ) <= .2);
});
