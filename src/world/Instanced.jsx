import React, { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();
const col = new THREE.Color();

/**
 * One InstancedMesh for many copies of a shape.
 * `place(item)` returns { p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz], c?:color }.
 */
export function Instanced({ items, place, children, castShadow = true, receiveShadow = true }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      const t = place(it, i);
      e.set(...(t.r || [0, 0, 0]));
      q.setFromEuler(e);
      m4.compose(v.set(...t.p), q, s.set(...(t.s || [1, 1, 1])));
      mesh.setMatrixAt(i, m4);
      if (t.c) mesh.setColorAt(i, col.set(t.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, place]);
  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={castShadow} receiveShadow={receiveShadow}>
      {children}
    </instancedMesh>
  );
}
