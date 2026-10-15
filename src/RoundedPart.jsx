import React from "react";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const cache = new Map();

export function RoundedGeometry({ size, radius = 0.16 }) {
  const key = `${size.join(",")}:${radius}`;
  if (!cache.has(key)) {
    const r = Math.min(radius, ...size.map((v) => v * 0.24));
    cache.set(key, new RoundedBoxGeometry(...size, 2, r));
  }
  return <primitive attach="geometry" object={cache.get(key)} />;
}
