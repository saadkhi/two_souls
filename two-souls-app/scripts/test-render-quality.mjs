import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { getRenderQuality, createAdaptiveQuality } from '../src/components/site/renderQuality.js';
import { createOpticalRenderer } from '../src/components/site/createOpticalRenderer.js';

test('rendering is sharper on standard and retina displays without exceeding pixel budgets', () => {
  const standard = getRenderQuality({ width: 1440, height: 900, devicePixelRatio: 1 });
  assert.ok(standard.pixelRatio > 1.5);
  const retina = getRenderQuality({ width: 1440, height: 900, devicePixelRatio: 2 });
  assert.ok(retina.pixelRatio >= 2);
  for (const [width, height, devicePixelRatio, maxTextureSize] of [[390, 844, 3, 4096], [3840, 2160, 2, 8192], [8000, 5000, 3, 2048]]) {
    const quality = getRenderQuality({ width, height, devicePixelRatio, maxTextureSize });
    assert.ok(quality.drawingWidth * quality.drawingHeight <= quality.pixelBudget);
    assert.ok(quality.drawingWidth <= maxTextureSize && quality.drawingHeight <= maxTextureSize);
    assert.ok(quality.refractionWidth > 0 && quality.refractionWidth < quality.drawingWidth);
  }
});

test('adaptive resolution ignores isolated stalls and lowers quality only under sustained pressure', () => {
  const quality = createAdaptiveQuality();
  for (let i = 0; i < 300; i++) quality.observe(16.67);
  quality.observe(5000);quality.observe(70);
  assert.equal(quality.multiplier, 1);
  for (let i = 0; i < 180; i++) quality.observe(35);
  assert.ok(quality.multiplier < 1 && quality.multiplier >= .65);
  const lower = quality.multiplier;
  for (let i = 0; i < 240; i++) quality.observe(16.67);
  assert.equal(quality.multiplier, lower, 'resolution must not oscillate after a short recovery');
  for (let i = 0; i < 1500; i++) quality.observe(16.67);
  assert.ok(quality.multiplier > lower && quality.multiplier <= 1);
});

function fixture(fail = false) {
  const glassMeshes = [{ visible: true }, { visible: false }], calls = [], bound = {};
  const original = { name: 'original target' };
  let target = original;
  const renderer = {
    extensions: { has: () => true }, capabilities: { maxSamples: 4 }, toneMapping: THREE.ACESFilmicToneMapping,
    getRenderTarget: () => target, setRenderTarget: value => { target = value; }, clear() {},
    render(scene, camera) {
      calls.push({ target, camera: camera.id, toneMapping: this.toneMapping, visibility: glassMeshes.map(mesh => mesh.visible) });
      if (fail) throw new Error('capture failed');
    },
  };
  const camera = new THREE.PerspectiveCamera(34, 1.6, .1, 60);
  const optics = { glassMeshes, setInteriorTexture(texture, width, height) { Object.assign(bound, { texture, width, height }); } };
  return { renderer, camera, optics, calls, bound, original };
}

test('nested refraction captures the liquid in linear HDR before rendering the outer glass', () => {
  const f = fixture(), pass = createOpticalRenderer(f.renderer, new THREE.Scene(), f.camera, f.optics);
  pass.resize(1200, 800);pass.render();pass.render();
  assert.equal(f.bound.texture.type, THREE.HalfFloatType);
  assert.equal(f.bound.texture.colorSpace, THREE.LinearSRGBColorSpace);
  assert.equal(f.bound.texture.generateMipmaps, true);
  assert.equal(f.bound.texture.minFilter, THREE.LinearMipmapLinearFilter);
  assert.deepEqual([f.bound.width, f.bound.height], [1200, 800]);
  assert.deepEqual(f.calls[0].visibility, [false, false]);
  assert.equal(f.calls[0].toneMapping, THREE.NoToneMapping);
  assert.equal(f.calls[0].target.texture, f.bound.texture);
  assert.notEqual(f.calls[0].camera, f.camera.id);
  assert.equal(f.calls[0].camera, f.calls[2].camera, 'interior camera must remain stable to reuse native refraction buffers');
  assert.deepEqual(f.calls[1].visibility, [true, false]);
  assert.equal(f.calls[1].target, f.original);
  assert.equal(f.calls[1].toneMapping, THREE.ACESFilmicToneMapping);
  let disposed = false;f.calls[0].target.addEventListener('dispose', () => { disposed = true; });
  pass.dispose();assert.equal(disposed, true);
});

test('a failed interior capture restores the renderer and original mesh visibility', () => {
  const f = fixture(true), pass = createOpticalRenderer(f.renderer, new THREE.Scene(), f.camera, f.optics);
  assert.throws(() => pass.render(), /capture failed/);
  assert.deepEqual(f.optics.glassMeshes.map(mesh => mesh.visible), [true, false]);
  assert.equal(f.renderer.getRenderTarget(), f.original);
  assert.equal(f.renderer.toneMapping, THREE.ACESFilmicToneMapping);
  pass.dispose();
});
