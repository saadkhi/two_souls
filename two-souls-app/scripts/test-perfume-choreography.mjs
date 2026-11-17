import assert from 'node:assert/strict';
import test from 'node:test';
import { createPerfumeChoreography, createAtomizerChoreography, createChapterChoreography, PERFUME_STORY_DURATION } from '../src/components/site/perfumeChoreography.js';

const close = (actual, expected, epsilon = .0001) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} should be close to ${expected}`);

test('Anime.js story makes a full turn and closes at the same physical pose', () => {
  const story = createPerfumeChoreography();
  const start = { ...story.sample(0) };
  assert.equal(story.timeline.duration, PERFUME_STORY_DURATION);
  assert.ok(story.sample(.42).yaw > Math.PI, 'the bottle must reveal its back in real 3D');
  assert.ok(story.sample(.72).yaw > Math.PI * 2, 'the movement must complete the turn');
  const end = { ...story.sample(1) };
  close(end.yaw - start.yaw, Math.PI * 2);
  for (const property of ['pitch', 'roll', 'floatY', 'capLift', 'press']) close(end[property], start[property]);
  story.dispose();
});

test('arbitrary reverse seeks produce the same pose without changing the playback clock', () => {
  const story = createPerfumeChoreography();
  const samples = [.12, .3, .43, .56, .625, .675, .86, .94];
  const forward = samples.map(progress => ({ ...story.sample(progress) }));
  story.sample(1);
  for (let i = samples.length - 1; i >= 0; i--) {
    const pose = story.sample(samples[i]);
    for (const property of Object.keys(pose)) close(pose[property], forward[i][property]);
  }
  assert.equal(story.timeline.paused, true);
  story.dispose();
});

test('cap clears the atomizer before it presses and returns only after release', () => {
  const story = createPerfumeChoreography();
  close(story.sample(.3).capLift, 0);
  close(story.sample(.54).capLift, 1);
  close(story.sample(.54).press, 0);
  close(story.sample(.6).press, 1);
  close(story.sample(.71).press, 0);
  close(story.sample(.8).capLift, 1);
  assert.ok(story.sample(.92).capLift > 0 && story.pose.capLift < 1);
  story.dispose();
});

test('pose stays restrained and continuous over the entire scroll', () => {
  const story = createPerfumeChoreography();
  let previous = { ...story.sample(0) };
  for (let i = 1; i <= 1000; i++) {
    const pose = story.sample(i / 1000);
    assert.ok(Math.abs(pose.pitch) <= .09);
    assert.ok(Math.abs(pose.roll) <= .07);
    assert.ok(Math.abs(pose.floatY) <= .08);
    assert.ok(Math.abs(pose.yaw - previous.yaw) < .025);
    assert.ok(pose.capLift >= 0 && pose.capLift <= 1);
    assert.ok(pose.press >= 0 && pose.press <= 1);
    previous = { ...pose };
  }
  story.dispose();
});

test('the turn carries continuous velocity through views instead of stopping at every keyframe', () => {
  const story = createPerfumeChoreography(), h = .00001;
  for (const progress of [.2, .42, .59]) {
    const before = story.sample(progress - h).yaw;
    const at = story.sample(progress).yaw;
    const after = story.sample(progress + h).yaw;
    const arriving = (at - before) / h, departing = (after - at) / h;
    assert.ok(arriving > 2 && departing > 2, 'intermediate product views must remain in motion');
    close(arriving, departing, .002);
  }
  let previous = story.sample(0).yaw;
  for (let i = 1; i <= 1000; i++) {
    const progress = i / 1000, value = story.sample(progress).yaw;
    assert.ok(progress <= .72 ? value >= previous : value <= previous, 'interpolation must not add extra reversals');
    previous = value;
  }
  const startVelocity = (story.sample(h).yaw - story.sample(0).yaw) / h;
  const endVelocity = (story.sample(1).yaw - story.sample(1 - h).yaw) / h;
  assert.ok(Math.abs(startVelocity) < .001 && Math.abs(endVelocity) < .001, 'the film loop must start and end at rest');
  story.dispose();
});

test('cap and atomizer settle with negligible acceleration at their resting boundaries', () => {
  const story = createPerfumeChoreography(), h = .00001;
  for (const [property, progress, direction] of [
    ['capLift', .34, 1], ['capLift', .51, -1], ['capLift', .84, 1], ['capLift', 1, -1],
    ['press', .54, 1], ['press', .59, -1], ['press', .64, 1], ['press', .7, -1],
  ]) {
    const at = story.sample(progress)[property];
    const near = story.sample(progress + h * direction)[property];
    const further = story.sample(progress + h * direction * 2)[property];
    const acceleration = Math.abs(further - 2 * near + at) / (h * h);
    assert.ok(acceleration < 6, `${property} should ease acceleration at ${progress}, observed ${acceleration}`);
  }
  story.dispose();
});

test('manual press starts from the current nozzle position and settles without a snap', () => {
  const atomizer = createAtomizerChoreography(.65);
  close(atomizer.sample(0).press, .65);
  close(atomizer.sample(.18).press, 1);
  close(atomizer.sample(.3).press, 1);
  close(atomizer.sample(.65).press, 0);
  close(atomizer.sample(3).press, 0);
  close(atomizer.sample(-1).press, .65);
  assert.equal(atomizer.timeline.paused, true);
  atomizer.dispose();
});

test('sampled Anime.js timelines stay still until their shared clock advances', async () => {
  const story = createPerfumeChoreography();
  const before = { ...story.sample(.48) };
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(story.pose, before);
  assert.equal(story.timeline.paused, true);
  story.dispose();
});

test('Anime.js chapter fades remain complementary and retain the first and last chapters', () => {
  const chapters = createChapterChoreography();
  close(chapters.sample(0)[0].opacity, 1);
  for (let i = 0; i <= 1000; i++) {
    const states = chapters.sample(i / 1000);
    close(states.reduce((sum, state) => sum + state.opacity, 0), 1, .0002);
    assert.ok(states.every(state => state.opacity >= 0 && state.opacity <= 1));
    assert.ok(states.every(state => state.shift >= -10 && state.shift <= 10));
  }
  close(chapters.sample(1)[4].opacity, 1);
  close(chapters.states[4].shift, 0);
  chapters.dispose();
});

test('chapter crossfades and heading shifts reverse deterministically at every boundary', () => {
  const chapters = createChapterChoreography();
  const positions = [.17, .2, .225, .37, .4, .425, .57, .6, .625, .77, .8, .825];
  const forward = positions.map(progress => chapters.sample(progress).map(state => ({ opacity: state.opacity, shift: state.shift })));
  chapters.sample(1);
  for (let i = positions.length - 1; i >= 0; i--) {
    chapters.sample(positions[i]).forEach((state, index) => {
      close(state.opacity, forward[i][index].opacity);
      close(state.shift, forward[i][index].shift);
    });
  }
  assert.equal(chapters.timeline.paused, true);
  chapters.dispose();
});
