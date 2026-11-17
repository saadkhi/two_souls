import * as THREE from 'three';

// Native transmission cannot refract another transmissive object. Capture the
// liquid first, then sample that linear HDR image through the outer glass shell.
export function createOpticalRenderer(renderer, scene, camera, optics) {
  // Three caches its own transmission buffer by camera id. A separate camera
  // prevents that buffer from being resized twice on every frame between passes.
  const interiorCamera = camera.clone();
  const hdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const interior = new THREE.WebGLRenderTarget(1, 1, {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: true,
    stencilBuffer: false,
    samples: Math.min(2, renderer.capabilities.maxSamples ?? 0),
  });
  interior.texture.name = 'Noir Oud interior refraction';
  const visibility = optics.glassMeshes.map(mesh => mesh.visible);
  return {
    resize(width, height) {
      interior.setSize(width, height);
      optics.setInteriorTexture(interior.texture, width, height);
    },
    render() {
      camera.updateMatrixWorld();interiorCamera.copy(camera, false);
      const previousTarget = renderer.getRenderTarget();
      const previousToneMapping = renderer.toneMapping;
      optics.glassMeshes.forEach((mesh, index) => { visibility[index] = mesh.visible;mesh.visible = false; });
      try {
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setRenderTarget(interior);
        renderer.clear();
        renderer.render(scene, interiorCamera);
      } finally {
        optics.glassMeshes.forEach((mesh, index) => { mesh.visible = visibility[index]; });
        renderer.setRenderTarget(previousTarget);
        renderer.toneMapping = previousToneMapping;
      }
      renderer.render(scene, camera);
    },
    dispose() { interior.dispose(); },
  };
}
