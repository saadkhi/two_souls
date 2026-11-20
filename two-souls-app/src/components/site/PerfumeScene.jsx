import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { advanceScroll, mistEnvelope, smoothstep } from './scrollMotion';
import { createPerfumeBottle } from './createPerfumeBottle';
import { createPerfumeChoreography, createAtomizerChoreography } from './perfumeChoreography';
import { createLiquidMotion } from './liquidMotion';
import { getRenderQuality, createAdaptiveQuality } from './renderQuality';
import { createOpticalRenderer } from './createOpticalRenderer';

export default function PerfumeScene({ paused = false, capture = false, scrollProgress, scrollTimeline, sprayTrigger = 0, onSprayChange }) {
  const host = useRef(null);
  const controls = useRef({ paused, scrollProgress, scrollTimeline, sprayTrigger, onSprayChange });
  useEffect(() => { controls.current = { paused, scrollProgress, scrollTimeline, sprayTrigger, onSprayChange }; }, [paused, scrollProgress, scrollTimeline, sprayTrigger, onSprayChange]);

  useEffect(() => {
    const container = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: capture, powerPreference: 'high-performance' });
    } catch {
      container.dataset.renderer = 'fallback';
      window.dispatchEvent(new Event('perfume-scene-ready'));
      return;
    }
    const qualityController = createAdaptiveQuality();
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x101a14, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101a14);
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
    camera.position.set(0, .35, 10);
    camera.lookAt(0, .35, 0);

    // Studio cards are reflected and refracted by every face of the glass.
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x151a17);
    const softbox = (width, height, x, y, z, power, color = 0xfff5e5) => {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      card.position.set(x, y, z);card.lookAt(0, .3, 0);room.add(card);
    };
    softbox(1.1, 5, -3, 1.2, 3.5, 5);
    softbox(.45, 4.5, 3, .8, 1, 4, 0xe0ebe9);
    softbox(2.8, .7, 0, 4, 1.5, 3);
    softbox(1.5, 4, -1, 1, -3.5, 3.5);
    softbox(.3, 4, .9, .5, 5, 2);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const cubeTarget = new THREE.WebGLCubeRenderTarget(512, { type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType });
    const cubeCamera = new THREE.CubeCamera(.1, 30, cubeTarget);
    cubeCamera.position.y = .3;cubeCamera.update(renderer, room);
    let studio = pmrem.fromCubemap(cubeTarget.texture);
    cubeTarget.dispose();
    scene.environment = studio.texture;
    scene.environmentIntensity = .85;
    room.traverse(object => { object.geometry?.dispose();object.material?.dispose(); });
    let disposed = false;
    // Captured studio radiance gives curved glass and brushed metal detailed,
    // high-dynamic-range reflections. The local softboxes remain a load fallback.
    new RGBELoader().load('/media/studio-small-03-2k.hdr', texture => {
      if (disposed) { texture.dispose();return; }
      const next = pmrem.fromEquirectangular(texture);
      scene.environment = next.texture;scene.environmentRotation.set(0, 1.1, 0);
      studio.dispose();studio = next;texture.dispose();container.dataset.environment = 'studio-hdri';
      // Lets the boot loader reveal the bottle already in its final studio lighting.
      window.dispatchEvent(new Event('perfume-scene-ready'));
    }, undefined, () => { if (!disposed) { container.dataset.environment = 'studio-softboxes';window.dispatchEvent(new Event('perfume-scene-ready')); } });
    scene.add(new THREE.HemisphereLight(0xfff8e9, 0x17221b, .22));
    const key = new THREE.DirectionalLight(0xfff5df, 2.2);key.position.set(-3, 4, 5);scene.add(key);
    const fill = new THREE.DirectionalLight(0xdce8e4, .45);fill.position.set(4, 1, 4);scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffdba0, 1.4);rim.position.set(-2, 3, -4);scene.add(rim);

    const model = createPerfumeBottle(renderer);
    const { bottle, cap, pump, nozzlePosition } = model;
    const pivot = new THREE.Group();pivot.position.y = .35;
    bottle.position.y = -.35;pivot.add(bottle);scene.add(pivot);
    const opticalRenderer = createOpticalRenderer(renderer, scene, camera, model.optics);
    const choreography = createPerfumeChoreography();
    const liquidMotion = createLiquidMotion();
    const liquidPose = { quaternion: new THREE.Quaternion(), press: 0, floatY: 0 };
    let manualChoreography = null;

    const backdrop = document.createElement('canvas');backdrop.width = backdrop.height = 512;
    const backdropContext = backdrop.getContext('2d');
    const glow = backdropContext.createRadialGradient(256, 256, 0, 256, 256, 256);
    glow.addColorStop(0, '#1c2821');glow.addColorStop(.45, '#101a14');glow.addColorStop(1, '#101a14');
    backdropContext.fillStyle = glow;backdropContext.fillRect(0, 0, 512, 512);
    const backdropTexture = new THREE.CanvasTexture(backdrop);backdropTexture.colorSpace = THREE.SRGBColorSpace;
    const backdropMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), new THREE.MeshBasicMaterial({ map: backdropTexture, toneMapped: false }));
    backdropMesh.position.set(0, .35, -6);scene.add(backdropMesh);

    const mistCanvas = document.createElement('canvas');mistCanvas.width = mistCanvas.height = 64;
    const mistContext = mistCanvas.getContext('2d');
    const gradient = mistContext.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(238,242,242,.48)');gradient.addColorStop(.3, 'rgba(238,242,242,.17)');gradient.addColorStop(1, 'rgba(238,242,242,0)');
    mistContext.fillStyle = gradient;mistContext.fillRect(0, 0, 64, 64);
    const mistTexture = new THREE.CanvasTexture(mistCanvas);
    const count = 1100;
    const makeCloud = size => {
      const positions = new Float32Array(count * 3);
      const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({ color: 0xe5e9e6, map: mistTexture, size, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;points.visible = false;points.renderOrder = 5;bottle.add(points);
      return { positions, geometry, material, points };
    };
    const mist = makeCloud(.09), droplets = makeCloud(.013), lingeringMist = makeCloud(.09), lingeringDroplets = makeCloud(.013);
    const clouds = [mist, droplets, lingeringMist, lingeringDroplets];
    let randomSeed = 42;
    const random = () => { randomSeed = randomSeed * 16807 % 2147483647;return randomSeed / 2147483647; };
    const seeds = Array.from({ length: count }, () => ({ speed: .6 + random() * .8, angle: random() * Math.PI * 2, radius: Math.sqrt(random()), delay: random() * .22 }));
    let activeTrigger = 0, manualStart = -10, previousPress = 0, manualOwnsMist = false, wasSpraying = false;
    let lingeringStart = -10, lingeringOpacity = 0, lingeringDropOpacity = 0;
    let frame, last = performance.now(), time = 0, wall = 0, displayProgress = 0;
    let wasPaused = controls.current.paused, resuming = false;
    const resumeState = { progress: 0, target: 0, velocity: 0 };
    // Writing an unchanged data attribute still invalidates style, so skip repeats.
    const setData = (key, value) => { if (container.dataset[key] !== value) container.dataset[key] = value; };
    let drawNow = null, sizeKey = '';
    const resize = (redraw = true) => {
      const { width, height } = container.getBoundingClientRect();
      const quality = getRenderQuality({ width, height, devicePixelRatio: window.devicePixelRatio, maxTextureSize: renderer.capabilities.maxTextureSize, deviceMemory: navigator.deviceMemory ?? 8, capture, multiplier: qualityController.multiplier });
      // Resizing a canvas clears it. ResizeObserver runs after requestAnimationFrame
      // and just before paint, so an unchanged size must be a no-op and a real change
      // must repaint immediately, or one blank frame flashes on screen.
      const key = `${Math.round(width)}x${Math.round(height)}@${quality.pixelRatio.toFixed(3)}`;
      if (key === sizeKey) return;
      sizeKey = key;
      renderer.setPixelRatio(quality.pixelRatio);
      renderer.setSize(Math.max(1, width), Math.max(1, height));
      opticalRenderer.resize(quality.refractionWidth, quality.refractionHeight);
      setData('renderResolution', `${quality.drawingWidth}x${quality.drawingHeight}`);
      setData('pixelRatio', quality.pixelRatio.toFixed(2));
      camera.aspect = width / Math.max(1, height);
      // Keep the complete flacon in a narrow frame, including its side view.
      camera.position.z = camera.aspect < .65 ? 10.8 : 10;
      camera.updateProjectionMatrix();
      if (redraw) drawNow?.();
    };
    resize();const observer = new ResizeObserver(() => resize());observer.observe(container);
    const restore = () => { last = performance.now();qualityController.resetTiming(); };
    document.addEventListener('visibilitychange', restore);

    const draw = (t, dt = 0) => {
      const state = controls.current;
      const scrollMode = state.scrollTimeline !== undefined || state.scrollProgress !== undefined;
      const p = scrollMode ? displayProgress : (t % 12) / 12;
      const pose = choreography.sample(p);
      // When resuming from a paused pose, let the cap clear before accepting a press.
      if (state.sprayTrigger !== activeTrigger && pose.capLift > .92) {
        activeTrigger = state.sprayTrigger;
        if (wall - manualStart >= 2.7) {
          manualStart = wall;manualOwnsMist = true;
          manualChoreography?.dispose();manualChoreography = createAtomizerChoreography(previousPress);
          lingeringStart = wall;lingeringOpacity = mist.material.opacity;lingeringDropOpacity = droplets.material.opacity;
          lingeringMist.positions.set(mist.positions);lingeringDroplets.positions.set(droplets.positions);
          lingeringMist.geometry.attributes.position.needsUpdate = true;lingeringDroplets.geometry.attributes.position.needsUpdate = true;
        }
      }
      const manualAge = wall - manualStart, manual = manualAge < 2.7;
      if (manual !== wasSpraying) { wasSpraying = manual;state.onSprayChange?.(manual); }
      pivot.rotation.set(pose.pitch, pose.yaw, pose.roll);
      pivot.position.y = .35 + pose.floatY;
      // The cap leaves the frame naturally, without scaling or photographic swaps.
      const lift = pose.capLift;
      cap.position.set(lift * .6, lift * 4.4, -lift * .5);
      cap.rotation.set(lift * -.18, lift * .55, lift * -.18);
      const manualPress = manualChoreography?.sample(manualAge).press ?? 0;
      const press = manual ? THREE.MathUtils.lerp(manualPress, pose.press, smoothstep((manualAge - 2.2) / .5)) : pose.press;
      previousPress = press;pump.position.y = -press * .115;
      bottle.getWorldQuaternion(liquidPose.quaternion);
      liquidPose.press = press;liquidPose.floatY = pose.floatY;
      const liquid = liquidMotion.update(dt, liquidPose);
      model.updateLiquid(liquid);

      const scrollAge = (p - .59) * 9;
      if (manualOwnsMist && !manual && (scrollAge <= 0 || scrollAge >= 2.7)) manualOwnsMist = false;
      const age = manualOwnsMist ? manualAge : scrollAge;
      const clearance = smoothstep((lift - .5) / .4);
      const spraying = age >= 0 && age < 2.7 && clearance > 0;
      const envelope = spraying ? mistEnvelope(age) * clearance : 0;
      mist.material.opacity = envelope * .24;droplets.material.opacity = envelope * .32;
      const lingeringAge = wall - lingeringStart, dissolve = 1 - smoothstep(lingeringAge / .35);
      lingeringMist.material.opacity = lingeringOpacity * dissolve;lingeringDroplets.material.opacity = lingeringDropOpacity * dissolve;
      lingeringMist.points.visible = lingeringDroplets.points.visible = dissolve > 0;
      lingeringMist.points.position.set(lingeringAge * .1, lingeringAge * .04, 0);
      lingeringDroplets.points.position.copy(lingeringMist.points.position);
      if (spraying) {
        for (let i = 0; i < count; i++) {
          const seed = seeds[i], life = Math.max(0, age - seed.delay), spread = life * .27 * seed.radius;
          const x = nozzlePosition.x + Math.cos(seed.angle) * spread + Math.sin(life * 3 + seed.angle) * life * .03 + life * .14;
          const y = nozzlePosition.y - press * .115 + Math.sin(seed.angle) * spread + life * .12;
          const z = nozzlePosition.z + life * seed.speed * .8;
          const offset = i * 3;
          mist.positions[offset] = x;mist.positions[offset + 1] = y;mist.positions[offset + 2] = z;
          droplets.positions[offset] = x;droplets.positions[offset + 1] = y - life * life * .06;droplets.positions[offset + 2] = z * 1.015;
        }
        mist.geometry.attributes.position.needsUpdate = true;droplets.geometry.attributes.position.needsUpdate = true;
      }
      mist.points.visible = droplets.points.visible = spraying;
      setData('progress', p.toFixed(4));
      setData('twistDegrees', THREE.MathUtils.radToDeg(pose.yaw).toFixed(2));
      setData('capLift', lift.toFixed(3));
      setData('pumpPress', press.toFixed(3));
      setData('sprayOpacity', mist.material.opacity.toFixed(3));
      setData('liquidSlosh', Math.hypot(liquid.slopeX, liquid.slopeZ).toFixed(4));
      setData('liquidRipple', liquid.ripple.toFixed(4));
      opticalRenderer.render();
    };
    const loop = now => {
      frame = requestAnimationFrame(loop);
      const frameTime = now - last;
      const dt = document.hidden ? 0 : Math.max(0, Math.min(frameTime / 1000, .05));last = now;
      const state = controls.current;
      if (!capture && !document.hidden && !state.paused && qualityController.observe(frameTime)) resize(false);
      if (!state.paused) {
        wall += dt;time += dt;
        const target = state.scrollTimeline?.current.progress ?? state.scrollProgress ?? 0;
        if (wasPaused && !state.scrollTimeline?.current.loop) { resuming = true;resumeState.progress = displayProgress;resumeState.velocity = 0; }
        if (resuming) { resumeState.target = target;displayProgress = advanceScroll(resumeState, dt);if (displayProgress === target) resuming = false; }
        else displayProgress = target;
      }
      wasPaused = state.paused;draw(time, state.paused ? 0 : dt);
    };
    draw(0);drawNow = () => draw(time, 0);container.dataset.renderer = 'three';container.dataset.animationEngine = 'animejs';
    frame = requestAnimationFrame(loop);
    if (capture) window.renderPerfumeFrame = t => { draw(t);return renderer.domElement.toDataURL('image/png'); };
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange', restore);
      delete window.renderPerfumeFrame;choreography.dispose();manualChoreography?.dispose();
      for (const cloud of clouds) { bottle.remove(cloud.points);cloud.geometry.dispose();cloud.material.dispose(); }
      model.dispose();mistTexture.dispose();backdropTexture.dispose();backdropMesh.geometry.dispose();backdropMesh.material.dispose();
      opticalRenderer.dispose();studio.dispose();pmrem.dispose();renderer.dispose();renderer.domElement.remove();
    };
  }, [capture]);

  return <div ref={host} className="perfume-scene" role="img" aria-label="A three-dimensional Noir Oud glass perfume bottle, turning as you scroll, with a lifting cap, working atomizer and fine mist">
    <img className="photo-product-fallback" src="/media/noir-oud-photographic.png" alt="" aria-hidden="true"/>
  </div>;
}
