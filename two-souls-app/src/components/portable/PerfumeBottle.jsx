'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { advanceScroll, mistEnvelope, smoothstep } from '../site/scrollMotion';
import { createPerfumeBottle } from '../site/createPerfumeBottle';
import { createPerfumeChoreography, createAtomizerChoreography } from '../site/perfumeChoreography';
import { createLiquidMotion } from '../site/liquidMotion';
import { getRenderQuality, createAdaptiveQuality } from '../site/renderQuality';
import { createOpticalRenderer } from '../site/createOpticalRenderer';

/**
 * Standalone 3D perfume bottle. Omit progress/scroll for a 12-second loop.
 * All graphics and physics live in this instance; no site CSS or server needed.
 */
export default function PerfumeBottle({
  progress, scroll = false, paused = false, sprayTrigger = 0,
  onSprayChange, onProgress, onReady, assetBaseUrl = '/perfume-assets',
  environmentUrl, fallbackImageUrl, respectReducedMotion = true,
  className, style,
  ariaLabel = 'Noir Oud glass perfume bottle with moving liquid, a lifting cap and fine perfume mist',
}) {
  const host = useRef(null);
  const [ready, setReady] = useState(false);
  const baseUrl = assetBaseUrl.replace(/\/$/, '');
  const hdrUrl = environmentUrl === undefined ? `${baseUrl}/studio-small-03-2k.hdr` : environmentUrl;
  const photoUrl = fallbackImageUrl === undefined ? `${baseUrl}/noir-oud-photographic.png` : fallbackImageUrl;
  const controls = useRef({ paused, progress, scroll, sprayTrigger, onSprayChange, onProgress, onReady });
  useEffect(() => {
    controls.current = { paused, progress, scroll, sprayTrigger, onSprayChange, onProgress, onReady };
  }, [paused, progress, scroll, sprayTrigger, onSprayChange, onProgress, onReady]);

  useEffect(() => {
    const container = host.current;
    setReady(false);
    controls.current.onReady?.(false);
    const normalized = value => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    const pageProgress = () => normalized(window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
    const targetProgress = state => state.progress !== undefined ? normalized(state.progress) : state.scroll ? pageProgress() : 0;
    let needsRender = true;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = respectReducedMotion && motionQuery.matches;
    const updateMotion = () => { reducedMotion = respectReducedMotion && motionQuery.matches;needsRender = true; };
    motionQuery.addEventListener('change', updateMotion);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      container.dataset.renderer = 'fallback';
      // Keep the text story usable even when this browser cannot create WebGL.
      let frame, last = performance.now(), elapsed = 0, reported;
      const initial = targetProgress(controls.current);
      const playback = { progress: initial, target: initial, velocity: 0 };
      const tick = now => {
        const dt = document.hidden ? 0 : Math.max(0, Math.min((now - last) / 1000, .05));last = now;
        const state = controls.current;
        if (!state.paused && !document.hidden) {
          if (!reducedMotion) elapsed += dt;
          playback.target = targetProgress(state);
          if (reducedMotion) { playback.progress = playback.target;playback.velocity = 0; }
          else advanceScroll(playback, dt);
        }
        const p = state.scroll || state.progress !== undefined ? playback.progress : (elapsed % 12) / 12;
        container.dataset.progress = p.toFixed(4);
        if (p !== reported) { reported = p;state.onProgress?.(p); }
        frame = requestAnimationFrame(tick);
      };
      tick(last);
      return () => { cancelAnimationFrame(frame);motionQuery.removeEventListener('change', updateMotion); };
    }
    const qualityController = createAdaptiveQuality();
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x0b100e, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    Object.assign(renderer.domElement.style, { display: 'block', position: 'relative', zIndex: '1', width: '100%', height: '100%' });
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b100e);
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
    container.dataset.environment = 'studio-softboxes';
    if (hdrUrl) new RGBELoader().load(hdrUrl, texture => {
      if (disposed) { texture.dispose();return; }
      const next = pmrem.fromEquirectangular(texture);
      scene.environment = next.texture;scene.environmentRotation.set(0, 1.1, 0);
      studio.dispose();studio = next;texture.dispose();container.dataset.environment = 'studio-hdri';needsRender = true;
    }, undefined, () => { if (!disposed) container.dataset.environment = 'studio-softboxes'; });
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
    glow.addColorStop(0, '#1c2821');glow.addColorStop(.45, '#101a14');glow.addColorStop(1, '#0b100e');
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
    let frame, last = performance.now(), time = 0, wall = 0;
    let displayProgress = targetProgress(controls.current), lastReportedProgress;
    const scrollState = { progress: displayProgress, target: displayProgress, velocity: 0 };
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const quality = getRenderQuality({ width, height, devicePixelRatio: window.devicePixelRatio, maxTextureSize: renderer.capabilities.maxTextureSize, deviceMemory: navigator.deviceMemory ?? 8, multiplier: qualityController.multiplier });
      renderer.setPixelRatio(quality.pixelRatio);
      renderer.setSize(Math.max(1, width), Math.max(1, height));
      opticalRenderer.resize(quality.refractionWidth, quality.refractionHeight);
      container.dataset.renderResolution = `${quality.drawingWidth}x${quality.drawingHeight}`;
      container.dataset.pixelRatio = quality.pixelRatio.toFixed(2);
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      // Keep the complete flacon in a narrow frame, including its side view.
      camera.position.z = camera.aspect < .65 ? 10.8 : 10;
      camera.updateProjectionMatrix();needsRender = true;
    };
    resize();const observer = new ResizeObserver(resize);observer.observe(container);
    const restore = () => { last = performance.now();qualityController.resetTiming(); };
    document.addEventListener('visibilitychange', restore);

    const draw = (t, dt = 0) => {
      const state = controls.current;
      const scrollMode = state.scroll || state.progress !== undefined;
      const p = scrollMode ? displayProgress : (t % 12) / 12;
      const pose = choreography.sample(p);
      // When resuming from a paused pose, let the cap clear before accepting a press.
      if (!state.paused && !reducedMotion && state.sprayTrigger !== activeTrigger && pose.capLift > .92) {
        if (wall - manualStart >= 2.7) {
          activeTrigger = state.sprayTrigger;
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
      const envelope = spraying && !reducedMotion ? mistEnvelope(age) * clearance : 0;
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
      container.dataset.progress = p.toFixed(4);
      container.dataset.twistDegrees = THREE.MathUtils.radToDeg(pose.yaw).toFixed(2);
      container.dataset.capLift = lift.toFixed(3);
      container.dataset.pumpPress = press.toFixed(3);
      container.dataset.sprayOpacity = mist.material.opacity.toFixed(3);
      container.dataset.liquidSlosh = Math.hypot(liquid.slopeX, liquid.slopeZ).toFixed(4);
      container.dataset.liquidRipple = liquid.ripple.toFixed(4);
      opticalRenderer.render();
      if (p !== lastReportedProgress) { lastReportedProgress = p;state.onProgress?.(p); }
      needsRender = false;
    };
    const loop = now => {
      frame = requestAnimationFrame(loop);
      const frameTime = now - last;
      const dt = document.hidden ? 0 : Math.max(0, Math.min(frameTime / 1000, .05));last = now;
      const state = controls.current;
      if (!document.hidden && !state.paused && !reducedMotion && qualityController.observe(frameTime)) resize();
      if (!state.paused && !document.hidden) {
        if (!reducedMotion) { wall += dt;time += dt; }
        scrollState.target = targetProgress(state);
        const before = displayProgress;
        if (reducedMotion) { displayProgress = scrollState.target;scrollState.progress = displayProgress;scrollState.velocity = 0; }
        else displayProgress = advanceScroll(scrollState, dt);
        if (displayProgress !== before) needsRender = true;
      }
      if (!document.hidden && (needsRender || (!state.paused && !reducedMotion))) {
        draw(time, state.paused || reducedMotion ? 0 : dt);
      }
    };
    draw(0);container.dataset.renderer = 'three';container.dataset.animationEngine = 'animejs';setReady(true);controls.current.onReady?.(true);
    frame = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange', restore);
      motionQuery.removeEventListener('change', updateMotion);
      choreography.dispose();manualChoreography?.dispose();
      for (const cloud of clouds) { bottle.remove(cloud.points);cloud.geometry.dispose();cloud.material.dispose(); }
      model.dispose();mistTexture.dispose();backdropTexture.dispose();backdropMesh.geometry.dispose();backdropMesh.material.dispose();
      opticalRenderer.dispose();studio.dispose();pmrem.dispose();renderer.dispose();renderer.domElement.remove();
    };
  }, [hdrUrl, respectReducedMotion]);

  return <div ref={host} className={className} role="img" aria-label={ariaLabel}
    style={{ position: 'relative', width: '100%', height: 600, minHeight: 1, overflow: 'hidden', background: '#0b100e', ...style }}>
    {photoUrl && <img src={photoUrl} alt="" aria-hidden="true"
      onError={event => { event.currentTarget.style.display = 'none'; }}
      style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        height: '62%', width: 'auto', maxWidth: '75%', objectFit: 'contain', pointerEvents: 'none', visibility: ready ? 'hidden' : 'visible' }}/>}
  </div>;
}
