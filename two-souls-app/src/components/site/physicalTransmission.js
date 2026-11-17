import { ShaderChunk, Vector2 } from 'three';

// Three r171's native transmission buffer excludes other transmissive objects.
// Give the outer glass a separately rendered interior buffer, retaining Three's
// Fresnel, rough refraction and Beer-Lambert attenuation implementation.
export function createInteriorTransmission(materials) {
  const textureUniform = { value: null };
  const sizeUniform = { value: new Vector2(1, 1) };
  const transmission = ShaderChunk.transmission_pars_fragment
    .replaceAll('transmissionSamplerMap', 'uInteriorTransmissionMap')
    .replaceAll('transmissionSamplerSize', 'uInteriorTransmissionSize');

  for (const material of materials) {
    material.onBeforeCompile = shader => {
      shader.uniforms.uInteriorTransmissionMap = textureUniform;
      shader.uniforms.uInteriorTransmissionSize = sizeUniform;
      shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_pars_fragment>', transmission);
    };
    material.customProgramCacheKey = () => 'two-souls-interior-transmission-r171-v1';
    material.needsUpdate = true;
  }
  return {
    setInteriorTexture(texture, width, height) {
      textureUniform.value = texture;
      sizeUniform.value.set(Math.max(1, width), Math.max(1, height));
    },
  };
}
