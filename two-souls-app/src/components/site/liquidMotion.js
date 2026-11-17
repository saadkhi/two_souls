import { Quaternion, Vector3 } from 'three';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MAX_SLOPE = .2;
const MAX_RIPPLE = .035;

/**
 * A small free-surface response model, driven by the bottle's actual world pose.
 * Gravity provides the resting waterline; angular motion excites a damped slosh.
 * It is deliberately bounded to keep the liquid inside the flacon cavity.
 */
export function createLiquidMotion() {
  const state = { slopeX: 0, slopeZ: 0, ripple: 0, time: 0 };
  const current = new Quaternion(), previous = new Quaternion(), inverse = new Quaternion(), delta = new Quaternion();
  const localUp = new Vector3();
  let initialized = false, velocityX = 0, velocityZ = 0, previousPress = 0, previousFloatY = 0;

  const readPose = pose => {
    current.copy(pose?.quaternion ?? new Quaternion()).normalize();
    inverse.copy(current).invert();
    localUp.set(0, 1, 0).applyQuaternion(inverse);
    const denominator = Math.max(.25, localUp.y);
    return {
      slopeX: clamp(-localUp.x / denominator, -MAX_SLOPE, MAX_SLOPE),
      slopeZ: clamp(-localUp.z / denominator, -MAX_SLOPE, MAX_SLOPE),
    };
  };

  const rememberPose = pose => {
    previous.copy(current);
    previousPress = clamp(pose?.press ?? 0, 0, 1);
    previousFloatY = pose?.floatY ?? 0;
  };

  return {
    state,
    update(elapsed, pose = {}) {
      // Pausing is a complete freeze, including the inputs used for velocity.
      const dt = clamp(Number.isFinite(elapsed) ? elapsed : 0, 0, .05);
      if (dt === 0) return state;
      const gravity = readPose(pose);
      if (!initialized) {
        state.slopeX = gravity.slopeX;state.slopeZ = gravity.slopeZ;
        rememberPose(pose);initialized = true;state.time += dt;
        return state;
      }

      // q and -q describe the same rotation. Take the shortest delta so film loops
      // and quaternion sign changes never create a fictitious full-turn impulse.
      delta.copy(previous).invert().multiply(current).normalize();
      if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
      const sinHalf = Math.hypot(delta.x, delta.y, delta.z);
      const scale = sinHalf > 1e-8 ? 2 * Math.atan2(sinHalf, delta.w) / (sinHalf * dt) : 0;
      const omegaX = clamp(delta.x * scale, -8, 8);
      const omegaY = clamp(delta.y * scale, -8, 8);
      const omegaZ = clamp(delta.z * scale, -8, 8);
      const targetX = clamp(gravity.slopeX - omegaZ * .065 + omegaY * .04, -MAX_SLOPE, MAX_SLOPE);
      const targetZ = clamp(gravity.slopeZ + omegaX * .065 + omegaY * .075, -MAX_SLOPE, MAX_SLOPE);

      const press = clamp(pose.press ?? 0, 0, 1);
      const pumpImpulse = Math.abs(press - previousPress);
      const floatSpeed = Math.abs((pose.floatY ?? 0) - previousFloatY) / dt;
      const agitation = Math.hypot(omegaX, omegaY, omegaZ) * .017 + Math.min(floatSpeed, 1) * .015;
      // Pump movement adds a small impulse rather than a perpetual idle wave.
      state.ripple = clamp(state.ripple + pumpImpulse * .014, 0, MAX_RIPPLE);
      velocityX += pumpImpulse * .025;velocityZ -= pumpImpulse * .045;

      const steps = Math.ceil(dt * 120), step = dt / steps;
      for (let i = 0; i < steps; i++) {
        velocityX += ((targetX - state.slopeX) * 46 - velocityX * 6) * step;
        velocityZ += ((targetZ - state.slopeZ) * 46 - velocityZ * 6) * step;
        state.slopeX += velocityX * step;state.slopeZ += velocityZ * step;
        // At a safety boundary, discard outward momentum instead of allowing a spill.
        if (Math.abs(state.slopeX) > MAX_SLOPE) {state.slopeX = clamp(state.slopeX, -MAX_SLOPE, MAX_SLOPE);velocityX = 0;}
        if (Math.abs(state.slopeZ) > MAX_SLOPE) {state.slopeZ = clamp(state.slopeZ, -MAX_SLOPE, MAX_SLOPE);velocityZ = 0;}
        const decay = Math.exp(-2.8 * step);
        state.ripple = clamp(state.ripple * decay + agitation / 2.8 * (1 - decay), 0, MAX_RIPPLE);
      }
      state.time += dt;rememberPose(pose);
      return state;
    },
    reset(pose) {
      state.slopeX = 0;state.slopeZ = 0;state.ripple = 0;state.time = 0;
      velocityX = 0;velocityZ = 0;previousPress = 0;previousFloatY = 0;initialized = false;
      if (pose) {
        const gravity = readPose(pose);
        state.slopeX = gravity.slopeX;state.slopeZ = gravity.slopeZ;
        rememberPose(pose);initialized = true;
      }
      return state;
    },
  };
}
