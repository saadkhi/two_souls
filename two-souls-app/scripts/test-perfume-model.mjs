import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createPerfumeBottle } from '../src/components/site/createPerfumeBottle.js';
import { createLiquidMotion } from '../src/components/site/liquidMotion.js';
import { createPerfumeChoreography } from '../src/components/site/perfumeChoreography.js';

// CPU-only geometry and lifecycle checks. This canvas stub does not rasterize the
// labels, create a WebGL context, or verify the rendered lighting/materials.
function makeModel() {
  const previousDocument = globalThis.document;
  const context = () => ({
    fillRect() {}, strokeRect() {}, fillText() {}, beginPath() {}, moveTo() {},
    lineTo() {}, stroke() {}, measureText: text => ({ width: text.length * 12 }),
  });
  globalThis.document = {
    createElement: name => {
      assert.equal(name, 'canvas');
      return { width: 0, height: 0, getContext: context };
    },
  };
  try {
    return createPerfumeBottle({ capabilities: { getMaxAnisotropy: () => 8 } });
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

test('the flacon has actual depth and product-scale bounds', t => {
  const model = makeModel();t.after(() => model.dispose());
  const size = new THREE.Box3().setFromObject(model.bottle).getSize(new THREE.Vector3());
  assert.ok(size.x > 2 && size.x < 2.2, 'glass body must retain its intended width');
  assert.ok(size.y > 3.7 && size.y < 3.9, 'closed bottle must fit the scene framing');
  assert.ok(size.z > 1 && size.z < 1.2, 'product must have volume, not a flat image plane');
  const shell = model.bottle.getObjectByName('Bevelled crystal shell');
  shell.geometry.computeBoundingBox();
  assert.ok(shell.geometry.boundingBox.max.z - shell.geometry.boundingBox.min.z > 1);
});

test('every mesh has finite geometry within a mobile-friendly triangle budget', t => {
  const model = makeModel();t.after(() => model.dispose());
  let meshes = 0, triangles = 0;
  model.bottle.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    for (const attribute of Object.values(object.geometry.attributes)) {
      assert.ok(attribute.array.every(Number.isFinite), `${object.name} has invalid vertices`);
    }
    const count = object.geometry.index?.count ?? object.geometry.attributes.position.count;
    triangles += count / 3 * (object.isInstancedMesh ? object.count : 1);
  });
  assert.ok(meshes >= 15, 'glass, label, liquid and pump parts must be separate geometry');
  assert.ok(triangles < 20000, `unexpected geometry growth: ${triangles} triangles`);
});

test('cap and pump can move independently without moving the glass body', t => {
  const { bottle, cap, pump, dispose } = makeModel();t.after(dispose);
  assert.equal(cap.parent, bottle);assert.equal(pump.parent, bottle);
  assert.notEqual(cap, pump);
  assert.equal(cap.position.length(), 0);assert.equal(pump.position.length(), 0);
  const shell = bottle.getObjectByName('Bevelled crystal shell');
  const shellBefore = shell.getWorldPosition(new THREE.Vector3());
  const head = pump.getObjectByName('Brushed atomizer head');
  const headBefore = head.getWorldPosition(new THREE.Vector3());
  cap.position.y = 2.4;pump.position.y = -.115;
  bottle.updateMatrixWorld(true);
  assert.ok(shell.getWorldPosition(new THREE.Vector3()).distanceTo(shellBefore) < 1e-10);
  assert.ok(Math.abs(head.getWorldPosition(new THREE.Vector3()).y - headBefore.y + .115) < 1e-10);
  const capBounds = new THREE.Box3().setFromObject(cap);
  const pumpBounds = new THREE.Box3().setFromObject(pump);
  assert.ok(capBounds.min.y > pumpBounds.max.y, 'lifted cap must clear the nozzle');
});

test('rotation exposes real side depth and the nozzle follows the bottle in space', t => {
  const { bottle, pump, nozzlePosition, dispose } = makeModel();t.after(dispose);
  assert.ok(nozzlePosition.y > 1.7 && nozzlePosition.y < 2);
  assert.ok(nozzlePosition.z > .25 && nozzlePosition.z < .3);
  assert.equal(nozzlePosition.x, 0);
  const frontSize = new THREE.Box3().setFromObject(bottle).getSize(new THREE.Vector3());
  bottle.rotation.y = Math.PI / 2;
  bottle.updateMatrixWorld(true);
  const sideSize = new THREE.Box3().setFromObject(bottle).getSize(new THREE.Vector3());
  assert.ok(sideSize.x < frontSize.x * .6, 'the side silhouette must be narrower than the front');
  assert.ok(sideSize.z > frontSize.z * 1.8, 'rotating must exchange width and depth');
  const worldNozzle = pump.localToWorld(nozzlePosition.clone());
  assert.ok(worldNozzle.x > .25 && Math.abs(worldNozzle.z) < 1e-10);
  const sprayDirection = new THREE.Vector3(0, 0, 1).transformDirection(pump.matrixWorld);
  assert.ok(sprayDirection.x > .999, 'spray direction must turn with the atomizer');
});

test('shared geometry, materials and textures are each disposed exactly once', () => {
  const model = makeModel();
  const geometry = new Set(), material = new Set(), texture = new Set();
  model.bottle.traverse(object => {
    if (!object.geometry || !object.material) return;
    geometry.add(object.geometry);
    for (const value of Array.isArray(object.material) ? object.material : [object.material]) {
      material.add(value);
      for (const property of Object.values(value)) if (property?.isTexture) texture.add(property);
    }
  });
  const counts = new Map();
  for (const resource of [...geometry, ...material, ...texture]) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  model.dispose();
  for (const count of counts.values()) assert.equal(count, 1);
  assert.ok(texture.size >= 4, 'front and rear foil labels must be included in cleanup');
});

test('the Anime.js bottle turn actually deforms the rendered liquid and settles level in world space', t => {
  const model = makeModel(), motion = createLiquidMotion(), story = createPerfumeChoreography();
  t.after(() => { model.dispose();story.dispose(); });
  const surface = model.bottle.getObjectByName('Perfume meniscus').geometry;
  const initial = surface.attributes.position.array.slice();
  const quaternion = new THREE.Quaternion();
  let press = 0, floatY = 0, peak = 0;
  const advance = elapsed => {
    model.bottle.getWorldQuaternion(quaternion);
    model.updateLiquid(motion.update(elapsed, { quaternion, press, floatY }));
    const positions = surface.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) peak = Math.max(peak, Math.abs(positions[i] - initial[i]));
  };
  for (let frame = 0; frame <= 180; frame++) {
    const pose = story.sample(frame / 180 * .7);
    model.bottle.rotation.set(pose.pitch, pose.yaw, pose.roll);
    press = pose.press;floatY = pose.floatY;advance(1 / 60);
  }
  assert.ok(peak > .045, `bottle motion must visibly displace the liquid, observed ${peak}`);
  const pausedVertices = surface.attributes.position.array.slice();
  advance(0);
  assert.deepEqual(surface.attributes.position.array, pausedVertices);
  for (let frame = 0; frame < 360; frame++) advance(1 / 60);
  const normal = new THREE.Vector3().fromBufferAttribute(surface.attributes.normal, 0).applyQuaternion(quaternion);
  assert.ok(normal.angleTo(new THREE.Vector3(0, 1, 0)) < .001, 'settled free surface must face world up');
  assert.ok(motion.state.ripple < .00001, 'ripples must decay after the bottle stops');
});
