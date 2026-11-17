import * as THREE from 'three';

export const LIQUID_BOUNDS = { width: 1.77, depth: .78, bottom: -1.15, level: .98, excursion: .18 };

// A closed, rounded tank volume: fixed walls and bottom, with a deformable free surface.
// The same edge heights drive the side walls, surface and meniscus highlight.
export function createLiquidGeometry() {
  const { width, depth, bottom, level, excursion } = LIQUID_BOUNDS;
  const radius = .085, cornerSteps = 12, rings = 10;
  const outline = [];
  const corners = [[width / 2 - radius, depth / 2 - radius], [-width / 2 + radius, depth / 2 - radius], [-width / 2 + radius, -depth / 2 + radius], [width / 2 - radius, -depth / 2 + radius]];
  corners.forEach(([cx, cz], corner) => {
    for (let i = 0; i <= cornerSteps; i++) {
      const angle = (corner + i / cornerSteps) * Math.PI / 2;
      outline.push([cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius]);
    }
  });
  // Uniform edge samples let the waterline ripple along the flat walls as well
  // as the rounded corners. Corner-only vertices would leave long, rigid edges.
  const lengths = outline.map((point, index) => {
    const next = outline[(index + 1) % outline.length];
    return Math.hypot(next[0] - point[0], next[1] - point[1]);
  });
  const circumference = lengths.reduce((sum, length) => sum + length, 0);
  const segments = 96, perimeter = [];
  let edge = 0, distance = 0;
  for (let i = 0; i < segments; i++) {
    const target = i * circumference / segments;
    while (edge < lengths.length - 1 && distance + lengths[edge] < target) distance += lengths[edge++];
    const fraction = (target - distance) / lengths[edge];
    const a = outline[edge], b = outline[(edge + 1) % outline.length];
    perimeter.push([a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction]);
  }
  const surfacePositions = new Float32Array((1 + rings * segments) * 3);
  surfacePositions[1] = level;
  for (let ring = 1; ring <= rings; ring++) {
    for (let i = 0; i < segments; i++) {
      const index = 1 + (ring - 1) * segments + i;
      surfacePositions[index * 3] = perimeter[i][0] * ring / rings;
      surfacePositions[index * 3 + 1] = level;
      surfacePositions[index * 3 + 2] = perimeter[i][1] * ring / rings;
    }
  }
  const surfaceIndices = [];
  for (let i = 0; i < segments; i++) surfaceIndices.push(0, 1 + (i + 1) % segments, 1 + i);
  for (let ring = 2; ring <= rings; ring++) {
    const inner = 1 + (ring - 2) * segments, outer = inner + segments;
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      surfaceIndices.push(inner + i, inner + next, outer + i, inner + next, outer + next, outer + i);
    }
  }
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.BufferAttribute(surfacePositions, 3).setUsage(THREE.DynamicDrawUsage));
  surface.setIndex(surfaceIndices);

  // Area weights remove the mean displacement, preserving the liquid volume exactly
  // for the triangulated surface, including non-uniform ripple patterns.
  const weights = new Float64Array(surfacePositions.length / 3);
  let area = 0;
  for (let i = 0; i < surfaceIndices.length; i += 3) {
    const a = surfaceIndices[i], b = surfaceIndices[i + 1], c = surfaceIndices[i + 2];
    const ax = surfacePositions[a * 3], az = surfacePositions[a * 3 + 2];
    const triangleArea = Math.abs((surfacePositions[b * 3] - ax) * (surfacePositions[c * 3 + 2] - az) - (surfacePositions[c * 3] - ax) * (surfacePositions[b * 3 + 2] - az)) / 2;
    weights[a] += triangleArea / 3;weights[b] += triangleArea / 3;weights[c] += triangleArea / 3;area += triangleArea;
  }
  const volumePositions = new Float32Array((segments * 2 + 1) * 3);
  const volumeIndices = [];
  for (let i = 0; i < segments; i++) {
    volumePositions.set([perimeter[i][0], level, perimeter[i][1]], i * 3);
    volumePositions.set([perimeter[i][0], bottom, perimeter[i][1]], (segments + i) * 3);
    const next = (i + 1) % segments;
    volumeIndices.push(i, next, segments + i, next, segments + next, segments + i);
    volumeIndices.push(segments * 2, segments + i, segments + next);
  }
  volumePositions[segments * 6 + 1] = bottom;
  const volume = new THREE.BufferGeometry();
  volume.setAttribute('position', new THREE.BufferAttribute(volumePositions, 3).setUsage(THREE.DynamicDrawUsage));volume.setIndex(volumeIndices);
  const linePositions = new Float32Array(segments * 3);
  const waterline = new THREE.BufferGeometry();waterline.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
  const offsets = new Float64Array(weights.length);
  const outerStart = 1 + (rings - 1) * segments;

  function updateSurface({ slopeX = 0, slopeZ = 0, ripple = 0, time = 0 } = {}) {
    let mean = 0, largest = 0;
    for (let i = 0; i < offsets.length; i++) {
      const x = surfacePositions[i * 3], z = surfacePositions[i * 3 + 2];
      const wave = Math.sin(x * 6.5 + time * 7.5) * Math.cos(z * 8 - time * 4.2) + .3 * Math.sin(z * 14 + time * 8.4);
      offsets[i] = slopeX * x + slopeZ * z + ripple * wave;
      mean += weights[i] * offsets[i];
    }
    mean /= area;
    for (let i = 0; i < offsets.length; i++) largest = Math.max(largest, Math.abs(offsets[i] - mean));
    const scale = largest > excursion ? excursion / largest : 1;
    for (let i = 0; i < offsets.length; i++) surfacePositions[i * 3 + 1] = level + (offsets[i] - mean) * scale;
    for (let i = 0; i < segments; i++) {
      const y = surfacePositions[(outerStart + i) * 3 + 1];
      volumePositions[i * 3 + 1] = y;
      linePositions[i * 3] = perimeter[i][0];linePositions[i * 3 + 1] = y + .001;linePositions[i * 3 + 2] = perimeter[i][1];
    }
    for (const mesh of [volume, surface, waterline]) mesh.attributes.position.needsUpdate = true;
    surface.computeVertexNormals();volume.computeVertexNormals();
  }
  updateSurface();
  // Conservative fixed bounds contain every future wave, preventing stale culling.
  for (const geometry of [volume, surface, waterline]) {
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-width / 2, bottom, -depth / 2), new THREE.Vector3(width / 2, level + excursion + .002, depth / 2));
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  }
  return { volume, surface, waterline, updateSurface };
}
