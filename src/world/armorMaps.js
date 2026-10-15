import * as THREE from "three";

let maps;

/** Reusable fine surface grain for the procedural armor panels. */
export function armorMaps() {
  if (maps) return maps;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4;
    const grain = Math.sin(x * 1.7 + Math.sin(y * 0.23) * 0.7) * 6;
    const noise = Math.sin(x * 53.1 + y * 91.7) * 43758.5453;
    const value = Math.max(0, Math.min(255, 176 + grain + (noise - Math.floor(noise) - 0.5) * 23));
    pixels.data.set([value, value, value, 255], i);
  }
  context.putImageData(pixels, 0, 0);
  const bumpMap = new THREE.CanvasTexture(canvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);
  bumpMap.anisotropy = 4;
  maps = { bumpMap, bumpScale: 0.025 };
  return maps;
}
