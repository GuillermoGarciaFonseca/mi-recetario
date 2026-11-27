// Ingredientes en 3D, modelados en código con three.js (sin dibujos ni imágenes externas).
import * as THREE from "./vendor/three.module.min.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";

const V2 = (x, y) => new THREE.Vector2(x, y);
const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* ---------- Materiales ---------- */
function mat(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, metalness: 0, ...o });
}
const brillo = (color, o = {}) => mat(color, { roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.18, ...o });
const vidrio = (color, o = {}) => mat(color, { roughness: 0.05, transmission: 0.92, thickness: 0.4, ior: 1.45, transparent: true, ...o });

/* ---------- Geometría ---------- */
// Ruido determinista para que las formas orgánicas no sean perfectas.
function ruido(x, y, z, s = 1) {
  return Math.sin(x * 3.1 * s + 1.3) * Math.sin(y * 2.7 * s + 0.7) * Math.sin(z * 3.7 * s + 2.1);
}
function deformar(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
function pintar(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), v = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, col); col.convertSRGBToLinear(); c.set([col.r, col.g, col.b], i * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return geo;
}
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([x, y]) => V2(x, y)), seg);
const mesh = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; return o; };
const grupo = (...hijos) => { const g = new THREE.Group(); hijos.forEach(h => g.add(h)); return g; };

function hoja(color = 0x3f7a2a, l = 0.5, w = 0.22) {
  const geo = new THREE.SphereGeometry(1, 16, 8);
  geo.scale(w, 0.03, l);
  deformar(geo, v => { v.y += Math.abs(v.z) * 0.15 - v.x * v.x * 0.6; });
  return mesh(geo, mat(color, { roughness: 0.6, side: THREE.DoubleSide }));
}
function rabito(color = 0x4b6b2a, h = 0.25, r = 0.035) {
  const m = mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 10), mat(color, { roughness: 0.8 }));
  m.position.y = h / 2;
  return m;
}
function cuenco(colorInt, alto = 0.45) {
  const g = new THREE.Group();
  const b = mesh(lathe([[0, 0], [0.55, 0.0], [0.82, 0.12], [0.98, alto], [0.92, alto], [0.76, 0.16], [0.5, 0.06], [0, 0.06]]), mat(0xf2f0eb, { roughness: 0.25, clearcoat: 0.6 }));
  g.add(b);
  if (colorInt != null) {
    const polvo = new THREE.SphereGeometry(0.9, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    polvo.scale(1, 0.42, 1);
    deformar(polvo, v => { v.y += ruido(v.x * 4, v.z * 4, v.y, 1) * 0.02; });
    const p = mesh(polvo, mat(colorInt, { roughness: 0.95 }));
    p.position.y = alto - 0.04;
    g.add(p);
  }
  return g;
}
function botella(colorVidrio, colorLiquido, { alto = 2.2, ancho = 0.42, tapon = 0x1b1b1b, nivel = 0.75 } = {}) {
  const r = ancho, h = alto;
  const perfil = [[0, 0], [r * 0.9, 0], [r, 0.06], [r, h * 0.58], [r * 0.92, h * 0.66], [r * 0.38, h * 0.8], [r * 0.3, h * 0.93], [r * 0.32, h], [0, h]];
  const g = new THREE.Group();
  g.add(mesh(lathe(perfil), vidrio(colorVidrio, { roughness: 0.08, transmission: 0.85 })));
  if (colorLiquido != null) {
    const nh = h * 0.58 * nivel;
    g.add(mesh(lathe([[0, 0.04], [r * 0.92, 0.04], [r * 0.92, nh], [0, nh]]), mat(colorLiquido, { roughness: 0.15, transmission: 0.35, thickness: 0.8, transparent: true })));
  }
  const t = mesh(new THREE.CylinderGeometry(r * 0.36, r * 0.36, h * 0.09, 24), mat(tapon, { roughness: 0.35, metalness: 0.2 }));
  t.position.y = h * 1.02;
  g.add(t);
  return g;
}
function caja(w, h, d, color, banda) {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(w, h, d, 3, 0.04), mat(color, { roughness: 0.6 })));
  g.children[0].position.y = h / 2;
  if (banda != null) {
    const b = mesh(new RoundedBoxGeometry(w * 1.01, h * 0.28, d * 1.01, 2, 0.02), mat(banda, { roughness: 0.5 }));
    b.position.y = h * 0.42;
    g.add(b);
  }
  return g;
}
function monton(n, crear, radio = 0.8, alto = 0.5, semilla = 1) {
  const g = new THREE.Group();
  let s = semilla;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const o = crear(i);
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * radio;
    const y = (1 - d / radio) * alto * rnd() + 0.05;
    o.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    g.add(o);
  }
  return g;
}

/* ---------- Modelos ---------- */
const M = {
  tomate() {
    const geo = new THREE.SphereGeometry(1, 96, 64);
    deformar(geo, v => {
      const a = Math.atan2(v.z, v.x), lob = Math.cos(a * 5) * 0.045 * (1 - Math.abs(v.y));
      const k = 1 + lob; v.x *= k; v.z *= k;
      v.y *= 0.8; if (v.y > 0.55) v.y -= (v.y - 0.55) * 0.9;
      if (v.y < -0.6) v.y += (-0.6 - v.y) * 0.4;
    });
    pintar(geo, (v, c) => c.setRGB(0.78 + v.y * 0.05, 0.08 + Math.max(0, v.y) * 0.04, 0.05));
    const t = mesh(geo, brillo(0xffffff, { vertexColors: true }));
    const caliz = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const h = hoja(0x3d6b25, 0.32, 0.08);
      h.position.set(Math.cos(i) * 0.12, 0, Math.sin(i) * 0.12);
      h.rotation.y = -i; h.rotation.x = 0.25;
      caliz.add(h);
    }
    caliz.position.y = 0.62; caliz.add(rabito(0x3d6b25, 0.2, 0.04));
    return grupo(t, caliz);
  },
  huevo() {
    const pts = []; for (let i = 0; i <= 32; i++) { const t = i / 32, a = t * Math.PI; pts.push([Math.sin(a) * 0.72 * (1 - 0.18 * t), -Math.cos(a) * 1.0]); }
    const geo = lathe(pts);
    return mesh(geo, mat(0xe8cba4, { roughness: 0.75, sheen: 0.3 }));
  },
  citrico(color, largo = 1.15) {
    const geo = new THREE.SphereGeometry(0.8, 96, 64);
    deformar(geo, v => {
      const t = v.x / 0.8;
      v.x *= largo;
      const punta = Math.max(0, (Math.abs(t) - 0.82) / 0.18) ** 2 * 0.16;
      v.x += Math.sign(t) * punta;
      const r = 1 + ruido(v.x * 14, v.y * 14, v.z * 14, 2) * 0.004;
      v.y *= r; v.z *= r;
    });
    return mesh(geo, mat(color, { roughness: 0.5, clearcoat: 0.35 }));
  },
  limon() { return M.citrico(0xe9c62a, 1.15); },
  lima() { return M.citrico(0x5f9a2e, 1.0); },
  mango() {
    const geo = new THREE.SphereGeometry(1, 96, 64);
    deformar(geo, v => { v.y *= 0.7; v.z *= 0.62; v.x *= 1.15; v.y += v.x * v.x * 0.12; });
    pintar(geo, (v, c) => { const t = (v.x + 1.15) / 2.3; c.setRGB(0.95, 0.45 + t * 0.25, 0.12 + (1 - t) * 0.05); if (v.x < -0.6) c.setRGB(0.55, 0.6, 0.2); });
    return mesh(geo, brillo(0xffffff, { vertexColors: true, roughness: 0.4 }));
  },
  patata() {
    const geo = new THREE.SphereGeometry(1, 64, 48);
    deformar(geo, v => { v.x *= 1.3; v.y *= 0.72; v.z *= 0.85; const r = 1 + ruido(v.x * 2, v.y * 2, v.z * 2) * 0.08 + ruido(v.x * 9, v.y * 9, v.z * 9, 1) * 0.012; v.multiplyScalar(r); });
    return mesh(geo, mat(0xc8a06a, { roughness: 0.92 }));
  },
  cebolla() {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, y = -1 + t * 2.3; const r = t < 0.85 ? Math.sin(Math.min(1, t / 0.85) * Math.PI) ** 0.75 * 0.95 : 0.06 * (1 - (t - 0.85) / 0.15) + 0.03; pts.push([Math.max(0.001, r), y]); }
    const geo = lathe(pts, 72);
    pintar(geo, (v, c) => { const a = Math.atan2(v.z, v.x); const raya = 0.5 + 0.5 * Math.sin(a * 22); c.setRGB(0.62 + raya * 0.08, 0.32 + raya * 0.05, 0.16); });
    return mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.45, sheen: 0.5, clearcoat: 0.3 }));
  },
  ajo() {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; const r = t < 0.8 ? Math.sin(Math.min(1, t / 0.8) * Math.PI) ** 0.7 * 0.85 : 0.08 * (1 - (t - 0.8) / 0.2) + 0.03; pts.push([Math.max(0.001, r), -0.75 + t * 1.6]); }
    const geo = lathe(pts, 96);
    deformar(geo, v => { const a = Math.atan2(v.z, v.x); const k = 1 + Math.abs(Math.cos(a * 4)) * 0.08; v.x *= k; v.z *= k; });
    return mesh(geo, mat(0xefe7da, { roughness: 0.55, sheen: 0.6 }));
  },
  zanahoria() {
    const geo = lathe([[0.001, -1.6], [0.08, -1.3], [0.2, -0.6], [0.3, 0.3], [0.32, 0.7], [0.25, 0.8], [0.001, 0.82]], 40);
    deformar(geo, v => { const k = 1 + Math.sin(v.y * 22) * 0.02; v.x *= k; v.z *= k; });
    const z = mesh(geo, mat(0xe06c1c, { roughness: 0.6 }));
    const hojas = new THREE.Group();
    for (let i = 0; i < 5; i++) { const h = hoja(0x4e8a2f, 0.5, 0.06); h.rotation.set(-1.2 + i * 0.12, i * 1.3, 0); h.position.set(0, 0.95, 0); hojas.add(h); }
    const g = grupo(z, hojas); g.rotation.z = 0.9; return g;
  },
  pimiento() {
    const geo = lathe([[0.001, -0.85], [0.35, -0.9], [0.75, -0.6], [0.85, 0], [0.8, 0.55], [0.45, 0.75], [0.15, 0.62], [0.001, 0.6]], 96);
    deformar(geo, v => { const a = Math.atan2(v.z, v.x); const k = 1 + Math.cos(a * 4) * 0.1 * (0.6 - v.y * 0.4); v.x *= k; v.z *= k; if (v.y < -0.7) v.y -= Math.max(0, Math.cos(a * 4)) * 0.12; });
    const p = mesh(geo, brillo(0xb3140e, { roughness: 0.18 }));
    const r = rabito(0x3f6b22, 0.35, 0.07); r.position.y = 0.55; r.rotation.z = 0.2;
    return grupo(p, r);
  },
  calabaza() {
    const geo = new THREE.SphereGeometry(1, 96, 64);
    deformar(geo, v => { const a = Math.atan2(v.z, v.x); const k = 1 - Math.abs(Math.sin(a * 5)) * 0.07; v.x *= k * 1.05; v.z *= k * 1.05; v.y *= 0.68; if (v.y > 0.55) v.y -= 0.12; });
    const c = mesh(geo, mat(0xd8792a, { roughness: 0.5, clearcoat: 0.2 }));
    const r = rabito(0x6b5a32, 0.3, 0.08); r.position.y = 0.48;
    return grupo(c, r);
  },
  seta() {
    const sombrero = lathe([[0.001, 0.9], [0.45, 0.86], [0.8, 0.65], [0.92, 0.42], [0.78, 0.38], [0.2, 0.45], [0.001, 0.45]], 64);
    const pie = lathe([[0.001, -0.5], [0.24, -0.5], [0.2, 0.0], [0.17, 0.46], [0.001, 0.46]], 32);
    return grupo(mesh(sombrero, mat(0x8a6a4c, { roughness: 0.7 })), mesh(pie, mat(0xe8dfcf, { roughness: 0.8 })));
  },
  perejil() {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const tallo = mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.2, 6), mat(0x5d8f39));
      const ang = (i - 3) * 0.16; tallo.rotation.z = -ang; tallo.position.set(Math.sin(ang) * 0.3, 0, (i % 2) * 0.12);
      const copa = new THREE.Group();
      for (let k = 0; k < 4; k++) { const h = hoja(0x2f6a22, 0.18, 0.13); h.rotation.set(0.6, k * 1.6, 0); copa.add(h); }
      copa.position.set(Math.sin(ang) * 0.6 + Math.sin(ang) * 0.1, 0.6 + Math.cos(ang) * 0.05, (i % 2) * 0.12);
      copa.scale.setScalar(1.6);
      g.add(tallo, copa);
    }
    return g;
  },
  puerro() {
    const geo = new THREE.CylinderGeometry(0.28, 0.3, 2.6, 40, 20);
    pintar(geo, (v, c) => { const t = (v.y + 1.3) / 2.6; c.setRGB(0.93 - t * 0.6, 0.93 - t * 0.35, 0.86 - t * 0.6); });
    const g = grupo(mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.4, clearcoat: 0.3 })));
    g.rotation.z = 1.2; return g;
  },
  jengibre() {
    const g = new THREE.Group();
    [[0, 0, 0, 0.5], [0.55, 0.15, 0.05, 0.36], [-0.45, 0.2, -0.05, 0.4], [0.2, 0.45, 0.1, 0.28]].forEach(([x, y, z, r]) => {
      const geo = new THREE.SphereGeometry(r, 32, 24); geo.scale(1.3, 0.85, 0.9);
      deformar(geo, v => v.multiplyScalar(1 + ruido(v.x * 6, v.y * 6, v.z * 6) * 0.05));
      const m = mesh(geo, mat(0xc9a06a, { roughness: 0.85 })); m.position.set(x, y, z); g.add(m);
    });
    return g;
  },
  almendra() {
    const geo = lathe([[0.001, -0.7], [0.35, -0.45], [0.42, 0], [0.28, 0.45], [0.001, 0.75]], 48);
    geo.scale(1, 1, 0.5);
    deformar(geo, v => v.multiplyScalar(1 + ruido(v.x * 14, v.y * 14, v.z * 14, 1) * 0.02));
    return monton(5, () => mesh(geo.clone(), mat(0x8a5a35, { roughness: 0.85 })), 0.7, 0.4, 3);
  },
  legumbre() {
    const geo = new THREE.SphereGeometry(0.11, 16, 10); geo.scale(1, 0.45, 1);
    return grupo(cuenco(null, 0.4), (() => { const m = monton(160, () => mesh(geo, mat(0x6e5a2e, { roughness: 0.6 })), 0.8, 0.35, 7); m.position.y = 0.1; return m; })());
  },
  arroz() {
    const geo = new THREE.CapsuleGeometry(0.03, 0.09, 4, 8);
    return grupo(cuenco(null, 0.4), (() => { const m = monton(420, () => mesh(geo, mat(0xf3efe6, { roughness: 0.35 })), 0.8, 0.35, 5); m.position.y = 0.12; return m; })());
  },
  pasta(color = 0xe7c46a) {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6);
    const m = mat(color, { roughness: color === 0x15151a ? 0.35 : 0.45 });
    for (let i = 0; i < 70; i++) { const s = mesh(geo, m); const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.28; s.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); s.rotation.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06); g.add(s); }
    g.rotation.z = 1.05; return g;
  },
  polvo(color) { return cuenco(color, 0.42); },
  azucar() {
    const geo = new RoundedBoxGeometry(0.32, 0.32, 0.32, 2, 0.03);
    return monton(9, () => mesh(geo, mat(0xfbfaf7, { roughness: 0.9 })), 0.7, 0.5, 11);
  },
  leche() { return caja(0.9, 1.9, 0.9, 0xf7f7f5, 0x2f5fa8); },
  brik() { return caja(0.9, 1.7, 0.6, 0xf2ede3, 0x8a6d3b); },
  yogur() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0.001, 0], [0.48, 0], [0.62, 0.9], [0.66, 0.92], [0.001, 0.92]]), mat(0xf6f6f3, { roughness: 0.3, clearcoat: 0.5 })));
    const tapa = mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.03, 48), mat(0xd9dde3, { metalness: 0.9, roughness: 0.25 }));
    tapa.position.y = 0.94; g.add(tapa); return g;
  },
  mantequilla() { return caja(1.4, 0.55, 0.75, 0xf3dc8a); },
  queso() {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.5, 0.35); s.lineTo(1.5, -0.35); s.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2); geo.center();
    deformar(geo, v => { v.y += ruido(v.x * 8, v.y * 8, v.z * 8) * 0.01; });
    return mesh(geo, mat(0xe9c873, { roughness: 0.7 }));
  },
  aceite() { return botella(0xe8f0d0, 0x9a8f1c, { alto: 2.3, ancho: 0.42, tapon: 0x2a2a2a }); },
  vino() { return botella(0x22401f, 0xd8cf8a, { alto: 2.5, ancho: 0.4, tapon: 0x6b1c1c, nivel: 0.9 }); },
  soja() { return botella(0x3a2418, 0x1a0c06, { alto: 1.6, ancho: 0.34, tapon: 0xb3261e, nivel: 0.95 }); },
  barbacoa() { return botella(0x4a2a18, 0x4a1c0c, { alto: 1.7, ancho: 0.4, tapon: 0x111111, nivel: 0.95 }); },
  miel() {
    const g = new THREE.Group();
    g.add(mesh(lathe([[0.001, 0], [0.6, 0], [0.66, 0.1], [0.66, 1.0], [0.5, 1.12], [0.001, 1.12]]), vidrio(0xffffff)));
    g.add(mesh(lathe([[0.001, 0.04], [0.6, 0.04], [0.6, 0.9], [0.001, 0.9]]), mat(0xd8901a, { roughness: 0.1, transmission: 0.5, thickness: 1, transparent: true })));
    const t = mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.18, 32), mat(0xb8862f, { metalness: 0.7, roughness: 0.3 })); t.position.y = 1.18; g.add(t);
    return g;
  },
  chocolate() {
    const g = new THREE.Group();
    const base = mesh(new RoundedBoxGeometry(1.6, 0.12, 0.9, 2, 0.03), mat(0x3b2217, { roughness: 0.35 })); g.add(base);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) {
      const p = mesh(new RoundedBoxGeometry(0.36, 0.1, 0.4, 2, 0.04), mat(0x3b2217, { roughness: 0.3, clearcoat: 0.4 }));
      p.position.set(-0.6 + i * 0.4, 0.09, -0.21 + k * 0.42); g.add(p);
    }
    g.rotation.x = 0.5; return g;
  },
  canela() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const c = mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 20, 1, true), mat(0x8b4a22, { roughness: 0.85, side: THREE.DoubleSide }));
      c.rotation.z = Math.PI / 2 + (i - 1) * 0.08; c.position.set(0, i * 0.2, (i - 1) * 0.25); g.add(c);
    }
    return g;
  },
  coco() {
    const g = new THREE.Group();
    const cas = new THREE.SphereGeometry(0.9, 48, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    deformar(cas, v => v.multiplyScalar(1 + ruido(v.x * 12, v.y * 12, v.z * 12) * 0.03));
    g.add(mesh(cas, mat(0x5a3a22, { roughness: 1, side: THREE.DoubleSide })));
    const pulpa = mesh(new THREE.CircleGeometry(0.86, 48), mat(0xf7f4ee, { roughness: 0.6 })); pulpa.rotation.x = -Math.PI / 2; g.add(pulpa);
    g.rotation.x = 0.5; return g;
  },
  pescado() {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([Math.max(0.001, Math.sin(t * Math.PI) ** 0.8 * 0.38 * (1 - t * 0.35)), -1.3 + t * 2.6]); }
    const geo = lathe(pts, 48); geo.scale(1, 1, 0.55); geo.rotateZ(Math.PI / 2);
    pintar(geo, (v, c) => { const t = (v.y + 0.38) / 0.76; c.setRGB(0.45 + t * 0.4, 0.5 + t * 0.4, 0.55 + t * 0.38); });
    const cuerpo = mesh(geo, mat(0xffffff, { vertexColors: true, metalness: 0.55, roughness: 0.3, clearcoat: 0.6 }));
    const cola = new THREE.Shape(); cola.moveTo(0, 0); cola.lineTo(0.55, 0.38); cola.lineTo(0.45, 0); cola.lineTo(0.55, -0.38); cola.lineTo(0, 0);
    const c = mesh(new THREE.ExtrudeGeometry(cola, { depth: 0.02, bevelEnabled: false }), mat(0x7c8590, { metalness: 0.4, roughness: 0.4 }));
    c.position.set(-1.65, 0, 0); c.rotation.y = Math.PI; c.position.x = -1.25;
    const ojo = mesh(new THREE.SphereGeometry(0.06, 16, 12), mat(0x0b0b0b, { roughness: 0.1 })); ojo.position.set(1.05, 0.08, 0.15);
    return grupo(cuerpo, c, ojo);
  },
  gamba() {
    const g = new THREE.Group();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), a = t * Math.PI * 1.15;
      const r = 0.34 * (1 - t * 0.6);
      const seg = new THREE.SphereGeometry(r, 24, 16); seg.scale(1, 1, 0.8);
      const m = mesh(seg, brillo(i % 2 ? 0xf07a4a : 0xf4885a, { roughness: 0.35 }));
      m.position.set(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0); g.add(m);
    }
    const cola = hoja(0xe2603a, 0.28, 0.2); cola.position.set(Math.cos(Math.PI * 1.2) * 0.72, Math.sin(Math.PI * 1.2) * 0.72, 0); cola.rotation.z = 1; g.add(cola);
    g.rotation.x = -0.4; return g;
  },
  almeja() {
    const valva = () => {
      const geo = new THREE.SphereGeometry(0.8, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(1, 0.38, 0.85);
      deformar(geo, v => { const a = Math.atan2(v.z, v.x); v.y += Math.sin(a * 26) * 0.012 * (Math.hypot(v.x, v.z)); });
      pintar(geo, (v, c) => { const d = Math.hypot(v.x, v.z); const anillo = 0.5 + 0.5 * Math.sin(d * 30); c.setRGB(0.78 - anillo * 0.12, 0.74 - anillo * 0.12, 0.68 - anillo * 0.1); });
      return mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.4, clearcoat: 0.5 }));
    };
    const a = valva(), b = valva(); b.rotation.z = Math.PI; b.rotation.x = 0.15; b.position.y = -0.02;
    const g = grupo(a, b); g.rotation.x = 0.7; return g;
  },
  pollo() {
    const geo = new THREE.SphereGeometry(1, 64, 48);
    deformar(geo, v => { v.x *= 1.35; v.y *= 0.42; v.z *= 0.85; v.z += v.x * v.x * 0.12; v.multiplyScalar(1 + ruido(v.x * 3, v.y * 3, v.z * 3) * 0.04); });
    return mesh(geo, mat(0xeab3a0, { roughness: 0.35, clearcoat: 0.4, sheen: 0.3 }));
  },
  avena() {
    const geo = new THREE.CylinderGeometry(0.12, 0.12, 0.02, 10);
    return grupo(cuenco(null, 0.4), (() => { const m = monton(140, () => mesh(geo, mat(0xd9c49a, { roughness: 0.9 })), 0.8, 0.35, 9); m.position.y = 0.12; return m; })());
  },
  harina() { return cuenco(0xf7f4ee, 0.42); },
  generico(tipo) {
    const c = { lacteo: 0xf5f5f2, huevo: 0xe8cba4, miel: 0xd8901a, pescado: 0x8a96a3, marisco: 0xe07a50, carne: 0xc0624d }[tipo] ?? 0x9aa77a;
    return cuenco(c, 0.42);
  }
};

// Palabra clave del nombre del ingrediente -> modelo. El orden importa (lo más específico primero).
const REGLAS = [
  ["espaguet", () => M.pasta(0x15151a)], ["negros", () => M.pasta(0x15151a)], ["pasta", () => M.pasta()], ["macarr", () => M.pasta()],
  ["leche de coco", M.coco], ["coco", M.coco], ["caldo", M.brik], ["leche", M.leche], ["yogur", M.yogur], ["mantequilla", M.mantequilla],
  ["parmesano", M.queso], ["queso", M.queso], ["nata", M.leche],
  ["aceite", M.aceite], ["vino", M.vino], ["soja", M.soja], ["barbacoa", M.barbacoa], ["miel", M.miel], ["vinagre", M.vino],
  ["chocolate", M.chocolate], ["canela", M.canela], ["azucar", M.azucar], ["harina", M.harina], ["levadura", M.harina],
  ["pimenton", () => M.polvo(0xa8321c)], ["pimienta", () => M.polvo(0x2a2420)], ["sal", () => M.polvo(0xfafafa)], ["ajo en polvo", () => M.polvo(0xe9dcc0)],
  ["tomate", M.tomate], ["huevo", M.huevo], ["limon", M.limon], ["lima", M.lima], ["mango", M.mango], ["patata", M.patata],
  ["cebolla", M.cebolla], ["ajo", M.ajo], ["zanahoria", M.zanahoria], ["pimiento", M.pimiento], ["calabaza", M.calabaza],
  ["seta", M.seta], ["champi", M.seta], ["perejil", M.perejil], ["puerro", M.puerro], ["jengibre", M.jengibre],
  ["almendra", M.almendra], ["nuez", M.almendra], ["lenteja", M.legumbre], ["garbanzo", M.legumbre], ["arroz", M.arroz], ["avena", M.avena],
  ["merluza", M.pescado], ["pescado", M.pescado], ["salmon", M.pescado], ["atun", M.pescado], ["bacalao", M.pescado],
  ["gamba", M.gamba], ["langostino", M.gamba], ["almeja", M.almeja], ["mejillon", M.almeja],
  ["pollo", M.pollo], ["pechuga", M.pollo], ["ternera", M.pollo], ["cerdo", M.pollo]
];

export function tieneModelo(nombre) {
  const n = norm(nombre);
  return REGLAS.some(([k]) => n.includes(k));
}
export function crearModelo(nombre, tipo) {
  const n = norm(nombre);
  const r = REGLAS.find(([k]) => n.includes(k));
  const obj = r ? r[1]() : M.generico(tipo);
  // Centrar y normalizar tamaño para que todos ocupen lo mismo.
  const caja3 = new THREE.Box3().setFromObject(obj), tam = caja3.getSize(new THREE.Vector3()), centro = caja3.getCenter(new THREE.Vector3());
  const envoltorio = new THREE.Group();
  obj.position.sub(centro);
  envoltorio.add(obj);
  envoltorio.scale.setScalar(2 / Math.max(tam.x, tam.y, tam.z));
  return envoltorio;
}

/* ---------- Escena compartida para renders estáticos ---------- */
let R = null;
export function escenaBase(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 8; key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  scene.add(key, new THREE.HemisphereLight(0xdfe8ff, 0x0b1426, 0.6));
  const rim = new THREE.DirectionalLight(0xbcd0ff, 1.2); rim.position.set(-4, 2, -3); scene.add(rim);
  return scene;
}
function renderer() {
  if (R) return R;
  const canvas = document.createElement("canvas");
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = escenaBase(r);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.45 }));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true; scene.add(suelo);
  R = { r, scene, suelo, camera: new THREE.PerspectiveCamera(30, 1, 0.1, 100) };
  return R;
}

const cache = new Map();
// Devuelve un dataURL PNG con fondo transparente del ingrediente (o bodegón de varios).
export function renderizar(nombres, { ancho = 320, alto = 320, tipo } = {}) {
  const lista = Array.isArray(nombres) ? nombres : [nombres];
  const clave = lista.join("|") + `@${ancho}x${alto}`;
  if (cache.has(clave)) return cache.get(clave);
  let ctx;
  try { ctx = renderer(); } catch { return null; }
  const { r, scene, suelo, camera } = ctx;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  r.setPixelRatio(dpr); r.setSize(ancho, alto, false);
  const g = new THREE.Group();
  const n = lista.length;
  lista.forEach((nom, i) => {
    const m = crearModelo(nom, tipo);
    if (n > 1) {
      const pos = [[0, 0, 0.3], [-1.55, 0, -0.6], [1.55, 0, -0.5], [-0.9, 0, 1.2], [1.0, 0, 1.3]][i] || [0, 0, 0];
      m.position.set(...pos); m.scale.multiplyScalar(i === 0 ? 1.1 : 0.8);
    }
    m.rotation.y = 0.5 + i * 0.9;
    g.add(m);
  });
  // apoyar en el suelo
  const b = new THREE.Box3().setFromObject(g); g.position.y -= b.min.y;
  scene.add(g);
  suelo.position.y = 0;
  const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  camera.aspect = ancho / alto; camera.updateProjectionMatrix();
  const dist = (Math.max(size.x / camera.aspect, size.y, size.z * 0.6) / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.08 + size.z * 0.3;
  camera.position.set(0, size.y * 0.5 + dist * 0.42, dist);
  camera.lookAt(0, size.y * 0.42, 0);
  r.render(scene, camera);
  const url = r.domElement.toDataURL("image/png");
  scene.remove(g);
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  cache.set(clave, url);
  return url;
}

export { THREE };
