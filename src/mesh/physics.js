export function createSpring(value = 0) {
  return { value: Number(value) || 0, velocity: 0 };
}

export function stepSpring(spring, target, dtMs, options = {}) {
  const dt = Math.min(0.05, Math.max(0.001, (Number(dtMs) || 16) / 1000));
  const stiffness = Number(options.stiffness) || 105;
  const damping = Number(options.damping) || 17;
  const maxVelocity = Number(options.maxVelocity) || 7;
  const acceleration = (Number(target) - spring.value) * stiffness - spring.velocity * damping;
  spring.velocity += acceleration * dt;
  spring.velocity = Math.min(maxVelocity, Math.max(-maxVelocity, spring.velocity));
  spring.value += spring.velocity * dt;
  return spring.value;
}

export function createSecondaryMotionState() {
  return {
    leftTail: createSpring(),
    rightTail: createSpring(),
    skirt: createSpring(),
    bodyLag: createSpring(),
  };
}

export function stepSecondaryMotion(state, input, dtMs) {
  const headX = Number(input?.headX) || 0;
  const bodyZ = Number(input?.bodyZ) || 0;
  const velocityX = Number(input?.velocityX) || 0;
  const breath = Number(input?.breath) || 0;

  stepSpring(state.leftTail, headX * 0.62 + bodyZ * 0.22 + velocityX * 0.42, dtMs, {
    stiffness: 92,
    damping: 14,
    maxVelocity: 9,
  });
  stepSpring(state.rightTail, headX * 0.54 + bodyZ * 0.18 + velocityX * 0.36, dtMs, {
    stiffness: 78,
    damping: 12.5,
    maxVelocity: 9,
  });
  stepSpring(state.skirt, bodyZ * 0.5 + velocityX * 0.25, dtMs, {
    stiffness: 68,
    damping: 13,
    maxVelocity: 6,
  });
  stepSpring(state.bodyLag, headX * 0.2 + breath * 0.08, dtMs, {
    stiffness: 55,
    damping: 15,
    maxVelocity: 4,
  });
  return state;
}
