/* Prova del codice QR: tabelle della norma, formato, e lettura completa della matrice generata
   (decodificatore indipendente: legge formato, toglie la maschera, controlla Reed-Solomon, ricostruisce il testo).
   Uso: node tests/qr.js docs/index.html */
"use strict";
const fs = require("fs"), vm = require("vm");
const html = fs.readFileSync(process.argv[2] || "docs/index.html", "utf8");
const js = html.split("<script>")[1].split("</script>")[0];
const qrSrc = js.slice(js.indexOf("/* myFinances on FIRE · codice QR"), js.indexOf("T.qrSvg ="));
const ctx = { T: {}, TextEncoder, Math, Array, Error, String };
vm.createContext(ctx); vm.runInContext(qrSrc + "\n})();", ctx);
const T = ctx.T, I = T.qrInternals;
let fails = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };

/* capacita' in byte (livello M) dalla norma, versioni 1-20 */
const CAP = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412, 450, 504, 560, 624, 666];
ok(CAP.every((c, i) => { const v = i + 1, cc = v < 10 ? 8 : 16; return Math.floor((I.dataCodewords(v) * 8 - 4 - cc) / 8) === c; }), "capacita' delle versioni 1-20 come da norma");
ok(JSON.stringify(I.alignPos(2)) === "[6,18]" && JSON.stringify(I.alignPos(7)) === "[6,22,38]" && JSON.stringify(I.alignPos(14)) === "[6,26,46,66]" && JSON.stringify(I.alignPos(32)) === "[6,34,60,86,112,138]", "posizioni dei riferimenti di allineamento");
const FMT = ["101010000010010", "101000100100101", "101111001111100", "101101101001011", "100010111111001", "100000011001110", "100111110010111", "100101010100000"];
ok(FMT.every((s, m) => T.qrFormatBits(m).toString(2).padStart(15, "0") === s), "informazione di formato (livello M, maschere 0-7) come da tabella");
/* informazione di versione (BCH 18,6) come da tabella della norma: versioni 7-12 */
{ const vinfo = v => { let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); return (v << 12) | rem; };
  const TAB = { 7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3, 11: 0x0BBF6, 12: 0x0C762 };
  ok(Object.entries(TAB).every(([v, x]) => vinfo(+v) === x), "informazione di versione 7-12 come da tabella");
  /* e nella matrice: blocco in alto a destra, versione 12 */
  const q = T.qr("y".repeat(280)), sz = q.size; let vb = 0; for (let i = 0; i < 18; i++) vb |= (q.modules[Math.floor(i / 3)][sz - 11 + i % 3] ? 1 : 0) << i;
  ok(q.version === 12 && vb === TAB[12], "informazione di versione disegnata nella matrice"); }
/* struttura per blocchi della norma (livello M): versione 10 = 4 blocchi da 43 + 1 da 44 byte di dati */
ok(I.BLK_M[10] === 5 && I.ECC_M[10] === 26 && I.BLK_M[12] === 8 && I.ECC_M[12] === 22 && I.BLK_M[13] === 9 && I.BLK_M[5] === 2 && I.ECC_M[5] === 24, "blocchi di correzione come da norma");
/* generatore Reed-Solomon: le radici alpha^0..alpha^(n-1) annullano il polinomio */
const pw = []; for (let i = 0, x = 1; i < 255; i++) { pw.push(x); x = I.gmul(x, 2); }
const evalPoly = (c, x) => { let y = 0; for (const b of c) y = I.gmul(y, x) ^ b; return y; };
{ const d = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], e = I.rsRemainder(d, I.rsDivisor(10));
  ok([...Array(10).keys()].every(i => evalPoly(d.concat(e), pw[i]) === 0), "Reed-Solomon: parola di codice valida"); }

/* decodificatore */
function decode(q) {
  const M = q.modules, size = M.length, ver = (size - 17) / 4;
  let fb = 0; const g = (x, y) => M[y][x] ? 1 : 0;
  for (let i = 0; i <= 5; i++) fb |= g(8, i) << i;
  fb |= g(8, 7) << 6; fb |= g(8, 8) << 7; fb |= g(7, 8) << 8;
  for (let i = 9; i < 15; i++) fb |= g(14 - i, 8) << i;
  let fb2 = 0; for (let i = 0; i < 8; i++) fb2 |= g(size - 1 - i, 8) << i; for (let i = 8; i < 15; i++) fb2 |= g(8, size - 15 + i) << i;
  if (fb !== fb2) throw new Error("copie del formato diverse");
  const mask = FMT.findIndex(s => parseInt(s, 2) === fb); if (mask < 0) throw new Error("formato non valido");
  /* mappa dei moduli fissi ricostruita dalla norma */
  const F = Array.from({ length: size }, () => new Array(size).fill(false)), set = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) F[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i); set(i, 6); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) set(cx + dx, cy + dy);
  const ap = I.alignPos(ver), n = ap.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy); }
  for (let i = 0; i < 9; i++) { set(8, i); set(i, 8); } for (let i = 0; i < 8; i++) { set(size - 1 - i, 8); set(8, size - 1 - i); }
  if (ver >= 7) for (let i = 0; i < 18; i++) { set(size - 11 + i % 3, Math.floor(i / 3)); set(Math.floor(i / 3), size - 11 + i % 3); }
  /* controlli strutturali: temporizzazione e riferimenti */
  for (let i = 8; i < size - 8; i++) if (M[6][i] !== (i % 2 === 0) || M[i][6] !== (i % 2 === 0)) throw new Error("temporizzazione errata");
  if (!M[size - 8][8]) throw new Error("modulo scuro mancante");
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!F[y][x]) bits.push((M[y][x] !== T.qrMasks[mask](x, y)) ? 1 : 0); } }
  const raw = Math.floor(I.rawModules(ver) / 8), words = []; for (let i = 0; i < raw; i++) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j]; words.push(b); }
  const nb = I.BLK_M[ver], ecl = I.ECC_M[ver], nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
  const lens = [...Array(nb).keys()].map(i => shortLen + (i < nShort ? 0 : 1)), blocks = lens.map(() => []);
  let k = 0; const maxLen = Math.max(...lens);
  for (let i = 0; i < maxLen - ecl; i++) for (let j = 0; j < nb; j++) if (i < lens[j] - ecl) blocks[j].push(words[k++]);
  for (let i = 0; i < ecl; i++) for (let j = 0; j < nb; j++) blocks[j].push(words[k++]);
  const data = [];
  for (const b of blocks) { for (let i = 0; i < ecl; i++) if (evalPoly(b, pw[i]) !== 0) throw new Error("Reed-Solomon: blocco non valido"); data.push(...b.slice(0, b.length - ecl)); }
  const bs = data.flatMap(b => [7, 6, 5, 4, 3, 2, 1, 0].map(i => (b >> i) & 1)); let p = 0; const rd = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bs[p++]; return v; };
  if (rd(4) !== 4) throw new Error("modo non byte");
  const len = rd(ver < 10 ? 8 : 16), out = []; for (let i = 0; i < len; i++) out.push(rd(8));
  return { text: Buffer.from(out).toString("utf8"), mask, ver };
}
const samples = ["A", "https://marcoceccano.github.io/myFinancesOnFire/",
  "https://marcoceccano.github.io/myFinancesOnFire/#famiglia=" + "eyJ2IjoxLCJmIjoi".repeat(14) + "xyz",
  "Città, perché: €, ü, ß", "x".repeat(600)];
for (const s of samples) {
  try { const q = T.qr(s), d = decode(q); ok(d.text === s, "QR letto correttamente: versione " + q.version + ", maschera " + q.mask + ", " + s.length + " caratteri"); }
  catch (e) { ok(false, "QR " + s.slice(0, 20) + ": " + e.message); }
}
for (let m = 0; m < 8; m++) { const s = "https://example.org/#" + "k".repeat(200); try { ok(decode(T.qr(s, { mask: m })).text === s, "maschera " + m + " leggibile"); } catch (e) { ok(false, "maschera " + m + ": " + e.message); } }
fs.writeFileSync(process.env.QR_OUT || "/tmp/qr-sample.json", JSON.stringify({ text: samples[2], m: T.qr(samples[2]).modules.map(r => r.map(v => v ? 1 : 0).join("")) }));
console.log(fails ? fails + " test falliti" : "Tutti i test del QR passati");
process.exitCode = fails ? 1 : 0;
