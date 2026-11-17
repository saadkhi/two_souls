import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createPerfumeBottle } from '../src/components/site/createPerfumeBottle.js';

// CPU material/shader-contract checks; these do not substitute for WebGL visual QA.
function makeModel() {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    scale() {}, fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, measureText: text => ({ width: text.length * 12 }),
  }) }) };
  try { return createPerfumeBottle({ capabilities: { getMaxAnisotropy: () => 16 } }); }
  finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

test('glass and perfume use optical transmission rather than alpha tint', t => {
  const model = makeModel();t.after(() => model.dispose());
  for (const glass of model.optics.materials) {
    assert.equal(glass.isMeshPhysicalMaterial, true);
    assert.equal(glass.transmission, 1);assert.equal(glass.opacity, 1);
    assert.equal(glass.transparent, false);assert.equal(glass.depthWrite, true);
    assert.equal(glass.ior, 1.52);assert.equal(glass.clearcoat, 0);
    assert.ok(glass.thickness > .1 && glass.thickness < .35);
  }
  const liquid = model.bottle.getObjectByName('Amber perfume volume');
  assert.equal(liquid.material.transmission, 1);
  assert.equal(liquid.material.ior, 1.36);assert.equal(liquid.material.opacity, 1);
  assert.equal(liquid.material.transparent, false);
  assert.ok(liquid.material.attenuationColor.r > liquid.material.attenuationColor.b);
  assert.ok(Number.isFinite(liquid.material.attenuationDistance) && liquid.material.attenuationDistance > 0);
  for (const mesh of model.optics.glassMeshes) assert.ok(mesh.renderOrder > liquid.renderOrder);
});

test('outer glass uses the supplied interior buffer without native-uniform overwrite', t => {
  const model = makeModel();t.after(() => model.dispose());
  const interior = new THREE.Texture(), native = new THREE.Texture();
  t.after(() => { interior.dispose();native.dispose(); });
  model.optics.setInteriorTexture(interior, 1600, 1200);
  const shaders = model.optics.materials.map(material => {
    const shader = {
      uniforms: { transmissionSamplerMap: { value: native }, transmissionSamplerSize: { value: new THREE.Vector2(1, 1) } },
      fragmentShader: '#include <transmission_pars_fragment>\n#include <transmission_fragment>',
    };
    material.onBeforeCompile(shader);
    return shader;
  });
  for (const shader of shaders) {
    assert.equal(shader.uniforms.uInteriorTransmissionMap.value, interior);
    assert.deepEqual(shader.uniforms.uInteriorTransmissionSize.value.toArray(), [1600, 1200]);
    assert.equal(shader.uniforms.transmissionSamplerMap.value, native);
    assert.match(shader.fragmentShader, /uniform sampler2D uInteriorTransmissionMap/);
    assert.match(shader.fragmentShader, /uniform vec2 uInteriorTransmissionSize/);
    assert.doesNotMatch(shader.fragmentShader, /transmissionSamplerMap|transmissionSamplerSize|#include <transmission_pars_fragment>/);
    assert.match(shader.fragmentShader, /volumeAttenuation/);
    assert.match(shader.fragmentShader, /getIBLVolumeRefraction/);
  }
  const resized = new THREE.Texture();t.after(() => resized.dispose());
  model.optics.setInteriorTexture(resized, 2048, 1024);
  for (const shader of shaders) {
    assert.equal(shader.uniforms.uInteriorTransmissionMap.value, resized);
    assert.deepEqual(shader.uniforms.uInteriorTransmissionSize.value.toArray(), [2048, 1024]);
  }
});

test('higher-resolution labels distinguish rough paper from metallic foil', t => {
  const model = makeModel();t.after(() => model.dispose());
  for (const name of ['Embossed gold signature', 'Rear foil label']) {
    const material = model.bottle.getObjectByName(name).material;
    assert.equal(material.map.image.width, 1536);assert.equal(material.map.image.height, 1792);
    assert.notEqual(material.roughnessMap, material.metalnessMap);
    assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(material.roughnessMap.colorSpace, THREE.NoColorSpace);
  }
  const cap = model.bottle.getObjectByName('Sculpted cap').material;
  const atomizer = model.bottle.getObjectByName('Brushed atomizer head').material;
  assert.ok(cap.roughnessMap.isDataTexture && atomizer.roughnessMap.isDataTexture);
  assert.notEqual(cap.roughnessMap, atomizer.roughnessMap);
  assert.ok(cap.bumpScale < .001 && atomizer.bumpScale < .001);
});

test('model cleanup leaves the scene-owned interior render texture alive', () => {
  const model = makeModel(), texture = new THREE.Texture();
  let disposalCount = 0;texture.addEventListener('dispose', () => disposalCount++);
  model.optics.setInteriorTexture(texture, 512, 512);
  model.dispose();
  assert.equal(disposalCount, 0);
  texture.dispose();assert.equal(disposalCount, 1);
});
