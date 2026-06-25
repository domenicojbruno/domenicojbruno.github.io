uniform float uProgress;
uniform float uDirection;
uniform float uPulseWidth;
uniform float uTailLength;
uniform float uResidualGlow;
uniform vec3 uColorIdle;
uniform vec3 uColorPulse;
uniform vec3 uColorTip;

varying vec2 vUv;

void main() {
  float u = vUv.x;
  // uDirection flips which side of the head counts as "behind" for the
  // reverse (chip -> CPU) travel direction, where progress decreases.
  float distBehindHead = uDirection * (uProgress - u);
  float absDist = abs(distBehindHead);

  // Sharp leading edge: 1.0 right at the pulse head, falls off within uPulseWidth.
  float edge = 1.0 - smoothstep(0.0, uPulseWidth, absDist);

  // Soft glowing tail behind the head, exponential falloff.
  float tail = distBehindHead > 0.0 ? exp(-distBehindHead / uTailLength) : 0.0;

  // Residual brightness left behind everywhere the pulse has already passed.
  float residual = distBehindHead > 0.0 ? uResidualGlow : 0.0;

  float intensity = clamp(edge + tail, 0.0, 1.0);

  vec3 color = mix(uColorIdle, uColorPulse, tail);
  color = mix(color, uColorTip, edge);

  vec3 finalColor = mix(uColorIdle, color, max(intensity, residual));

  gl_FragColor = vec4(finalColor, 1.0);
}
