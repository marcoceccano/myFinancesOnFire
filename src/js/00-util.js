/* myFinances on FIRE · utilita' comuni (nessuna dipendenza esterna) */
"use strict";
const T = (typeof globalThis !== "undefined" ? globalThis : window).T = {};
T.APP = { name: "myFinances on FIRE", id: "myfinances-on-fire", version: "1.8.0", schema: 1 };

/* ---------- numeri e date ---------- */
T.round2 = v => Math.round(v * 100) / 100;
T.sum = a => a.reduce((s, v) => s + (+v || 0), 0);
T.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
T.pad = n => String(n).padStart(2, "0");
T.iso = d => d.getFullYear() + "-" + T.pad(d.getMonth() + 1) + "-" + T.pad(d.getDate());
T.today = () => T.iso(new Date());
T.parseIso = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d || 1); };
T.addDays = (s, n) => { const d = T.parseIso(s); d.setDate(d.getDate() + n); return T.iso(d); };
T.daysBetween = (a, b) => Math.round((T.parseIso(b) - T.parseIso(a)) / 864e5);
T.weekStart = s => { const d = T.parseIso(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return T.iso(d); };
T.monthKey = s => s.slice(0, 7);
T.DAYS_PER_MONTH = 365.25 / 12;

const MONTHS = {
  gen:1,feb:2,mar:3,apr:4,mag:5,giu:6,lug:7,ago:8,set:9,ott:10,nov:11,dic:12,
  jan:1,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,dec:12,
  "mär":3,mrz:3,mai:5,okt:10,dez:12,
  janv:1,"févr":2,fevr:2,mars:3,avr:4,juin:6,juil:7,"août":8,aout:8,sept_:9,déc:12,dece:12
};
/* accetta: 2026-01-31, 2026-01-31 10:22:11, 31.01.2026, 31/01/2026, 31-01-2026, "1 gen 2026", "Jan 1, 2026" */
T.parseDate = (raw, hint) => {
  if (raw == null) return null;
  if (typeof raw === "number") {           // seriale Excel
    const d = new Date(Math.round((raw - 25569) * 864e5)); return T.iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + T.pad(m[2]) + "-" + T.pad(m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let d = +m[1], mo = +m[2], y = +m[3]; if (y < 100) y += 2000;
    if (hint === "mdy" || mo > 12) { const t = d; d = mo; mo = t; }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return y + "-" + T.pad(mo) + "-" + T.pad(d);
  }
  m = s.toLowerCase().match(/^(\d{1,2})\.?\s+([a-zà-ü]+)\.?\s+(\d{4})/);
  if (m && MONTHS[m[2]] ) return m[3] + "-" + T.pad(MONTHS[m[2]]) + "-" + T.pad(m[1]);
  if (m && MONTHS[m[2].slice(0, 3)]) return m[3] + "-" + T.pad(MONTHS[m[2].slice(0, 3)]) + "-" + T.pad(m[1]);
  m = s.toLowerCase().match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].slice(0, 3)]) return m[3] + "-" + T.pad(MONTHS[m[1].slice(0, 3)]) + "-" + T.pad(m[2]);
  return null;
};

/* importi: "-41,45 CHF", "1.234,56€", "CHF 2'700.00", "-1,234.56", "(12.00)" */
T.parseAmount = raw => {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim().replace(/\u2212/g, "-");
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[^0-9,.'\-+ ]/g, "").replace(/\s/g, "").replace(/'/g, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
  if (s.endsWith("-")) { neg = !neg; s = s.slice(0, -1); }
  if (!s) return null;
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lc > -1) s = (s.length - lc - 1 === 3 && s.indexOf(",") !== lc) || (s.length - lc - 1 === 3 && lc > 0 && /^\d{1,3}(,\d{3})+$/.test(s)) ? s.replace(/,/g, "") : s.replace(",", ".");
  else if (ld > -1 && s.indexOf(".") !== ld) s = s.replace(/\./g, "");
  const v = parseFloat(s); if (!isFinite(v)) return null;
  return neg ? -v : v;
};
T.currencyOf = raw => {
  const s = String(raw || "");
  if (/€|EUR/.test(s)) return "EUR"; if (/\$|USD/.test(s)) return "USD"; if (/£|GBP/.test(s)) return "GBP";
  const m = s.match(/\b([A-Z]{3})\b/); return m ? m[1] : null;
};

/* testo con doppia codifica (UTF-8 letto come Windows-1252): "TitolaritÃ " -> "Titolarita'" */
const CP1252 = {"\u20ac":0x80,"\u201a":0x82,"\u0192":0x83,"\u201e":0x84,"\u2026":0x85,"\u2020":0x86,"\u2021":0x87,"\u02c6":0x88,"\u2030":0x89,"\u0160":0x8a,"\u2039":0x8b,"\u0152":0x8c,"\u017d":0x8e,"\u2018":0x91,"\u2019":0x92,"\u201c":0x93,"\u201d":0x94,"\u2022":0x95,"\u2013":0x96,"\u2014":0x97,"\u02dc":0x98,"\u2122":0x99,"\u0161":0x9a,"\u203a":0x9b,"\u0153":0x9c,"\u017e":0x9e,"\u0178":0x9f};
T.fixMojibake = s => {
  if (!s || !/[\u00c2-\u00f4][\u0080-\u00bf\u0152-\u2122]/.test(s)) return s;
  const bytes = [];
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 256) bytes.push(c); else if (CP1252[ch] != null) bytes.push(CP1252[ch]); else return s;
  }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)); } catch (e) { return s; }
};

/* CSV RFC 4180, separatore automatico */
T.detectDelimiter = text => {
  const head = text.split(/\r?\n/).slice(0, 15).join("\n");
  let best = ",", n = -1;
  for (const d of [",", ";", "\t", "|"]) { const k = head.split(d).length; if (k > n) { n = k; best = d; } }
  return best;
};
T.parseCsv = (text, delim) => {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  delim = delim || T.detectDelimiter(text);
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
};

/* hash breve e stabile (FNV-1a 32 bit, due passate) per gli id dei movimenti */
T.hash = s => {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822507); }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36));
};
T.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* nome esercente normalizzato per le regole */
T.normMerchant = s => String(s || "").toLowerCase()
  .replace(/https?:\/\/\S+/g, "").replace(/\*/g, " ").replace(/[0-9]{3,}/g, " ")
  .replace(/[^a-z0-9à-ü&' .-]/g, " ").replace(/\s+/g, " ").trim();

/* formattazione */
T.fmt = {
  cur: "CHF", locale: "de-CH",
  n0: v => new Intl.NumberFormat(T.fmt.locale, { maximumFractionDigits: 0 }).format(Math.round(v)),
  n1: v => new Intl.NumberFormat(T.fmt.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v),
  n2: v => new Intl.NumberFormat(T.fmt.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v),
  money: v => T.fmt.n0(v) + " " + T.fmt.cur,
  money2: v => T.fmt.n2(v) + " " + T.fmt.cur,
  k: v => Math.abs(v) >= 1e6 ? T.fmt.n1(v / 1e6) + T.tr(" Mio") : Math.abs(v) >= 1e4 ? T.fmt.n0(v / 1e3) + "k" : T.fmt.n0(v),
  pct: v => T.fmt.n0(v * 100) + "%",
  pct1: v => T.fmt.n1(v * 100) + "%",
  date: s => { if (!s) return ""; const [y, m, d] = s.split("-"); const sep = T.LANG === "en" ? "/" : "."; return d + sep + m + sep + y; },
  dateShort: s => { if (!s) return ""; const [, m, d] = s.split("-"); return d + (T.LANG === "en" ? "/" : ".") + m; },
  month: k => { const [y, m] = k.split("-"); return T.monthNames()[+m - 1] + " " + y; },
  monthShort: k => T.monthNames()[+k.slice(5, 7) - 1].slice(0, 3),
  /* "Martedi' 3 novembre", "Tuesday 3 November", "Dienstag, 3. November" */
  dayLong: s => { const d = T.parseIso(s), wd = T.weekdays()[(d.getDay() + 6) % 7], m = T.monthNames()[d.getMonth()];
    return T.LANG === "de" ? wd + ", " + d.getDate() + ". " + m : T.LANG === "en" ? wd + " " + d.getDate() + " " + m : wd + " " + d.getDate() + " " + m.toLowerCase(); },
  wdShort: s => { const wd = T.weekdays()[(T.parseIso(s).getDay() + 6) % 7]; return T.LANG === "de" ? wd.slice(0, 2) : wd.slice(0, 3); }
};
T.MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
T.WEEKDAYS_IT = ["Lunedi'","Martedi'","Mercoledi'","Giovedi'","Venerdi'","Sabato","Domenica"].map(s => s.replace("i'", "\u00ec"));
