import * as THREE from "three";

const SIZE = 256;
const seed = (x, y, salt) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
};
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** Small repeatable color, roughness and normal maps for close-up ground detail. */
export function terrainMaps(planet) {
  const salt = ["proving", "ember", "cryo", "selene", "tempest", "verdant"].indexOf(planet) + 1;
  const canvases = Array.from({ length: 3 }, () => {
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    return c;
  });
  const images = canvases.map((c) => c.getContext("2d").createImageData(SIZE, SIZE));
  const height = (x, y) => {
    const a = (Math.PI * 2 * x) / SIZE, b = (Math.PI * 2 * y) / SIZE;
    return Math.sin(a * 7 + salt) * Math.cos(b * 9) * 0.28 +
      Math.sin(a * 19 + b * 17) * 0.12 +
      (seed((x + SIZE) % SIZE, (y + SIZE) % SIZE, salt) - 0.5) * 0.18;
  };
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const h = height(x, y);
    const grit = seed(x, y, salt + 9);
    const grain = clamp(213 + h * 33 + (grit - 0.5) * 45);
    images[0].data.set([grain, grain, grain, 255], i);
    const rough = clamp((planet === "cryo" ? 176 : 224) + h * 18 + grit * 18);
    images[1].data.set([rough, rough, rough, 255], i);
    const dx = height((x + 1) % SIZE, y) - height((x + SIZE - 1) % SIZE, y);
    const dy = height(x, (y + 1) % SIZE) - height(x, (y + SIZE - 1) % SIZE);
    const n = new THREE.Vector3(-dx * 0.9, -dy * 0.9, 1).normalize();
    images[2].data.set([clamp((n.x + 1) * 127.5), clamp((n.y + 1) * 127.5), clamp((n.z + 1) * 127.5), 255], i);
  }
  const textures = canvases.map((c, i) => {
    c.getContext("2d").putImageData(images[i], 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(48, 48);
    t.anisotropy = 4;
    if (i === 0) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  return { map: textures[0], roughnessMap: textures[1], normalMap: textures[2] };
}
