// Generates the homepage 3D mark as a chibi figurine of the site owner:
// static/models/avatar.glb + avatar.svg (poster). Node 20+, stdlib only, deterministic.
// Run: node scripts/make-avatar.mjs   (the mountain alternative: scripts/make-mountain.mjs)
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../static/models/', import.meta.url));

// mulberry32
let s = 144141823 >>> 0;
const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Colors (sRGB 0-1), sampled from the owner's photos: black hair, dark frames, warm tan skin,
// charcoal hoodie, dark olive trousers. Base uses the mountain's moss/rock.
const hexc = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const COLORS = {
  skin: hexc('c99273'), hair: hexc('231e20'), glass: hexc('1c1c20'), eye: hexc('1a1514'),
  mouth: hexc('8c4a3f'), hood: hexc('3b3735'), cord: hexc('8a8582'), pants: hexc('4a4a40'),
  shoe: hexc('e9e6df'), moss: [0.36, 0.47, 0.3], rock: [0.48, 0.47, 0.44],
};

// Faces: { v:[p,p,p], c: color key, decal?: true }. Winding is fixed outward from `center`.
const faces = [];
function tri(a, b, c, color, center, decal) {
  let n = cross(sub(b, a), sub(c, a));
  if (dot(n, sub(mul(add(add(a, b), c), 1 / 3), center)) < 0) [b, c] = [c, b];
  faces.push({ v: [a, b, c], c: color, decal });
}
const quad = (a, b, c, d, color, center, decal) => { tri(a, b, c, color, center, decal); tri(a, c, d, color, center, decal); };

// Ellipsoid; dir(u=azimuth from +Z, t=polar from +Y). keep(dir, i, j) filters faces; disp(dir) scales radius.
function sphere(c, r, nu, nv, color, { keep = () => true, disp = () => 1, decal } = {}) {
  const P = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i < nu; i++) {
    const t = (j / nv) * Math.PI, u = ((i + (j % 2) * 0.5) / nu) * 2 * Math.PI;
    const d = [Math.sin(t) * Math.sin(u), Math.cos(t), Math.sin(t) * Math.cos(u)];
    const k = j === 0 || j === nv ? 1 : disp(d, i, j);
    P.push(add(c, [d[0] * r[0] * k, d[1] * r[1] * k, d[2] * r[2] * k]));
  }
  const p = (i, j) => P[j * nu + (((i % nu) + nu) % nu)];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    // odd rows are offset half a step: zig-zag strip between rows j and j+1
    const o = j % 2, a = p(i, j), b = p(i + 1, j), cc = p(i + 1 - o, j + 1), d = p(i - o, j + 1);
    const ts = [[a, b, cc], [a, cc, d]];
    for (const v of ts) {
      if ((j === 0 && v.includes(b)) || (j === nv - 1 && v.includes(d))) continue; // pole fans
      const m = norm(sub(mul(add(add(v[0], v[1]), v[2]), 1 / 3), c));
      if (keep(m, i, j)) tri(...v, color, c, decal);
    }
  }
}

// Frustum between points a and b (radii ra, rb), n sides, optional z squash, capped.
function frustum(a, b, ra, rb, n, color, { sq = 1, rot = 0 } = {}) {
  const ax = norm(sub(b, a)), ref = Math.abs(ax[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  const e1 = norm(cross(ref, ax)), e2 = cross(ax, e1), ctr = mul(add(a, b), 0.5);
  const ring = (p, r) => Array.from({ length: n }, (_, i) => {
    const t = ((i + rot) / n) * 2 * Math.PI, o = add(mul(e1, Math.cos(t) * r), mul(e2, Math.sin(t) * r));
    return add(p, [o[0], o[1], o[2] * sq]);
  });
  const A = ring(a, ra), B = ring(b, rb);
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    quad(A[i], A[k], B[k], B[i], color, ctr);
    tri(a, A[i], A[k], color, ctr);
    tri(b, B[i], B[k], color, ctr);
  }
}

// Box from center + half extents, rotated by yaw (about Y) then pitch (about X).
function box(c, h, color, { yaw = 0, pitch = 0, decal } = {}) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const T = ([x, y, z]) => { const y1 = y * cp - z * sp, z1 = y * sp + z * cp; return add(c, [x * cy + z1 * sy, y1, -x * sy + z1 * cy]); };
  const V = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => T([(i & 1 ? 1 : -1) * h[0], (i & 2 ? 1 : -1) * h[1], (i & 4 ? 1 : -1) * h[2]]));
  for (const [a, b, cc, d] of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) quad(V[a], V[b], V[cc], V[d], color, c, decal);
}
// Thin bar from p to q (square cross-section w).
function bar(p, q, w, color, decal) {
  const d = sub(q, p), L = Math.hypot(...d);
  box(mul(add(p, q), 0.5), [w, w, L / 2], color, { yaw: Math.atan2(d[0], d[2]), pitch: -Math.asin(d[1] / L), decal });
}
// Tetrahedral tuft: base around `at`, apex at `at + tip`.
function tuft(at, tip, r, color) {
  const ax = norm(tip), ref = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = norm(cross(ref, ax)), e2 = cross(ax, e1);
  const B = [0, 1, 2].map((i) => { const t = (i / 3) * 2 * Math.PI; return add(at, add(mul(e1, Math.cos(t) * r), mul(e2, Math.sin(t) * r))); });
  const apex = add(at, tip), ctr = mul(add(add(add(B[0], B[1]), B[2]), apex), 0.25);
  tri(B[0], B[1], B[2], color, ctr);
  for (let i = 0; i < 3; i++) tri(B[i], B[(i + 1) % 3], apex, color, ctr);
}

// ---- figure (y up, face toward +Z, base at y=0) ----
// base: grass-topped rock disc + two pebbles
frustum([0, 0, 0], [0, 0.08, 0], 0.5, 0.47, 9, 'rock', { rot: 0.5 });
faces.splice(-9 * 4, 9 * 4).forEach((f, i) => { if (i % 4 === 3) f.c = 'moss'; faces.push(f); }); // top cap → moss
sphere([0.34, 0.08, 0.16], [0.07, 0.05, 0.06], 5, 3, 'rock', { disp: () => 0.85 + rand() * 0.3 });
sphere([-0.3, 0.08, -0.22], [0.09, 0.06, 0.08], 5, 3, 'rock', { disp: () => 0.85 + rand() * 0.3 });

// legs + sneakers
for (const x of [-0.1, 0.1]) {
  frustum([x, 0.15, 0], [x, 0.34, 0], 0.075, 0.085, 6, 'pants');
  box([x, 0.12, 0.035], [0.07, 0.04, 0.11], 'shoe');
}
// hoodie torso, hood rim + hood on the back, drawstrings
frustum([0, 0.3, 0], [0, 0.71, 0], 0.25, 0.2, 10, 'hood', { sq: 0.78 });
for (let i = 0; i < 12; i++) { // hood rim: chunky ring around the neck, tilted back
  const t0 = (i / 12) * 2 * Math.PI, t1 = ((i + 1) / 12) * 2 * Math.PI;
  const pt = (t, rr) => [Math.sin(t) * rr, 0.71 + 0.03 - Math.cos(t) * 0.04, Math.cos(t) * rr * 0.82 - 0.02];
  frustum(pt(t0, 0.19), pt(t1, 0.19), 0.055, 0.055, 5, 'hood');
}
sphere([0, 0.76, -0.16], [0.17, 0.13, 0.1], 7, 4, 'hood');
for (const x of [-0.055, 0.055]) bar([x, 0.7, 0.19], [x * 1.2, 0.55, 0.205], 0.008, 'cord', true);
// arms + hands
for (const sx of [-1, 1]) {
  frustum([sx * 0.19, 0.66, 0], [sx * 0.28, 0.42, 0.03], 0.075, 0.065, 6, 'hood');
  sphere([sx * 0.29, 0.38, 0.035], [0.055, 0.06, 0.055], 6, 4, 'skin');
}

// head
const HC = [0, 1.08, 0], HR = [0.42, 0.39, 0.38];
sphere(HC, HR, 14, 8, 'skin');
const onFace = (x, y, out = 0) => { // point on the (true) head ellipsoid front, x/y relative to HC
  const z = HR[2] * Math.sqrt(Math.max(0, 1 - (x / HR[0]) ** 2 - (y / HR[1]) ** 2));
  return [x, HC[1] + y, z + out];
};
for (const sx of [-1, 1]) sphere([sx * 0.41, HC[1] - 0.03, -0.02], [0.05, 0.08, 0.06], 6, 4, 'skin'); // ears

// face: eyes, brows, nose, smile
for (const sx of [-1, 1]) {
  box(onFace(sx * 0.15, -0.03, 0.005), [0.028, 0.038, 0.012], 'eye', { yaw: sx * 0.38, decal: true });
  box(onFace(sx * 0.15, 0.1, 0.01), [0.07, 0.016, 0.012], 'hair', { yaw: sx * 0.38, decal: true });
}
tuft(onFace(0, -0.11, -0.01), [0, -0.01, 0.05], 0.035, 'skin');
for (const [x, y] of [[-0.11, -0.185], [-0.055, -0.212], [0, -0.22], [0.055, -0.212], [0.11, -0.185]]) box(onFace(x, y, 0.006), [0.032, 0.014, 0.01], 'mouth', { yaw: x * 2.5, decal: true });

// glasses: rectangular dark frames (square-ish, thick), bridge, temples to the ears
const GZ = 0.415, GY = HC[1] - 0.03, GW = 0.105, GH = 0.075, FW = 0.013;
for (const sx of [-1, 1]) {
  const cx = sx * 0.155;
  const zf = (x) => GZ - 0.06 * (Math.abs(x) / 0.27) ** 2; // slight wrap around the face
  const c = (x, y) => [x, y, zf(x)];
  bar(c(cx - GW, GY + GH), c(cx + GW, GY + GH), FW * 1.3, 'glass', true);
  bar(c(cx - GW, GY - GH), c(cx + GW, GY - GH), FW, 'glass', true);
  bar(c(cx - GW, GY + GH), c(cx - GW, GY - GH), FW, 'glass', true);
  bar(c(cx + GW, GY + GH), c(cx + GW, GY - GH), FW, 'glass', true);
  const ex = sx * (0.155 + GW);
  bar(c(ex, GY + GH * 0.6), [sx * 0.425, GY + 0.03, 0.02], FW * 0.8, 'glass', true);
}
bar([-0.05, GY + 0.035, GZ - 0.002], [0.05, GY + 0.035, GZ - 0.002], FW * 0.8, 'glass', true);

// hair: chunky cap with a jagged fringe, extra volume on top, swept slightly to one side
const HAIRC = add(HC, [0, 0.035, -0.015]);
sphere(HAIRC, [0.46, 0.43, 0.43], 14, 8, 'hair', {
  disp: (d) => 1 + 0.16 * Math.max(0, d[1]) ** 1.5 + (rand() - 0.5) * 0.06,
  keep: (m, i) => {
    const c = Math.cos(Math.atan2(m[0], m[2]));
    let thr = c > 0 ? 0.42 * c * c : -0.6 * c * c; // forehead line front, nape at back
    if (c > 0.5 && i % 2) thr -= 0.1; // fringe strands
    return m[1] > thr - 0.05;
  },
});
// wavy volume: jittered low-poly lumps (forehead swoop + crown), then a few fringe strands
const lump = (o, r) => sphere(add(HC, o), r, 8, 4, 'hair', { disp: () => 0.9 + rand() * 0.2 });
lump([0.03, 0.25, 0.17], [0.38, 0.14, 0.24]);
lump([-0.11, 0.39, 0.06], [0.26, 0.15, 0.26]);
lump([0.14, 0.41, -0.02], [0.25, 0.15, 0.27]);
lump([0, 0.33, -0.2], [0.3, 0.15, 0.22]);
for (const [x, tx] of [[-0.2, -0.02], [-0.06, 0.03], [0.1, 0.05], [0.24, 0.05]])
  tuft(onFace(x, 0.2, 0.06), [tx, -0.11, 0.05], 0.06, 'hair');

// ---- GLB ----
const nv = faces.length * 3, pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
faces.forEach((f, fi) => {
  f.n = norm(cross(sub(f.v[1], f.v[0]), sub(f.v[2], f.v[0])));
  f.v.forEach((p, k) => {
    const o = (fi * 3 + k) * 3;
    pos.set(p, o); nrm.set(f.n, o); col.set(COLORS[f.c].map((c) => c ** 2.2), o); // glTF vertex colors are linear
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], Math.fround(p[a])); max[a] = Math.max(max[a], Math.fround(p[a])); }
  });
});
const bin = Buffer.concat([pos, nrm, col].map((a) => Buffer.from(a.buffer)));
const L = nv * 12;
const gltf = {
  asset: { version: '2.0', generator: 'scripts/make-avatar.mjs' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'avatar' }],
  meshes: [{ name: 'avatar', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, material: 0, mode: 4 }] }],
  materials: [{ name: 'figurine', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: [0, 1, 2].map((k) => ({ buffer: 0, byteOffset: k * L, byteLength: L, target: 34962 })),
  accessors: [0, 1, 2].map((k) => ({ bufferView: k, componentType: 5126, count: nv, type: 'VEC3', ...(k === 0 ? { min, max } : {}) })),
};
const pad = (buf, byte) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, byte)]);
const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20), binP = pad(bin, 0);
const chunk = (data, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(data.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, data]); };
const body = Buffer.concat([chunk(json, 0x4e4f534a), chunk(binP, 0x004e4942)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + body.length, 8);
writeFileSync(OUT + 'avatar.glb', Buffer.concat([head, body]));

// ---- SVG poster: same view as model-viewer camera-orbit in static/js/mark.js (orthographic) ----
const th = (20 * Math.PI) / 180, ph = (80 * Math.PI) / 180;
const D = [Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th)];
const R = [Math.cos(th), 0, -Math.sin(th)], U = cross(D, R);
const LIGHT = norm(add(add(mul(R, -0.35), mul(U, 0.7)), mul(D, 1.1))); // key light from upper left, near the camera
for (const f of faces) {
  f.z = f.v.reduce((s, p) => s + dot(p, D), 0) / 3;
  if (f.decal) f.z += 0.3; // face details/glasses/cords sit on top of their host surface
}
// Decals only on the camera-facing side of the figure (drops the far glasses temple etc.).
const vis = faces.filter((f) => dot(f.n, D) > 0 && (!f.decal || dot(sub(f.v[0], [0, f.v[0][1], 0]), D) > 0.12)).sort((a, b) => a.z - b.z);
const proj = vis.map((f) => f.v.map((p) => [dot(p, R), -dot(p, U)]));
const xs = proj.flat().map((p) => p[0]), ys = proj.flat().map((p) => p[1]);
const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
const sc = 92 / Math.max(x1 - x0, y1 - y0), ox = 50 - ((x0 + x1) / 2) * sc, oy = 50 - ((y0 + y1) / 2) * sc;
const fmt = (n) => (Math.round(n * 10) / 10).toString();
const KEYS = Object.keys(COLORS), SHADE = [0, 0.12, 0.24]; // 3 Lambert tone classes per color
const cls = (f) => { const l = dot(f.n, LIGHT); return String.fromCharCode(97 + KEYS.indexOf(f.c)) + (l > 0.75 ? 0 : l > 0.4 ? 1 : 2); };
let paths = '', run = null, d = '';
vis.forEach((f, k) => {
  const c = cls(f);
  if (c !== run) { if (run) paths += `<path class="${run}" d="${d}"/>`; run = c; d = ''; }
  const p = proj[k].map(([x, y]) => [fmt(x * sc + ox), fmt(y * sc + oy)]);
  d += `M${p[0].join(' ')}L${p[1].join(' ')} ${p[2].join(' ')}Z`;
});
paths += `<path class="${run}" d="${d}"/>`;
const hex = (c) => '#' + c.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
const used = new Set(vis.map(cls));
// Real colors are literal; base follows the mountain's theme tokens; outline + ground shadow follow --fg.
let css = '.mark-poster path{fill:currentColor;stroke:currentColor;stroke-width:.3;stroke-linejoin:round}'
  + '.mark-poster .o{flood-color:#151816;flood-opacity:.22;flood-color:var(--fg,#151816)}'
  + '.mark-poster ellipse{fill:#151816;fill-opacity:.1;fill:var(--fg,#151816)}';
KEYS.forEach((key, i) => [0, 1, 2].forEach((k) => {
  const name = String.fromCharCode(97 + i) + k;
  if (!used.has(name)) return;
  const c = COLORS[key], lit = hex(c.map((x) => x * (1 - SHADE[k])));
  const v = key === 'moss' || key === 'rock' ? `var(--mark-${key},${hex(c)})` : null;
  css += `.mark-poster .${name}{color:${lit}${v ? `;color:${k ? `color-mix(in srgb,${v},#000 ${SHADE[k] * 100}%)` : v}` : ''}}`;
}));
const gx = 0 * sc + ox, gy = -dot([0, 0, 0], U) * sc + oy;
const filter = '<filter id="mark-outline" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius=".5" result="d"/><feFlood class="o"/><feComposite in2="d" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="mark-poster" aria-hidden="true" focusable="false"><style>${css}</style><defs>${filter}</defs>`
  + `<ellipse cx="${fmt(gx)}" cy="${fmt(gy + 1)}" rx="${fmt(0.56 * sc)}" ry="${fmt(0.56 * sc * Math.cos(ph) + 1.5)}"/><g filter="url(#mark-outline)">${paths}</g></svg>\n`;
writeFileSync(OUT + 'avatar.svg', svg);

// ---- self-check: parse the GLB back ----
const assert = (c, m) => { if (!c) throw new Error('self-check: ' + m); };
const glb = readFileSync(OUT + 'avatar.glb');
assert(glb.readUInt32LE(0) === 0x46546c67 && glb.readUInt32LE(4) === 2, 'magic/version');
assert(glb.readUInt32LE(8) === glb.length && glb.length % 4 === 0, 'total length');
const jl = glb.readUInt32LE(12), bl = glb.readUInt32LE(20 + jl);
assert(glb.readUInt32LE(16) === 0x4e4f534a && glb.readUInt32LE(24 + jl) === 0x004e4942, 'chunk types');
assert(jl % 4 === 0 && bl % 4 === 0 && 28 + jl + bl === glb.length, 'chunk lengths');
const back = JSON.parse(glb.subarray(20, 20 + jl).toString());
assert(back.buffers[0].byteLength <= bl, 'bin size');
assert(back.accessors.every((a) => a.count === nv && a.count % 3 === 0), 'accessor counts');
for (const a of back.accessors) { const v = back.bufferViews[a.bufferView]; assert(v.byteOffset + a.count * 12 <= back.buffers[0].byteLength, 'view bounds'); }
assert(faces.every((f) => Number.isFinite(f.n[0]) && f.v.flat().every(Number.isFinite)), 'finite geometry');
assert(faces.length <= 5000, 'triangles ' + faces.length);
assert(glb.length <= 200 * 1024, 'glb size ' + glb.length);
assert(svg.length <= 40 * 1024, 'svg size ' + svg.length);
console.log(`ok: ${faces.length} tris, glb ${glb.length} B, svg ${svg.length} B (${vis.length} faces drawn)`);
