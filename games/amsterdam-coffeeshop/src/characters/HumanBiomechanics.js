// Winter (2009) Anthropometric Segment Proportions & Normal Gait Kinematics
// Reference: D.A. Winter, Biomechanics and Motor Control of Human Movement (4th ed.)
export const WINTER_SEGMENTS = {
  footAnkleHeight: 0.039,   // 0.000 -> 0.039 H
  shankLength: 0.246,       // 0.039 -> 0.285 H (ankle to knee)
  thighLength: 0.245,       // 0.285 -> 0.530 H (knee to hip)
  pelvisTorsoLength: 0.288, // 0.530 -> 0.818 H (hip to glenohumeral shoulder)
  neckHeadLength: 0.182,    // 0.818 -> 1.000 H (shoulder to vertex)
  upperArmLength: 0.186,
  forearmLength: 0.146,
  handLength: 0.108,
  shoulderWidthMale: 0.235,
  shoulderWidthFemale: 0.215,
  hipWidthMale: 0.191,
  hipWidthFemale: 0.205
};

export function computeAnthropometry(statureM = 1.76, sex = 'M') {
  const s = WINTER_SEGMENTS;
  return {
    stature: statureM,
    ankleY: s.footAnkleHeight * statureM,
    kneeY: (s.footAnkleHeight + s.shankLength) * statureM,
    hipY: (s.footAnkleHeight + s.shankLength + s.thighLength) * statureM,
    shoulderY: (s.footAnkleHeight + s.shankLength + s.thighLength + s.pelvisTorsoLength) * statureM,
    shankLen: s.shankLength * statureM,
    thighLen: s.thighLength * statureM,
    torsoLen: s.pelvisTorsoLength * statureM,
    headLen: s.neckHeadLength * statureM,
    upperArmLen: s.upperArmLength * statureM,
    forearmLen: s.forearmLength * statureM,
    shoulderHalfW: 0.5 * (sex === 'F' ? s.shoulderWidthFemale : s.shoulderWidthMale) * statureM,
    hipHalfW: 0.5 * (sex === 'F' ? s.hipWidthFemale : s.hipWidthMale) * statureM
  };
}

// Normal Gait Cycle (60% Stance / 40% Swing)
// phase in [0, 2*PI)
export function evaluateGaitKinematics(phase, speedMps = 1.4, statureM = 1.76) {
  const strideLen = Math.max(0.6, 0.78 * statureM);
  const amp = Math.min(1.0, speedMps / 1.45);
  const p = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  function legAngles(ph) {
    // Hip flexion (+ forward, - backward): ~ +28 deg to -14 deg
    const hipFlex = (0.44 * Math.sin(ph) + 0.08 * Math.sin(2 * ph)) * amp;
    // Knee flexion (>= 0, peaks ~62 deg in swing phase when sin(ph) < 0 -> cos(ph) < 0)
    const swingBump = Math.max(0, -Math.cos(ph));
    const stanceYield = Math.max(0, Math.sin(ph)) * 0.14;
    const kneeFlex = (1.06 * Math.pow(swingBump, 1.35) + stanceYield) * amp;
    // Ankle plantar/dorsiflexion
    const anklePitch = (-0.22 * Math.cos(ph) + 0.10 * Math.sin(2 * ph)) * amp;
    return { hipFlex, kneeFlex, anklePitch };
  }

  const left = legAngles(p);
  const right = legAngles((p + Math.PI) % (Math.PI * 2));

  return {
    strideLen,
    pelvisBobY: -0.024 * Math.abs(Math.cos(p)) * amp,
    pelvisYaw: 0.075 * Math.sin(p) * amp,
    thoraxYaw: -0.075 * Math.sin(p) * amp,
    left,
    right,
    armL: { shoulderPitch: -0.36 * Math.sin(p) * amp, elbowFlex: 0.24 + 0.18 * Math.max(0, -Math.sin(p)) * amp },
    armR: { shoulderPitch:  0.36 * Math.sin(p) * amp, elbowFlex: 0.24 + 0.18 * Math.max(0,  Math.sin(p)) * amp }
  };
}
