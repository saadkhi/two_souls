import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiquidGeometry, LIQUID_BOUNDS } from '../src/components/site/liquidGeometry.js';

// CPU geometry checks: these inspect the actual vertices and triangles, but do
// not replace browser verification of transparency, refraction or highlights.
function makeLiquid(t) {
  const liquid = createLiquidGeometry();
  t.after(() => {
    liquid.surface.dispose();liquid.volume.dispose();liquid.waterline.dispose();
  });
  return liquid;
}

function signedVolume(geometry) {
  const positions = geometry.attributes.position.array;
  const indices = geometry.index.array;
  let sum = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    sum += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      + positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  return sum / 6;
}

function surfaceIntegral(geometry) {
  const positions = geometry.attributes.position.array;
  const indices = geometry.index.array;
  let area = 0, heightIntegral = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const triangleArea = Math.abs((positions[b] - positions[a]) * (positions[c + 2] - positions[a + 2])
      - (positions[c] - positions[a]) * (positions[b + 2] - positions[a + 2])) / 2;
    area += triangleArea;
    heightIntegral += triangleArea * (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
  }
  return { area, mean: heightIntegral / area };
}

const motions = [
  { slopeX: .11, slopeZ: -.09, ripple: .025, time: .3 },
  { slopeX: -.17, slopeZ: .22, ripple: .04, time: 1.1 },
  { slopeX: 0, slopeZ: 0, ripple: .07, time: 2.7 },
  { slopeX: 800, slopeZ: -1300, ripple: 900, time: 550 },
];

test('the liquid surface deforms while its footprint and floor remain fixed', t => {
  const liquid = makeLiquid(t);
  const surfaceBefore = liquid.surface.attributes.position.array.slice();
  const wallsBefore = liquid.volume.attributes.position.array.slice();
  liquid.updateSurface(motions[0]);
  const surfaceAfter = liquid.surface.attributes.position.array;
  const wallsAfter = liquid.volume.attributes.position.array;
  let movingSurfaceVertices = 0, movingWallVertices = 0;
  for (let i = 0; i < surfaceAfter.length; i += 3) {
    assert.equal(surfaceAfter[i], surfaceBefore[i]);
    assert.equal(surfaceAfter[i + 2], surfaceBefore[i + 2]);
    if (Math.abs(surfaceAfter[i + 1] - surfaceBefore[i + 1]) > .001) movingSurfaceVertices++;
  }
  for (let i = 0; i < wallsAfter.length; i += 3) {
    assert.equal(wallsAfter[i], wallsBefore[i]);
    assert.equal(wallsAfter[i + 2], wallsBefore[i + 2]);
    if (Math.abs(wallsBefore[i + 1] - LIQUID_BOUNDS.bottom) < 1e-6) {
      assert.equal(wallsAfter[i + 1], wallsBefore[i + 1], 'the liquid floor must not tilt with the free surface');
    } else if (Math.abs(wallsAfter[i + 1] - wallsBefore[i + 1]) > .001) movingWallVertices++;
  }
  assert.ok(movingSurfaceVertices > surfaceAfter.length / 6, 'a visible part of the actual surface must move');
  assert.ok(movingWallVertices > 20, 'the top of the walls must follow the moving surface');
});

test('surface, wall tops and meniscus share a watertight moving rim', t => {
  const liquid = makeLiquid(t);
  const segments = liquid.waterline.attributes.position.count;
  const outerStart = liquid.surface.attributes.position.count - segments;
  for (const motion of motions) {
    liquid.updateSurface(motion);
    const top = liquid.surface.attributes.position, walls = liquid.volume.attributes.position, rim = liquid.waterline.attributes.position;
    for (let i = 0; i < segments; i++) {
      for (const axis of ['X', 'Y', 'Z']) {
        assert.equal(top[`get${axis}`](outerStart + i), walls[`get${axis}`](i), 'top and side must meet without a crack');
      }
      assert.equal(rim.getX(i), walls.getX(i));assert.equal(rim.getZ(i), walls.getZ(i));
      assert.ok(Math.abs(rim.getY(i) - walls.getY(i) - .001) < 1e-7, 'meniscus must track the surface with only its intended highlight offset');
    }
  }
});

test('slopes and ripples conserve the signed volume of the closed liquid mesh', t => {
  const liquid = makeLiquid(t);
  const initial = signedVolume(liquid.surface) + signedVolume(liquid.volume);
  assert.ok(initial > 2, 'outward triangle winding must produce positive product-scale volume');
  for (const motion of [...motions, {}, { slopeX: -.8, slopeZ: .9, ripple: .5, time: 4.3 }]) {
    liquid.updateSurface(motion);
    const current = signedVolume(liquid.surface) + signedVolume(liquid.volume);
    const { area, mean } = surfaceIntegral(liquid.surface);
    assert.ok(Math.abs(current - initial) < 2e-7, 'the liquid amount must stay constant during deformation');
    assert.ok(Math.abs(mean - LIQUID_BOUNDS.level) < 8e-8, 'area-weighted fill level must remain constant');
    assert.ok(Math.abs(current - area * (LIQUID_BOUNDS.level - LIQUID_BOUNDS.bottom)) < 2e-7);
  }
});

test('surface normals face upward and respond to waves without becoming invalid', t => {
  const liquid = makeLiquid(t);
  const initial = liquid.surface.attributes.normal.array.slice();
  for (let i = 0; i < initial.length; i += 3) {
    assert.ok(initial[i + 1] > .999, 'resting surface triangles must face upward');
  }
  liquid.updateSurface(motions[2]);
  const moving = liquid.surface.attributes.normal.array;
  let changed = 0;
  for (let i = 0; i < moving.length; i += 3) {
    assert.ok(Number.isFinite(moving[i]) && Number.isFinite(moving[i + 1]) && Number.isFinite(moving[i + 2]));
    assert.ok(moving[i + 1] > 0, 'surface must keep its upward-facing winding');
    assert.ok(Math.abs(Math.hypot(moving[i], moving[i + 1], moving[i + 2]) - 1) < 1e-6);
    if (Math.abs(moving[i]) + Math.abs(moving[i + 2]) > .03) changed++;
  }
  assert.ok(changed > moving.length / 6, 'reflection normals must change across the rippling surface');
  assert.ok(liquid.volume.attributes.normal.array.every(Number.isFinite));
});

test('extreme inputs remain contained and their geometry stays inside culling bounds', t => {
  const liquid = makeLiquid(t);
  for (const motion of motions) {
    liquid.updateSurface(motion);
    for (const geometry of [liquid.surface, liquid.volume, liquid.waterline]) {
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
        assert.ok(Math.abs(x) <= LIQUID_BOUNDS.width / 2 + 1e-7);
        assert.ok(Math.abs(z) <= LIQUID_BOUNDS.depth / 2 + 1e-7);
        assert.ok(y >= LIQUID_BOUNDS.bottom - 1e-7);
        assert.ok(y <= LIQUID_BOUNDS.level + LIQUID_BOUNDS.excursion + .0011);
        assert.ok(x >= geometry.boundingBox.min.x - 1e-7 && x <= geometry.boundingBox.max.x + 1e-7);
        assert.ok(y >= geometry.boundingBox.min.y - 1e-7 && y <= geometry.boundingBox.max.y + 1e-7);
        assert.ok(z >= geometry.boundingBox.min.z - 1e-7 && z <= geometry.boundingBox.max.z + 1e-7);
      }
    }
  }
});
