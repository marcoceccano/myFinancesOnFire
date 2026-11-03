/* myFinances on FIRE · lettura di file Excel (.xlsx) e PDF direttamente sul telefono.
   Nessuna libreria esterna: zip e deflate con DecompressionStream del browser. */
"use strict";
(function () {
const td = new TextDecoder("utf-8");

async function inflate(bytes, raw) {
  const ds = new DecompressionStream(raw ? "deflate-raw" : "deflate");
  const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}
T.inflate = inflate;

/* ---------- ZIP ---------- */
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Il file non e' un archivio valido");
  const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const files = {};
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const loc = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
    files[name] = { method, csize, loc };
    p += 46 + nl + el + cl;
  }
  return {
    names: Object.keys(files),
    async text(name) {
      const f = files[name]; if (!f) return null;
      const lnl = dv.getUint16(f.loc + 26, true), lel = dv.getUint16(f.loc + 28, true);
      const start = f.loc + 30 + lnl + lel, data = u8.subarray(start, start + f.csize);
      const out = f.method === 0 ? data : await inflate(data, true);
      return td.decode(out);
    }
  };
}

const xmlDecode = s => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) =>
  e === "lt" ? "<" : e === "gt" ? ">" : e === "amp" ? "&" : e === "quot" ? '"' : e === "apos" ? "'" :
  String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)));
const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

/* restituisce [{name, rows:[[cella,...],...]}] con valori testo o numero */
T.readXlsx = async buf => {
  const z = await unzip(buf);
  const ss = [];
  const sst = await z.text("xl/sharedStrings.xml");
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let t = ""; for (const x of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += x[1];
    ss.push(xmlDecode(t));
  }
  const wb = (await z.text("xl/workbook.xml")) || "";
  const rels = (await z.text("xl/_rels/workbook.xml.rels")) || "";
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*?name="([^"]*)"[^>]*?r:id="([^"]*)"/g)) {
    const rel = rels.match(new RegExp('Id="' + m[2] + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('Target="([^"]+)"[^>]*Id="' + m[2] + '"'));
    let path = rel ? rel[1] : null; if (!path) continue;
    path = path.replace(/^\//, ""); if (!path.startsWith("xl/")) path = "xl/" + path;
    sheets.push({ name: xmlDecode(m[1]), path });
  }
  if (!sheets.length) z.names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).forEach(p => sheets.push({ name: p, path: p }));
  const out = [];
  for (const sh of sheets) {
    const xml = await z.text(sh.path); if (!xml) continue;
    const rows = [];
    for (const r of xml.matchAll(/<row\b[^>]*?(?:r="(\d+)")?[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const ri = r[1] ? +r[1] - 1 : rows.length, row = [];
      if (r[2]) for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], body = c[2] || "";
        const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
        const t = (attrs.match(/t="(\w+)"/) || [])[1];
        let v = null;
        if (t === "inlineStr") { v = ""; for (const x of body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) v += xmlDecode(x[1]); }
        else { const vm = body.match(/<v>([\s\S]*?)<\/v>/); if (vm) v = t === "s" ? ss[+vm[1]] : t === "str" || t === "e" ? xmlDecode(vm[1]) : t === "b" ? vm[1] === "1" : +vm[1]; }
        row[ref ? colIndex(ref) : row.length] = v;
      }
      rows[ri] = row;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    out.push({ name: sh.name, rows });
  }
  return out;
};

/* ---------- PDF (testo) ---------- */
/* MD5 compatto (RFC 1321), serve solo per le chiavi dei PDF protetti */
function md5(bytes) {
  const K = new Int32Array(64), S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  const len = bytes.length, nb = ((len + 8) >>> 6) + 1, w = new Int32Array(nb * 16);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
  w[len >> 2] |= 0x80 << ((len % 4) * 8); w[nb * 16 - 2] = len * 8;
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  for (let o = 0; o < w.length; o += 16) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; } else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; } else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const tmp = d; d = c; c = b;
      const x = (a + f + K[i] + w[o + g]) | 0;
      b = (b + ((x << S[i]) | (x >>> (32 - S[i])))) | 0; a = tmp;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
  }
  const out = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((v, i) => { for (let k = 0; k < 4; k++) out[i * 4 + k] = (v >>> (8 * k)) & 255; });
  return out;
}
T._md5 = md5;
function rc4(key, data) {
  const s = new Uint8Array(256); for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; [s[i], s[j]] = [s[j], s[i]]; }
  const out = new Uint8Array(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) { i = (i + 1) & 255; j = (j + s[i]) & 255; [s[i], s[j]] = [s[j], s[i]]; out[k] = data[k] ^ s[(s[i] + s[j]) & 255]; }
  return out;
}
const PAD = [0x28,0xbf,0x4e,0x5e,0x4e,0x75,0x8a,0x41,0x64,0x00,0x4e,0x56,0xff,0xfa,0x01,0x08,0x2e,0x2e,0x00,0xb6,0xd0,0x68,0x3e,0x80,0x2f,0x0c,0xa9,0xfe,0x64,0x53,0x69,0x7a];
const hexBytes = h => { h = h.replace(/[^0-9a-f]/gi, ""); if (h.length % 2) h += "0"; const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
const latin = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
const toBytes = s => { const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 255; return o; };
function pdfLiteral(str, i) { /* legge una stringa letterale che parte dopo "(" ; restituisce [bytes string, nuova posizione] */
  let depth = 1, out = "";
  for (; i < str.length; i++) {
    const c = str[i];
    if (c === "\\") {
      const n = str[++i];
      if (n === "n") out += "\n"; else if (n === "r") out += "\r"; else if (n === "t") out += "\t"; else if (n === "b") out += "\b"; else if (n === "f") out += "\f";
      else if (/[0-7]/.test(n)) { let o = n; while (o.length < 3 && /[0-7]/.test(str[i + 1])) o += str[++i]; out += String.fromCharCode(parseInt(o, 8) & 255); }
      else if (n === "\r") { if (str[i + 1] === "\n") i++; } else if (n === "\n") { } else out += n;
    } else if (c === "(") { depth++; out += c; }
    else if (c === ")") { if (--depth === 0) return [out, i + 1]; out += c; }
    else out += c;
  }
  return [out, i];
}
/* nomi glifi -> caratteri (latino occidentale) */
const GLYPH = {space:" ",exclam:"!",quotedbl:'"',numbersign:"#",dollar:"$",percent:"%",ampersand:"&",quotesingle:"'",quoteright:"'",quoteleft:"'",parenleft:"(",parenright:")",asterisk:"*",plus:"+",comma:",",hyphen:"-",minus:"-",period:".",slash:"/",zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",colon:":",semicolon:";",less:"<",equal:"=",greater:">",question:"?",at:"@",bracketleft:"[",backslash:"\\",bracketright:"]",underscore:"_",braceleft:"{",bar:"|",braceright:"}",asciitilde:"~",endash:"-",emdash:"-",bullet:"\u2022",Euro:"\u20ac",sterling:"\u00a3",section:"\u00a7",degree:"\u00b0",guillemotleft:"\u00ab",guillemotright:"\u00bb",quotedblleft:'"',quotedblright:'"',quotedblbase:'"',quotesinglbase:"'",ellipsis:"...",agrave:"\u00e0",aacute:"\u00e1",acircumflex:"\u00e2",adieresis:"\u00e4",egrave:"\u00e8",eacute:"\u00e9",ecircumflex:"\u00ea",edieresis:"\u00eb",igrave:"\u00ec",iacute:"\u00ed",icircumflex:"\u00ee",idieresis:"\u00ef",ograve:"\u00f2",oacute:"\u00f3",ocircumflex:"\u00f4",odieresis:"\u00f6",ugrave:"\u00f9",uacute:"\u00fa",ucircumflex:"\u00fb",udieresis:"\u00fc",ccedilla:"\u00e7",Agrave:"\u00c0",Eacute:"\u00c9",Egrave:"\u00c8",Adieresis:"\u00c4",Odieresis:"\u00d6",Udieresis:"\u00dc",Ccedilla:"\u00c7",germandbls:"\u00df",nbspace:" ",uni00A0:" "};
const glyphChar = n => GLYPH[n] || (n.length === 1 ? n : /^uni([0-9A-F]{4})$/.test(n) ? String.fromCharCode(parseInt(n.slice(3), 16)) : "");

T.readPdfText = async buf => {
  const u8 = new Uint8Array(buf), s = latin(u8);
  const objs = {};
  for (const m of s.matchAll(/(\d+)\s+(\d+)\s+obj\b/g)) objs[m[1]] = { gen: +m[2], start: m.index + m[0].length };
  const body = n => { const o = objs[n]; if (!o) return ""; const e = s.indexOf("endobj", o.start); return s.slice(o.start, e < 0 ? undefined : e); };
  /* cifratura standard RC4 (R2/R3) o AES-128 (V4), password utente vuota */
  let keyFor = null;
  const trailer = s.slice(s.lastIndexOf("trailer"));
  const encRef = (trailer.match(/\/Encrypt\s+(\d+)\s+\d+\s+R/) || s.match(/\/Encrypt\s+(\d+)\s+\d+\s+R/) || [])[1];
  if (encRef) {
    const e = body(encRef);
    const num = k => +((e.match(new RegExp("/" + k + "\\s+(-?\\d+)")) || [])[1] || 0);
    const R = num("R"), V = num("V"), P = num("P"), len = (num("Length") || 40) / 8;
    const O = hexBytes((e.match(/\/O\s*<([0-9a-fA-F\s]+)>/) || [])[1] || "");
    const id0 = hexBytes((s.match(/\/ID\s*\[\s*<([0-9a-fA-F]+)>/) || [])[1] || "");
    const aes = /AESV2/.test(e);
    const n = R >= 3 ? (V >= 4 ? 16 : len) : 5;
    const inp = new Uint8Array(32 + O.length + 4 + id0.length);
    inp.set(PAD, 0); inp.set(O.subarray(0, 32), 32);
    inp.set([P & 255, (P >>> 8) & 255, (P >>> 16) & 255, (P >>> 24) & 255], 64); inp.set(id0, 68);
    let key = md5(inp.subarray(0, 68 + id0.length));
    if (R >= 3) for (let i = 0; i < 50; i++) key = md5(key.subarray(0, n));
    key = key.subarray(0, n);
    keyFor = (num_, gen) => {
      const k = new Uint8Array(n + 5 + (aes ? 4 : 0)); k.set(key);
      k.set([num_ & 255, (num_ >> 8) & 255, (num_ >> 16) & 255, gen & 255, (gen >> 8) & 255], n);
      if (aes) k.set([0x73, 0x41, 0x6c, 0x54], n + 5);
      return { key: md5(k).subarray(0, Math.min(n + 5, 16)), aes };
    };
  }
  async function stream(n) {
    const o = objs[n]; if (!o) return null;
    const b = body(n), si = b.search(/stream\r?\n/); if (si < 0) return null;
    const dict = b.slice(0, si), ds = o.start + si + b.slice(si).match(/stream\r?\n/)[0].length;
    let len = +((dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/) || [])[1] || 0);
    const lref = dict.match(/\/Length\s+(\d+)\s+\d+\s+R/); if (lref) len = +(body(lref[1]).trim().split(/\s/)[0]);
    if (!len) len = s.indexOf("endstream", ds) - ds;
    let data = u8.subarray(ds, ds + len);
    if (keyFor) {
      const k = keyFor(+n, o.gen);
      if (k.aes) {
        const ck = await crypto.subtle.importKey("raw", k.key, "AES-CBC", false, ["decrypt"]);
        data = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv: data.subarray(0, 16) }, ck, data.subarray(16)));
      } else data = rc4(k.key, data);
    }
    if (/FlateDecode/.test(dict)) data = await inflate(data, false);
    return { dict, data };
  }
  /* font e codifiche */
  const fontEnc = {};
  async function encodingFor(fontRef) {
    if (fontEnc[fontRef]) return fontEnc[fontRef];
    const f = body(fontRef); const map = {};
    let encBody = f; const er = f.match(/\/Encoding\s+(\d+)\s+\d+\s+R/); if (er) encBody = body(er[1]);
    const diff = encBody.match(/\/Differences\s*\[([\s\S]*?)\]/);
    if (diff) { let code = 0; for (const t of diff[1].match(/\d+|\/[^\s/\[\]]+/g) || []) { if (/^\d+$/.test(t)) code = +t; else map[code++] = glyphChar(t.slice(1)); } }
    let uni = null; const tu = f.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if (tu) { const st = await stream(tu[1]); if (st) { uni = {}; const cm = latin(st.data);
      for (const b of cm.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const x of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) uni[parseInt(x[1], 16)] = String.fromCharCode(...(x[2].match(/.{4}/g) || []).map(h => parseInt(h, 16)));
      for (const b of cm.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const x of b[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) { const a = parseInt(x[1], 16), z = parseInt(x[2], 16), st0 = parseInt(x[3], 16); for (let c = a; c <= z; c++) uni[c] = String.fromCharCode(st0 + c - a); }
    } }
    const two = /Type0/.test(f);
    return (fontEnc[fontRef] = { map, uni, two });
  }
  const decodeStr = (raw, enc) => {
    let out = "";
    if (enc && enc.two) { for (let i = 0; i + 1 < raw.length; i += 2) { const c = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1); out += enc.uni && enc.uni[c] != null ? enc.uni[c] : ""; } return out; }
    for (const ch of raw) { const c = ch.charCodeAt(0); out += enc && enc.uni && enc.uni[c] != null ? enc.uni[c] : enc && enc.map[c] != null ? enc.map[c] : c >= 32 && c < 127 ? ch : c === 0xe0 ? "\u00e0" : c === 0xe8 ? "\u00e8" : c === 0xe9 ? "\u00e9" : c === 0xf2 ? "\u00f2" : c === 0xf9 ? "\u00f9" : c === 0xec ? "\u00ec" : c >= 160 ? String.fromCharCode(c) : ""; }
    return out;
  };
  /* pagine in ordine */
  const pages = [];
  for (const n of Object.keys(objs)) { const b = body(n); if (/\/Type\s*\/Page\b(?!s)/.test(b)) pages.push(n); }
  pages.sort((a, b) => objs[a].start - objs[b].start);
  const allLines = [];
  for (const pn of pages) {
    const pb = body(pn);
    const fonts = {};
    let fontDict = (pb.match(/\/Font\s*<<([\s\S]*?)>>/) || [])[1];
    if (!fontDict) { const rr = pb.match(/\/Resources\s+(\d+)\s+\d+\s+R/); if (rr) fontDict = (body(rr[1]).match(/\/Font\s*<<([\s\S]*?)>>/) || [])[1]; }
    if (fontDict) for (const m of fontDict.matchAll(/\/([^\s/]+)\s+(\d+)\s+\d+\s+R/g)) fonts[m[1]] = await encodingFor(m[2]);
    const cont = pb.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/); if (!cont) continue;
    let content = "";
    for (const r of cont[1].matchAll(/(\d+)\s+\d+\s+R/g)) { const st = await stream(r[1]); if (st) content += latin(st.data) + "\n"; }
    /* interprete minimo degli operatori di testo */
    const runs = []; let font = null, tm = [1, 0, 0, 1, 0, 0], lm = [1, 0, 0, 1, 0, 0], lead = 0, fs = 10;
    const stack = []; let i = 0;
    const push = txt => { if (txt) runs.push({ x: tm[4], y: tm[5], t: txt, s: Math.abs(fs * (tm[3] || 1)) }); };
    const advance = txt => { tm[4] += txt.length * fs * 0.5 * (tm[0] || 1); };
    while (i < content.length) {
      const c = content[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "(") { const [str, ni] = pdfLiteral(content, i + 1); stack.push({ s: str }); i = ni; continue; }
      if (c === "<" && content[i + 1] !== "<") { const e = content.indexOf(">", i); stack.push({ s: latin(hexBytes(content.slice(i + 1, e))) }); i = e + 1; continue; }
      if (c === "[") { stack.push("["); i++; continue; }
      if (c === "]") { const arr = []; while (stack.length && stack[stack.length - 1] !== "[") arr.unshift(stack.pop()); stack.pop(); stack.push({ arr }); i++; continue; }
      if (c === "/") { const m = content.slice(i).match(/^\/[^\s/\[\]()<>]+/); stack.push(m[0]); i += m[0].length; continue; }
      if (c === "<" || c === ">") { i += 2; continue; }
      if (c === "%") { const e = content.indexOf("\n", i); i = e < 0 ? content.length : e; continue; }
      const m = content.slice(i, i + 40).match(/^[^\s/\[\]()<>%]+/); const tok = m ? m[0] : c; i += tok.length;
      if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(tok)) { stack.push(+tok); continue; }
      const nums = k => stack.slice(-k).map(Number);
      switch (tok) {
        case "BT": tm = [1, 0, 0, 1, 0, 0]; lm = tm.slice(); break;
        case "Tf": { const a = stack.slice(-2); font = fonts[String(a[0]).slice(1)] || null; fs = +a[1] || fs; break; }
        case "Tm": tm = nums(6); lm = tm.slice(); break;
        case "Td": { const [tx, ty] = nums(2); lm = [lm[0], lm[1], lm[2], lm[3], lm[4] + tx * lm[0], lm[5] + ty * lm[3]]; tm = lm.slice(); break; }
        case "TD": { const [tx, ty] = nums(2); lead = -ty; lm = [lm[0], lm[1], lm[2], lm[3], lm[4] + tx * lm[0], lm[5] + ty * lm[3]]; tm = lm.slice(); break; }
        case "TL": lead = nums(1)[0]; break;
        case "T*": lm = [lm[0], lm[1], lm[2], lm[3], lm[4], lm[5] - lead * lm[3]]; tm = lm.slice(); break;
        case "Tj": case "'": case '"': { if (tok !== "Tj") { lm = [lm[0], lm[1], lm[2], lm[3], lm[4], lm[5] - lead * lm[3]]; tm = lm.slice(); }
          const top = stack[stack.length - 1]; if (top && top.s != null) { const t = decodeStr(top.s, font); push(t); advance(t); } break; }
        case "TJ": { const top = stack[stack.length - 1]; if (top && top.arr) { let t = ""; for (const el of top.arr) { if (el && el.s != null) t += decodeStr(el.s, font); else if (typeof el === "number" && el < -200) t += " "; } push(t); advance(t); } break; }
      }
      if (/^[A-Za-z'"*]+$/.test(tok)) stack.length = 0;
    }
    /* righe: raggruppa per y, ordina per x, separa colonne distanti */
    runs.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const r of runs) {
      let L = lines.find(l => Math.abs(l.y - r.y) <= Math.max(1.5, r.s * 0.3));
      if (!L) { L = { y: r.y, runs: [] }; lines.push(L); }
      L.runs.push(r);
    }
    lines.sort((a, b) => b.y - a.y);
    for (const L of lines) {
      L.runs.sort((a, b) => a.x - b.x);
      let txt = "", endX = null;
      for (const r of L.runs) {
        if (endX != null) { const gap = r.x - endX; txt += gap > r.s * 1.5 ? "\t" : gap > r.s * 0.15 ? " " : ""; }
        txt += r.t; endX = r.x + r.t.length * r.s * 0.5;
      }
      allLines.push(txt.replace(/[ ]+/g, " ").trim());
    }
  }
  return allLines.filter(Boolean);
};
})();
