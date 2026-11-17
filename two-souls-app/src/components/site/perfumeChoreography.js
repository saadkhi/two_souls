import { createTimeline } from 'animejs';

export const PERFUME_STORY_DURATION = 10000;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smootherstep = value => value * value * value * (value * (value * 6 - 15) + 10);

// PCHIP's harmonic tangents keep the turn monotone between poses while carrying
// velocity through intermediate views. Endpoints and direction changes still rest.
function continuousEases(points) {
  const intervals = points.slice(1).map(([time], i) => time - points[i][0]);
  const slopes = intervals.map((duration, i) => (points[i + 1][1] - points[i][1]) / duration);
  const tangents = points.map(() => 0);
  for (let i = 1; i < points.length - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) continue;
    const before = intervals[i - 1], after = intervals[i];
    const w1 = 2 * after + before, w2 = after + 2 * before;
    tangents[i] = (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]);
  }
  return intervals.map((duration, i) => {
    const distance = points[i + 1][1] - points[i][1];
    if (distance === 0) return smootherstep;
    const start = tangents[i] * duration / distance;
    const end = tangents[i + 1] * duration / distance;
    return t => {
      const square = t * t, cube = square * t;
      return (3 * square - 2 * cube) + start * (cube - 2 * square + t) + end * (cube - square);
    };
  });
}

// Explicit from/to values make arbitrary forward and reverse seeks deterministic.
// Every track shares the page's existing clock; Anime.js never starts a second RAF.
function addTrack(timeline, pose, property, points, motion = 'fade') {
  const eases = motion === 'continuous' ? continuousEases(points) : null;
  timeline.add(pose, {
    [property]: points.slice(1).map(([time, value], index) => ({
      from: points[index][1],
      to: value,
      duration: time - points[index][0],
      ease: eases ? eases[index] : motion === 'settle' ? smootherstep : 'inOutSine',
    })),
  }, 0);
}

export function createPerfumeChoreography() {
  const pose = { yaw: -.22, pitch: 0, roll: 0, floatY: 0, capLift: 0, press: 0 };
  const timeline = createTimeline({ autoplay: false });

  addTrack(timeline, pose, 'yaw', [
    [0, -.22], [2000, .6], [4200, 3.5], [5900, 5.9],
    [7200, 6.65], [PERFUME_STORY_DURATION, Math.PI * 2 - .22],
  ], 'continuous');
  addTrack(timeline, pose, 'pitch', [
    [0, 0], [2200, .065], [4200, -.045], [5900, .035],
    [7400, -.025], [PERFUME_STORY_DURATION, 0],
  ], 'settle');
  addTrack(timeline, pose, 'roll', [
    [0, 0], [2000, -.045], [4200, .055], [5900, -.03],
    [7400, .025], [PERFUME_STORY_DURATION, 0],
  ], 'settle');
  addTrack(timeline, pose, 'floatY', [
    [0, 0], [2500, .07], [5000, -.035], [7500, .045],
    [PERFUME_STORY_DURATION, 0],
  ], 'settle');
  addTrack(timeline, pose, 'capLift', [
    [0, 0], [3400, 0], [5100, 1], [8400, 1], [PERFUME_STORY_DURATION, 0],
  ], 'settle');
  addTrack(timeline, pose, 'press', [
    [0, 0], [5400, 0], [5900, 1], [6400, 1], [7000, 0],
    [PERFUME_STORY_DURATION, 0],
  ], 'settle');

  timeline.seek(0, true);
  return {
    pose,
    timeline,
    sample(progress) {
      timeline.seek(clamp(progress, 0, 1) * PERFUME_STORY_DURATION, true);
      return pose;
    },
    dispose() { timeline.revert(); },
  };
}

export function createAtomizerChoreography(startPress = 0) {
  const pose = { press: clamp(startPress, 0, 1) };
  const timeline = createTimeline({ autoplay: false });
  addTrack(timeline, pose, 'press', [
    [0, pose.press], [180, 1], [320, 1], [650, 0],
  ], 'settle');
  timeline.seek(0, true);
  return {
    pose,
    timeline,
    sample(ageSeconds) {
      timeline.seek(clamp(ageSeconds * 1000, 0, 650), true);
      return pose;
    },
    dispose() { timeline.revert(); },
  };
}

export function createChapterChoreography(count = 5) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('Chapter count must be a positive integer');
  const states = Array.from({ length: count }, (_, index) => ({ opacity: index === 0 ? 1 : 0, shift: index === 0 ? 0 : 10 }));
  const timeline = createTimeline({ autoplay: false });
  const width = Math.min(.09, .8 / count);

  states.forEach((state, index) => {
    const opacity = [[0, state.opacity]];
    const shift = [[0, state.shift]];
    if (index > 0) {
      const enter = index / count;
      const start = (enter - width / 2) * PERFUME_STORY_DURATION;
      const end = (enter + width / 2) * PERFUME_STORY_DURATION;
      opacity.push([start, 0], [end, 1]);
      shift.push([start, 10], [end, 0]);
    }
    if (index < count - 1) {
      const leave = (index + 1) / count;
      const start = (leave - width / 2) * PERFUME_STORY_DURATION;
      const end = (leave + width / 2) * PERFUME_STORY_DURATION;
      opacity.push([start, 1], [end, 0]);
      shift.push([start, 0], [end, -10]);
    }
    opacity.push([PERFUME_STORY_DURATION, index === count - 1 ? 1 : 0]);
    shift.push([PERFUME_STORY_DURATION, index === count - 1 ? 0 : -10]);
    addTrack(timeline, state, 'opacity', opacity);
    addTrack(timeline, state, 'shift', shift);
  });

  timeline.seek(0, true);
  return {
    states,
    timeline,
    sample(progress) {
      timeline.seek(clamp(progress, 0, 1) * PERFUME_STORY_DURATION, true);
      return states;
    },
    dispose() { timeline.revert(); },
  };
}
