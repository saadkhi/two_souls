import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createLiquidGeometry } from './liquidGeometry.js';
import { createInteriorTransmission } from './physicalTransmission.js';

const roundedRectangle = (width, height, radius) => {
  const x = -width / 2, y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
};

// The foil mask is also a very shallow emboss map: light moves across the lettering
// with the bottle, instead of the label behaving like an illuminated screen.
function createLabelTextures(anisotropy, reverse = false) {
  const color = document.createElement('canvas');
  const foil = document.createElement('canvas');
  const roughness = document.createElement('canvas');
  color.width = foil.width = roughness.width = 1536;
  color.height = foil.height = roughness.height = 1792;
  const ink = color.getContext('2d');
  const mask = foil.getContext('2d');
  const rough = roughness.getContext('2d');
  const contexts = [ink, mask, rough];
  for (const context of contexts) context.scale?.(2, 2);
  ink.fillStyle = '#101b17';ink.fillRect(0, 0, 768, 896);
  mask.fillStyle = '#000';mask.fillRect(0, 0, 768, 896);
  rough.fillStyle = '#e4e4e4';rough.fillRect(0, 0, 768, 896);
  let seed = 1187;
  for (let i = 0; i < 14000; i++) {
    seed = (seed * 16807) % 2147483647;
    const x = seed % 768;
    seed = (seed * 16807) % 2147483647;
    const y = seed % 896;
    ink.fillStyle = i % 2 ? '#c4c6ac08' : '#0000000c';
    ink.fillRect(x, y, 1, 1);
  }
  const write = (text, y, font, tracking = 0) => {
    for (const ctx of contexts) {
      ctx.font = font;ctx.textBaseline = 'middle';
      ctx.fillStyle = ctx === ink ? '#cbb58a' : ctx === mask ? '#e2e2e2' : '#707070';
      if (!tracking) {ctx.textAlign = 'center';ctx.fillText(text, 384, y);continue;}
      ctx.textAlign = 'left';
      const widths = [...text].map(letter => ctx.measureText(letter).width);
      let x = (768 - widths.reduce((sum, value) => sum + value, 0) - tracking * (text.length - 1)) / 2;
      [...text].forEach((letter, i) => {ctx.fillText(letter, x, y);x += widths[i] + tracking;});
    }
  };
  for (const ctx of contexts) {
    ctx.strokeStyle = ctx === ink ? '#af9366' : ctx === mask ? '#c8c8c8' : '#888888';
    ctx.lineWidth = 1.2;ctx.strokeRect(31, 31, 706, 834);
    ctx.lineWidth = .6;ctx.strokeRect(40, 40, 688, 816);
  }
  write('TWO SOULS', 131, '25px Georgia, serif', 5.7);
  if (reverse) {
    write('NOIR OUD', 320, '42px Georgia, serif', 3);
    write('THE ART OF CONNECTION', 405, '13px Arial, sans-serif', 2.2);
    write('A composition of oud, warm woods', 512, '19px Georgia, serif');
    write('and an unforgettable presence.', 547, '19px Georgia, serif');
    write('EAU DE PARFUM', 675, '15px Arial, sans-serif', 3.3);
    write('50 ml / 1.7 fl. oz.', 756, '18px Georgia, serif', 1);
  } else {
    write('Noir', 345, 'italic 89px Georgia, serif');
    write('OUD', 454, '93px Georgia, serif', 12);
    for (const ctx of contexts) {
      ctx.beginPath();ctx.moveTo(324, 564);ctx.lineTo(444, 564);ctx.lineWidth = 1;ctx.stroke();
    }
    write('EAU DE PARFUM', 654, '16px Arial, sans-serif', 4.3);
    write('50 ml / 1.7 fl. oz.', 776, '18px Georgia, serif', 1.5);
  }
  const map = new THREE.CanvasTexture(color);map.colorSpace = THREE.SRGBColorSpace;
  const foilMap = new THREE.CanvasTexture(foil);
  const roughnessMap = new THREE.CanvasTexture(roughness);
  map.anisotropy = foilMap.anisotropy = roughnessMap.anisotropy = anisotropy;
  return { map, foilMap, roughnessMap };
}

function createMicroRoughness(anisotropy, brushed = false) {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 3917;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = seed * 16807 % 2147483647;
    const grain = seed / 2147483647;
    const value = Math.round(brushed ? 211 + Math.sin(y * 1.7) * 10 + grain * 13 : 225 + grain * 20);
    const offset = (y * size + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = value;data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(brushed ? 3 : 5, brushed ? 3 : 5);
  texture.magFilter = THREE.LinearFilter;texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;texture.anisotropy = anisotropy;texture.needsUpdate = true;
  return texture;
}

/** A real, fully dimensional flacon. Cap/pump transforms start at zero for Anime.js. */
export function createPerfumeBottle(renderer) {
  const bottle = new THREE.Group();bottle.name = 'Noir Oud glass flacon';
  const cap = new THREE.Group();cap.name = 'Removable ribbed cap';bottle.add(cap);
  const pump = new THREE.Group();pump.name = 'Depressible atomizer';bottle.add(pump);
  const anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const material = value => {materials.add(value);return value;};
  const geometry = value => {geometries.add(value);return value;};
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = bottle, name = '') => {
    const object = new THREE.Mesh(geometry(geo), mat);
    object.position.set(x, y, z);object.name = name;parent.add(object);return object;
  };

  const glass = material(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: .038, transmission: 1,
    thickness: .14, ior: 1.52, attenuationColor: 0xe9f0e4,
    attenuationDistance: 4.5, clearcoat: 0,
    envMapIntensity: 1.05, transparent: false, opacity: 1, depthWrite: true,
  }));
  const heavyGlass = material(glass.clone());
  heavyGlass.thickness = .29;heavyGlass.roughness = .045;
  const amber = material(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: .035, ior: 1.36,
    transmission: 1, thickness: .78, attenuationColor: 0xd9aa67,
    attenuationDistance: 1.2, clearcoat: 0, transparent: false,
    opacity: 1, depthWrite: true, envMapIntensity: .85,
  }));
  const surface = material(amber.clone());surface.transmission = .96;surface.thickness = .015;surface.roughness = .022;
  const brushedMap = createMicroRoughness(anisotropy, true), capMap = createMicroRoughness(anisotropy);
  textures.add(brushedMap);textures.add(capMap);
  const champagne = material(new THREE.MeshStandardMaterial({color: 0xc2a878, metalness: 1, roughness: .3, roughnessMap: brushedMap, bumpMap: brushedMap, bumpScale: .00025, envMapIntensity: 1.2}));
  const paleGold = material(new THREE.MeshStandardMaterial({color: 0xd5c39e, metalness: 1, roughness: .18, envMapIntensity: 1.15}));
  const darkMetal = material(new THREE.MeshStandardMaterial({color: 0x101713, metalness: .58, roughness: .29, roughnessMap: capMap, bumpMap: capMap, bumpScale: .0004, envMapIntensity: 1.1}));
  const black = material(new THREE.MeshStandardMaterial({color: 0x030504, metalness: .15, roughness: .58}));

  const body = add(new RoundedBoxGeometry(2.04, 2.76, 1.04, 7, .135), glass, 0, 0, 0, bottle, 'Bevelled crystal shell');
  body.renderOrder = 10;
  const base = add(new RoundedBoxGeometry(1.99, .22, .99, 5, .08), heavyGlass, 0, -1.265, 0, bottle, 'Heavy glass heel');base.renderOrder = 9;
  const liquidGeometry = createLiquidGeometry();
  const liquid = add(liquidGeometry.volume, amber, 0, 0, 0, bottle, 'Amber perfume volume');liquid.renderOrder = 2;
  const meniscus = add(liquidGeometry.surface, surface, 0, 0, 0, bottle, 'Perfume meniscus');
  meniscus.renderOrder = 3;surface.side = THREE.DoubleSide;
  const waterline = new THREE.LineLoop(geometry(liquidGeometry.waterline), material(new THREE.LineBasicMaterial({ color: 0xe7c78e, transparent: true, opacity: .055, depthWrite: false })));
  waterline.name = 'Moving liquid waterline';waterline.renderOrder = 4;bottle.add(waterline);

  // The slender pickup tube remains visible through the side and rear glass.
  const tubeMaterial = material(new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: .08, ior: 1.49, transmission: .98, thickness: .015, transparent: false, opacity: 1, depthWrite: true}));
  const tube = add(new THREE.CylinderGeometry(.014, .014, 2.55, 10), tubeMaterial, .055, .2, -.015, bottle, 'Atomizer dip tube');
  tube.rotation.z = -.018;tube.renderOrder = 4;

  const paper = material(new THREE.MeshStandardMaterial({color: 0x0c1712, roughness: .76, metalness: 0}));
  for (const reverse of [false, true]) {
    const width = reverse ? 1.17 : 1.43, height = reverse ? 1.5 : 1.67;
    const z = reverse ? -.529 : .529;
    add(new RoundedBoxGeometry(width + .012, height + .012, .013, 2, .008), paper, 0, -.02, z, bottle, reverse ? 'Rear label paper' : 'Front label paper');
    const { map, foilMap, roughnessMap } = createLabelTextures(anisotropy, reverse);
    textures.add(map);textures.add(foilMap);textures.add(roughnessMap);
    const printed = material(new THREE.MeshStandardMaterial({
      map, metalnessMap: foilMap, metalness: .72, roughness: .75, roughnessMap,
      bumpMap: foilMap, bumpScale: .0008, envMapIntensity: .95,
    }));
    const label = add(new THREE.PlaneGeometry(width, height), printed, 0, -.02, z + (reverse ? -.007 : .007), bottle, reverse ? 'Rear foil label' : 'Embossed gold signature');
    if (reverse) label.rotation.y = Math.PI;
  }

  const neck = add(new THREE.CylinderGeometry(.245, .28, .22, 48), heavyGlass, 0, 1.4, 0, bottle, 'Glass neck');neck.renderOrder = 10;
  add(new THREE.CylinderGeometry(.303, .303, .16, 64), champagne, 0, 1.485, 0, bottle, 'Crimped gold collar');
  add(new THREE.CylinderGeometry(.314, .314, .025, 64), paleGold, 0, 1.405, 0, bottle, 'Collar lower rim');
  add(new THREE.CylinderGeometry(.308, .308, .022, 64), paleGold, 0, 1.56, 0, bottle, 'Collar upper rim');
  add(new THREE.CylinderGeometry(.083, .083, .26, 32), paleGold, 0, 1.655, 0, pump, 'Sprung pump stem');
  add(new THREE.CylinderGeometry(.255, .255, .27, 64), champagne, 0, 1.82, 0, pump, 'Brushed atomizer head');
  add(new THREE.CylinderGeometry(.248, .248, .018, 64), paleGold, 0, 1.961, 0, pump, 'Atomizer finger plate');
  const nozzleRim = add(new THREE.TorusGeometry(.033, .006, 8, 24), paleGold, 0, 1.822, .256, pump, 'Nozzle aperture rim');
  nozzleRim.rotation.x = 0;
  add(new THREE.CircleGeometry(.026, 24), black, 0, 1.822, .261, pump, 'Nozzle aperture');
  const nozzlePosition = new THREE.Vector3(0, 1.822, .265);

  add(new RoundedBoxGeometry(.98, .73, .82, 4, .065), darkMetal, 0, 1.985, 0, cap, 'Sculpted cap');
  add(new RoundedBoxGeometry(.99, .025, .83, 3, .065), champagne, 0, 1.625, 0, cap, 'Cap gold edge');
  add(new THREE.CylinderGeometry(.285, .285, .014, 48), black, 0, 1.609, 0, cap, 'Cap underside recess');
  const ribGeometry = geometry(new THREE.CylinderGeometry(.0038, .0038, .56, 5));
  const perimeter = roundedRectangle(.984, .824, .065).getSpacedPoints(88);
  const ribs = new THREE.InstancedMesh(ribGeometry, darkMetal, perimeter.length - 1);
  ribs.name = 'Fine cap fluting';
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < perimeter.length - 1; i++) {
    matrix.makeTranslation(perimeter[i].x, 1.995, perimeter[i].y);
    ribs.setMatrixAt(i, matrix);
  }
  ribs.instanceMatrix.needsUpdate = true;cap.add(ribs);

  bottle.userData = { model: 'true-3d', width: 2.04, depth: 1.04, height: 3.73 };
  const optics = createInteriorTransmission([glass, heavyGlass]);
  return {
    bottle, cap, pump, nozzlePosition, updateLiquid: liquidGeometry.updateSurface,
    optics: { glassMeshes: [body, base, neck], materials: [glass, heavyGlass], setInteriorTexture: optics.setInteriorTexture },
    dispose() {
      ribs.dispose();
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      textures.forEach(value => value.dispose());
    },
  };
}
