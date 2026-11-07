/**
 * Shared GLSL for custom filters. The engine forces the WebGL renderer, so GLSL (ES 3) only.
 * The vertex shader is Pixi v8's default filter vertex + `vUv` (0..1 across the filter area).
 */
export const FILTER_VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vUv;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
  vUv = aPosition;
}
`;
