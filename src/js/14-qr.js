/* myFinances on FIRE · codice QR (modalita' byte, correzione M), senza librerie.
   Segue la norma ISO/IEC 18004: versioni 1-40, 8 maschere con scelta per penalita'. */
"use strict";
(function () {
/* correzione M: codici di controllo per blocco e numero di blocchi, per versione */
const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLK_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const FORMAT_M = 0; /* bit del livello M nell'informazione di formato */

const rawModules = v => {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
};
const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLK_M[v];
const alignPos = v => {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, size = v * 4 + 17, step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, out = [6];
  for (let p = size - 7; out.length < n; p -= step) out.splice(1, 0, p);
  return out;
};
/* aritmetica nel campo GF(256) con polinomio 0x11D */
const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; };
const rsDivisor = deg => {
  const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
  for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gmul(root, 2); }
  return r;
};
const rsRemainder = (data, div) => {
  const r = new Array(div.length).fill(0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < div.length; i++) r[i] ^= gmul(div[i], f); }
  return r;
};
T.qrInternals = { ECC_M, BLK_M, rawModules, dataCodewords, alignPos, gmul, rsDivisor, rsRemainder };

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
  (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
];
T.qrMasks = MASKS;
T.qrFormatBits = mask => {
  const data = (FORMAT_M << 3) | mask; let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
};

/* testo -> matrice di moduli (true = scuro). opt.mask forza una maschera (solo per i test) */
T.qr = (text, opt) => {
  opt = opt || {};
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  let ver = 0;
  for (let v = 1; v <= 40; v++) { const cc = v < 10 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCodewords(v) * 8) { ver = v; break; } }
  if (!ver) throw new Error("testo troppo lungo per un QR");
  const size = ver * 4 + 17, cap = dataCodewords(ver);
  /* bit dei dati: modo byte, lunghezza, byte, terminatore, riempimento */
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap * 8 - bits.length));
  put(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < cap * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  /* blocchi con correzione d'errore, poi intercalati */
  const nb = BLK_M[ver], ecl = ECC_M[ver], raw = Math.floor(rawModules(ver) / 8);
  const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(ecl), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const words = [];
  for (let i = 0; i < blocks[0].length; i++) for (let j = 0; j < blocks.length; j++) if (i !== shortLen - ecl || j >= nShort) words.push(blocks[j][i]);
  /* moduli fissi: temporizzazione, riferimenti, allineamento, formato, versione */
  const M = Array.from({ length: size }, () => new Array(size).fill(false));
  const F = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = (x, y, d) => { M[y][x] = !!d; F[y][x] = true; };
  for (let i = 0; i < size; i++) { fn(6, i, i % 2 === 0); fn(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < size && y >= 0 && y < size) fn(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = alignPos(ver), na = ap.length;
  for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fn(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = mask => {
    const b = T.qrFormatBits(mask), bit = i => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) fn(8, i, bit(i));
    fn(8, 7, bit(6)); fn(8, 8, bit(7)); fn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fn(8, size - 15 + i, bit(i));
    fn(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const vb = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const d = ((vb >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); fn(a, c, d); fn(c, a, d); }
  }
  /* dati a zig-zag dal basso a destra */
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!F[y][x] && i < words.length * 8) { M[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
  /* penalita' (regole 1-4 della norma) per scegliere la maschera */
  const penalty = () => {
    let p = 0, dark = 0;
    const line = get => { let run = 1, s = 0; for (let k = 1; k < size; k++) { if (get(k) === get(k - 1)) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } return s; };
    const pat = get => { let s = 0; const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      for (let k = 0; k + 11 <= size; k++) { let a = true, b = true; for (let t = 0; t < 11; t++) { const v = get(k + t) ? 1 : 0; if (v !== A[t]) a = false; if (v !== B[t]) b = false; } if (a) s += 40; if (b) s += 40; } return s; };
    for (let y = 0; y < size; y++) { p += line(k => M[y][k]) + pat(k => M[y][k]); }
    for (let x = 0; x < size; x++) { p += line(k => M[k][x]) + pat(k => M[k][x]); }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (M[y][x]) dark++;
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  };
  let best = opt.mask != null ? opt.mask : -1;
  if (best < 0) {
    let min = Infinity;
    for (let m = 0; m < 8; m++) { apply(m); drawFormat(m); const pn = penalty(); if (pn < min) { min = pn; best = m; } apply(m); }
  }
  apply(best); drawFormat(best);
  return { size, version: ver, mask: best, modules: M };
};

/* QR come immagine SVG (sfondo bianco anche nel tema scuro, margine di 4 moduli) */
T.qrSvg = (text, px, label) => {
  const q = T.qr(text), n = q.size + 8;
  const svg = T.s("svg", { viewBox: `0 0 ${n} ${n}`, width: px || 260, height: px || 260, role: "img", "aria-label": T.tr(label || "Codice QR"), "shape-rendering": "crispEdges", class: "qr" });
  T.s("rect", { x: 0, y: 0, width: n, height: n, fill: "#FFFFFF" }, svg);
  let d = "";
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
  T.s("path", { d, fill: "#000000" }, svg);
  return svg;
};
})();
