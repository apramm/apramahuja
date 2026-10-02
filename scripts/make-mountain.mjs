// Generates the homepage 3D mark: static/models/mountain.glb + mountain.svg (poster).
// Node 20+, stdlib only, deterministic. Run: node scripts/make-mountain.mjs
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../static/models/', import.meta.url));
const N = 18, CELL = 2 / N, SEED = 144141823;

// mulberry32
let s = SEED >>> 0;
const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const g = (x, z, cx, cz, w) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / w);

// Height field: main peak + shoulder + swell, jittered, radial falloff to a flat base.
const H = [];
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
  const x = -1 + i * CELL, z = -1 + j * CELL, f = smooth(0.98, 0.55, Math.hypot(x, z));
  const h = 0.95 * g(x, z, 0.08, -0.05, 0.12) + 0.5 * g(x, z, -0.42, 0.32, 0.05) + 0.15 * g(x, z, 0, 0, 0.4);
  H.push(f === 0 ? 0 : Math.max(0, (h + (rand() - 0.5) * 0.08) * f));
}
const P = (i, j) => [-1 + i * CELL, H[j * (N + 1) + i], -1 + j * CELL];
const diag = Array.from({ length: N * N }, () => rand() < 0.5);

const COLORS = { moss: [0.36, 0.47, 0.3], rock: [0.48, 0.47, 0.44], snow: [0.94, 0.94, 0.92], trail: [0.18, 0.42, 0.48] };
const faces = []; // { v: [p0,p1,p2], band, cell }
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
  const tris = diag[j * N + i] ? [[a, d, b], [a, c, d]] : [[a, c, b], [b, c, d]];
  tris.forEach((v, k) => {
    const y = Math.max(v[0][1], v[1][1], v[2][1]);
    if (y === 0) return; // drop the flat apron: footprint follows the mountain
    const cy = (v[0][1] + v[1][1] + v[2][1]) / 3;
    faces.push({ v, band: cy > 0.5 ? 'snow' : cy > 0.24 ? 'rock' : 'moss', cell: (j * N + i) * 2 + k });
  });
}
const faceByCell = new Map(faces.map((f) => [f.cell, f]));

// Exact height on the faceted surface (+ which face), matching the triangle split above.
function surface(x, z) {
  const fx = (x + 1) / CELL, fz = (z + 1) / CELL;
  const i = Math.min(N - 1, Math.max(0, Math.floor(fx))), j = Math.min(N - 1, Math.max(0, Math.floor(fz)));
  const u = fx - i, v = fz - j, h = (ii, jj) => H[jj * (N + 1) + ii];
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  let y, k;
  if (diag[j * N + i]) [y, k] = u > v ? [a + u * (b - a) + v * (d - b), 0] : [a + v * (c - a) + u * (d - c), 1];
  else [y, k] = u + v < 1 ? [a + u * (b - a) + v * (c - a), 0] : [d + (1 - u) * (c - d) + (1 - v) * (b - d), 1];
  return { y, cell: (j * N + i) * 2 + k };
}

// Trail: ribbon spiralling up around the main peak, sitting just above the surface.
const SEG = 220, W = 0.013, LIFT = 0.014, pts = [];
for (let k = 0; k <= SEG; k++) {
  const t = k / SEG, ang = 0.6 + t * Math.PI * 4.4, r = 0.78 * (1 - t) ** 1.1 + 0.015;
  pts.push([0.08 + r * Math.cos(ang), -0.05 + r * Math.sin(ang)]);
}
const ribbon = [];
for (let k = 0; k < SEG; k++) {
  const [x0, z0] = pts[k], [x1, z1] = pts[k + 1];
  const [dx, dz] = norm([x1 - x0, z1 - z0, 0]);
  const side = (x, z, sgn) => { const px = x - dz * W * sgn, pz = z + dx * W * sgn; return [px, surface(px, pz).y + LIFT, pz]; };
  const l0 = side(x0, z0, 1), r0 = side(x0, z0, -1), l1 = side(x1, z1, 1), r1 = side(x1, z1, -1);
  const host = [surface(x0, z0).cell, surface(x1, z1).cell].map((c) => faceByCell.get(c)).filter(Boolean);
  for (let v of [[l0, r0, l1], [r0, r1, l1]]) {
    if (cross(sub(v[1], v[0]), sub(v[2], v[0]))[1] < 0) v = [v[0], v[2], v[1]];
    ribbon.push({ v, band: 'trail', host });
  }
}
const all = [...faces, ...ribbon];

// ---- GLB ----
const nv = all.length * 3, pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
all.forEach((f, fi) => {
  f.n = norm(cross(sub(f.v[1], f.v[0]), sub(f.v[2], f.v[0])));
  f.v.forEach((p, k) => {
    const o = (fi * 3 + k) * 3;
    pos.set(p, o); nrm.set(f.n, o); col.set(COLORS[f.band].map((c) => c ** 2.2), o); // glTF vertex colors are linear
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], Math.fround(p[a])); max[a] = Math.max(max[a], Math.fround(p[a])); }
  });
});
const bin = Buffer.concat([pos, nrm, col].map((a) => Buffer.from(a.buffer)));
const L = nv * 12;
const gltf = {
  asset: { version: '2.0', generator: 'scripts/make-mountain.mjs' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'mountain' }],
  meshes: [{ name: 'mountain', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, material: 0, mode: 4 }] }],
  materials: [{ name: 'terrain', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: [0, 1, 2].map((k) => ({ buffer: 0, byteOffset: k * L, byteLength: L, target: 34962 })),
  accessors: [0, 1, 2].map((k) => ({ bufferView: k, componentType: 5126, count: nv, type: 'VEC3', ...(k === 0 ? { min, max } : {}) })),
};
const pad = (buf, byte) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, byte)]);
const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20), binP = pad(bin, 0);
const chunk = (data, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(data.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, data]); };
const body = Buffer.concat([chunk(json, 0x4e4f534a), chunk(binP, 0x004e4942)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + body.length, 8);
writeFileSync(OUT + 'mountain.glb', Buffer.concat([head, body]));

// ---- SVG poster: same 3/4 view as model-viewer camera-orbit="35deg 65deg" (orthographic) ----
const th = (35 * Math.PI) / 180, ph = (65 * Math.PI) / 180;
const D = [Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th)];
const R = [Math.cos(th), 0, -Math.sin(th)], U = cross(D, R);
const LIGHT = norm([-0.6 * R[0] + U[0] + 0.5 * D[0], -0.6 * R[1] + U[1] + 0.5 * D[1], -0.6 * R[2] + U[2] + 0.5 * D[2]]);
const depth = (f) => f.v.reduce((s, p) => s + dot(p, D), 0) / 3;
for (const f of faces) f.z = depth(f);
for (const f of ribbon) f.z = Math.max(...f.host.map((h) => h.z), depth(f)) + 1e-4; // draw right after host face
const vis = all.filter((f) => dot(f.n, D) > 0).sort((a, b) => a.z - b.z);
const proj = vis.map((f) => f.v.map((p) => [dot(p, R), -dot(p, U)]));
const xs = proj.flat().map((p) => p[0]), ys = proj.flat().map((p) => p[1]);
const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
const sc = 92 / Math.max(x1 - x0, y1 - y0), ox = 50 - ((x0 + x1) / 2) * sc, oy = 50 - ((y0 + y1) / 2) * sc;
const fmt = (n) => (Math.round(n * 10) / 10).toString();
const cls = (f) => {
  if (f.band === 'trail') return 't';
  const l = dot(f.n, LIGHT);
  return f.band[0] + (l > 0.82 ? 0 : l > 0.6 ? 1 : 2);
};
let paths = '', run = null, d = '';
vis.forEach((f, k) => {
  const c = cls(f);
  if (c !== run) { if (run) paths += `<path class="${run}" d="${d}"/>`; run = c; d = ''; }
  const p = proj[k].map(([x, y]) => [fmt(x * sc + ox), fmt(y * sc + oy)]);
  d += `M${p[0].join(' ')}L${p[1].join(' ')} ${p[2].join(' ')}Z`;
});
paths += `<path class="${run}" d="${d}"/>`;
const hex = (c) => '#' + c.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const SHADE = [0, 0.12, 0.24]; // 3 Lambert tone classes per band
let css = '.mark-poster path{fill:currentColor;stroke:currentColor;stroke-width:.3;stroke-linejoin:round}';
for (const band of ['moss', 'rock', 'snow']) for (const k of [0, 1, 2]) {
  const c = COLORS[band], v = `var(--mark-${band},${hex(c)})`;
  css += `.mark-poster .${band[0]}${k}{` + (k ? `color:${hex(c.map((x) => x * (1 - SHADE[k])))};color:color-mix(in srgb,${v},#000 ${SHADE[k] * 100}%)}` : `color:${v}}`);
}
css += `.mark-poster .t{color:var(--mark-trail,${hex(COLORS.trail)})}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="mark-poster" aria-hidden="true" focusable="false"><style>${css}</style>${paths}</svg>\n`;
writeFileSync(OUT + 'mountain.svg', svg);

// ---- self-check: parse the GLB back ----
const assert = (c, m) => { if (!c) throw new Error('self-check: ' + m); };
const glb = readFileSync(OUT + 'mountain.glb');
assert(glb.readUInt32LE(0) === 0x46546c67 && glb.readUInt32LE(4) === 2, 'magic/version');
assert(glb.readUInt32LE(8) === glb.length && glb.length % 4 === 0, 'total length');
const jl = glb.readUInt32LE(12), bl = glb.readUInt32LE(20 + jl);
assert(glb.readUInt32LE(16) === 0x4e4f534a && glb.readUInt32LE(24 + jl) === 0x004e4942, 'chunk types');
assert(jl % 4 === 0 && bl % 4 === 0 && 28 + jl + bl === glb.length, 'chunk lengths');
const back = JSON.parse(glb.subarray(20, 20 + jl).toString());
assert(back.buffers[0].byteLength <= bl, 'bin size');
assert(back.accessors.every((a) => a.count === nv && a.count % 3 === 0), 'accessor counts');
for (const a of back.accessors) { const v = back.bufferViews[a.bufferView]; assert(v.byteOffset + a.count * 12 <= back.buffers[0].byteLength, 'view bounds'); }
assert(glb.length <= 150 * 1024, 'glb size ' + glb.length);
assert(svg.length <= 40 * 1024, 'svg size ' + svg.length);
console.log(`ok: ${all.length} tris (${ribbon.length} trail), glb ${glb.length} B, svg ${svg.length} B (${vis.length} faces drawn)`);
