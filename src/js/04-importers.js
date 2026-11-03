/* myFinances on FIRE · importazione dei file delle banche, tutto sul telefono */
"use strict";
(function () {
const low = s => String(s == null ? "" : s).trim().toLowerCase();

/* ---------- Revolut: estratto conto consolidato (.xlsx), anche in inglese ---------- */
const RV_HEAD = { date: ["data", "date", "datum"], desc: ["descrizione", "description", "beschreibung"], cat: ["categoria", "category", "kategorie", "catégorie"], money: ["denaro in entrata/uscita", "money in/out", "money in / out", "geld ein/aus", "entrées/sorties d'argent"], fee: ["costi", "fees", "fee", "gebühren", "frais"] };
const isHead = (cells, keys) => keys.some(k => cells.includes(k));
T.parseRevolutStatement = (rows, base) => {
  base = base || "CHF";
  const lines = rows.map(r => { const v = r.filter(x => x != null && x !== ""); if (v.length === 1 && typeof v[0] === "string" && v[0].includes(",")) return T.parseCsv(T.fixMojibake(v[0]), ",")[0] || []; return r.map(x => typeof x === "string" ? T.fixMojibake(x) : x); });
  const out = []; let section = null, inCurrent = false, head = null;
  for (const cells0 of lines) {
    const cells = cells0.map(c => (c == null ? "" : c));
    const first = low(cells[0]);
    const rest = cells.slice(1).every(c => c === "" || c == null);
    if (/estratti conto delle operazioni|transaction statements|kontoauszüge|relevés/.test(first)) { inCurrent = /conti correnti|current accounts|girokonten|comptes courants/.test(first); head = null; continue; }
    if (rest && first && !/^-+$/.test(first)) { const m = String(cells[0]).match(/\(([A-Z]{3})\)\s*$/); if (m) { section = { cur: m[1], name: String(cells[0]).trim() }; head = null; } continue; }
    const lc = cells.map(low);
    if (isHead(lc, RV_HEAD.date) && isHead(lc, RV_HEAD.desc) && isHead(lc, RV_HEAD.money)) {
      const idx = k => lc.findIndex(c => RV_HEAD[k].includes(c));
      const mi = idx("money"); const dup = RV_HEAD.money.includes(lc[mi + 1]);
      const fi = idx("fee"); const fdup = fi > -1 && RV_HEAD.fee.includes(lc[fi + 1]);
      head = { d: idx("date"), s: idx("desc"), c: idx("cat"), m: mi, mb: dup ? mi + 1 : -1, f: fi, fb: fdup ? fi + 1 : -1 };
      continue;
    }
    if (!head || !inCurrent || !section) continue;
    if (/^(totale|total|gesamt)$/.test(first)) { head = null; continue; }
    const d = T.parseDate(cells[head.d]); if (!d) continue;
    const loc = T.parseAmount(cells[head.m]); if (loc == null) continue;
    const cur = T.currencyOf(cells[head.m]) || section.cur;
    let amt = head.mb > -1 ? T.parseAmount(cells[head.mb]) : (cur === base ? loc : null);
    const fee = head.fb > -1 ? T.parseAmount(cells[head.fb]) : head.f > -1 && cur === base ? T.parseAmount(cells[head.f]) : 0;
    out.push({ d, desc: String(cells[head.s] || "").trim(), rcat: String(cells[head.c] || "").trim(), amtLoc: loc, cur, amt, fee: fee || 0, acct: section.name });
  }
  return out;
};

/* ---------- Revolut: CSV dell'app (Type, Product, Started Date, ... ) ---------- */
const RC = { type: ["type", "tipo", "typ"], product: ["product", "prodotto", "produkt", "produit"], started: ["started date", "data di inizio", "startdatum", "date de début"], completed: ["completed date", "data di completamento", "abschlussdatum", "date de fin"], desc: ["description", "descrizione", "beschreibung"], amount: ["amount", "importo", "betrag", "montant"], fee: ["fee", "costo", "commissione", "gebühr", "frais"], currency: ["currency", "valuta", "währung", "devise"], state: ["state", "stato", "status", "état"] };
T.isRevolutCsv = rows => { const h = (rows[0] || []).map(low); return isHead(h, RC.type) && isHead(h, RC.amount) && isHead(h, RC.currency) && (isHead(h, RC.started) || isHead(h, RC.completed)); };
T.parseRevolutCsv = (rows) => {
  const h = rows[0].map(low), ix = k => h.findIndex(c => RC[k].includes(c));
  const I = {}; Object.keys(RC).forEach(k => I[k] = ix(k));
  const out = [];
  for (const r of rows.slice(1)) {
    if (!r || r.length < 3) continue;
    const st = low(r[I.state]); if (st && !/completed|completato|abgeschlossen|terminé|effectué/.test(st)) continue;
    const d = T.parseDate(r[I.completed] || r[I.started]); if (!d) continue;
    const loc = T.parseAmount(r[I.amount]); if (loc == null) continue;
    const fee = T.parseAmount(r[I.fee]) || 0;
    const typ = low(r[I.type]);
    const rcat = /exchange/.test(typ) ? "Cambio valuta" : /topup|top-up/.test(typ) ? "Ricarica" : /atm/.test(typ) ? "Prelievo" : /refund/.test(typ) ? "Rimborso" : /card_payment|card payment/.test(typ) ? "Esercente" : typ;
    out.push({ d, desc: String(r[I.desc] || "").trim(), rcat, amtLoc: T.round2(loc - Math.abs(fee)), cur: String(r[I.currency] || "").trim().toUpperCase(), amt: null, fee, acct: String(r[I.product] || "") });
  }
  return out;
};

/* ---------- CSV generico (UBS e altre banche): riconoscimento colonne ---------- */
const GC = {
  date: ["data", "date", "datum", "buchungsdatum", "data di registrazione", "data contabile", "abschlussdatum", "booking date", "transaction date", "data operazione", "valuta", "data valuta", "valutadatum", "date valeur"],
  desc: ["descrizione", "description", "beschreibung", "descrizione1", "beschreibung1", "testo", "text", "buchungstext", "dettagli", "details", "motivo", "causale", "beneficiario", "empfänger", "libellé", "communication"],
  amount: ["importo", "amount", "betrag", "montant", "importo chf", "betrag chf", "movimento", "einzelbetrag", "sottototale"],
  debit: ["addebito", "debit", "belastung", "débit", "uscite", "dare"],
  credit: ["accredito", "credit", "gutschrift", "crédit", "entrate", "avere"],
  currency: ["valuta", "currency", "währung", "devise", "moneta", "mon."]
};
T.guessCsvMapping = rows => {
  let hr = 0, best = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const lc = (rows[i] || []).map(low); let sc = 0;
    for (const k of Object.keys(GC)) if (lc.some(c => GC[k].includes(c))) sc++;
    if (sc > best) { best = sc; hr = i; }
  }
  const h = (rows[hr] || []).map(low);
  const find = (k, not) => h.findIndex((c, i) => GC[k].includes(c) && !(not || []).includes(i));
  const m = { headerRow: hr, date: find("date"), desc: find("desc"), amount: find("amount"), debit: find("debit"), credit: find("credit"), currency: -1, dateHint: "dmy" };
  const ci = h.findIndex((c, i) => GC.currency.includes(c) && i !== m.date); m.currency = ci;
  if (m.date === m.currency) m.currency = -1;
  const descs = h.map((c, i) => (/^(descrizione|beschreibung|description)\s*\d$/.test(c) ? i : -1)).filter(i => i > -1);
  if (descs.length > 1) m.descCols = descs;
  return m;
};
T.parseGenericCsv = (rows, m, base) => {
  const out = [];
  for (const r of rows.slice(m.headerRow + 1)) {
    if (!r || r.every(c => c === "" || c == null)) continue;
    const d = T.parseDate(r[m.date], m.dateHint); if (!d) continue;
    let a = null;
    if (m.amount > -1) a = T.parseAmount(r[m.amount]);
    if (a == null && (m.debit > -1 || m.credit > -1)) { const db = T.parseAmount(r[m.debit]) || 0, cr = T.parseAmount(r[m.credit]) || 0; if (db || cr) a = cr - Math.abs(db); }
    if (a == null) continue;
    const desc = (m.descCols ? m.descCols.map(i => r[i]).filter(Boolean).join(" · ") : r[m.desc] || "").toString().trim();
    const cur = m.currency > -1 && /^[A-Z]{3}$/.test(String(r[m.currency] || "").trim()) ? String(r[m.currency]).trim() : base;
    out.push({ d, desc, rcat: "", amtLoc: a, cur, amt: cur === base ? a : null, fee: 0, acct: "" });
  }
  return out;
};

/* ---------- UBS: PDF "Pagamenti registrati" (anche DE/FR/EN) -> costi fissi ---------- */
T.isUbsPaymentsPdf = lines => lines.some(l => /pagamenti registrati|erfasste zahlungen|paiements saisis|recorded payments|pending payments|zahlungen/i.test(l)) && lines.some(l => /\d{2}\.\d{2}\.\d{4}.*\b[A-Z]{3}\s+[\d'.,]+\s*$/.test(l));
T.parseUbsPayments = lines => {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s+(?:CH|LI|[A-Z]{2})\d{2}[0-9A-Z ]{8,}?\s+([A-Z]{3})\s+([\d'.,]+)\s*$/) || lines[i].match(/^(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s+([A-Z]{3})\s+([\d'.,]+)\s*$/);
    if (!m) continue;
    let note = "";
    const n2 = lines[i + 2] || "";
    if (lines[i + 1] && /vistato|visiert|visé|approved|stato|status/i.test(lines[i + 1]) && n2 && !/^\d{2}\.\d{2}\.\d{4}/.test(n2) && !/somme|summen|totaux|totals/i.test(n2) && n2 !== "E-BILL") note = n2;
    out.push({ date: T.parseDate(m[1]), payee: m[2].replace(/\t/g, " ").trim(), cur: m[3], amount: T.parseAmount(m[4]), note });
  }
  return out;
};
/* proposta di voce di costo fisso a partire dal beneficiario */
T.suggestFixed = p => {
  const s = (p.payee + " " + p.note).toLowerCase();
  const kind = /3a|pilastro|säule|pillar|finpension|viac|frankly|vorsorge|prévoyance/.test(s) ? "risparmio" : "costo";
  const name = /pigione|miete|loyer|affitto|rent/.test(s) ? "Affitto" : /kranken|sanitas|css|helsana|swica|assura|visana|concordia|groupe mutuel|kpt|atupri|sympany|cassa malati/.test(s) ? "Cassa malati" :
    /leasing|financial services|rata|bmw|mercedes|amag|leasing/.test(s) ? "Leasing auto" : /ail|aziende industriali|energie|ewz|ekz|elettric|strom/.test(s) ? "Energia e acqua" :
    /sunrise|swisscom|salt|upc|wingo|yallo|internet|telefon/.test(s) ? "Internet e telefono" : /versicherung|assicura|mobiliar|axa|zurich|helvetia|allianz|generali|baloise/.test(s) ? "Assicurazione" :
    kind === "risparmio" ? "Pilastro 3a" : p.payee;
  const freq = /ail|aziende industriali|energie|ewz|ekz/.test(s) ? "trimestrale" : "mensile";
  return { name, payee: p.payee, amount: p.amount, freq, kind, note: p.note || "" };
};
T.FREQ = { mensile: 1, bimestrale: 2, trimestrale: 3, semestrale: 6, annuale: 12 };
T.monthlyOf = f => (+f.amount || 0) / (T.FREQ[f.freq] || 1);

/* ---------- riconoscimento del file e conversione in movimenti ---------- */
T.readAnyFile = async (name, buf) => {
  const lname = name.toLowerCase(), u8 = new Uint8Array(buf);
  const isZip = u8[0] === 0x50 && u8[1] === 0x4b, isPdf = u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46;
  if (isPdf) {
    const lines = await T.readPdfText(buf);
    if (T.isUbsPaymentsPdf(lines)) return { type: "ubs-payments", source: "UBS", payments: T.parseUbsPayments(lines), lines };
    return { type: "pdf-unknown", lines };
  }
  if (isZip || /\.xlsx$/.test(lname)) {
    const sheets = await T.readXlsx(buf);
    for (const sh of sheets) { const tx = T.parseRevolutStatement(sh.rows); if (tx.length) return { type: "revolut-statement", source: "Revolut", rows: tx }; }
    const rows = (sheets[0] || { rows: [] }).rows.map(r => r.map(c => c == null ? "" : c));
    return { type: "table", source: "", table: rows, mapping: T.guessCsvMapping(rows) };
  }
  let text = new TextDecoder("utf-8").decode(u8);
  if (text.includes("\ufffd")) text = new TextDecoder("windows-1252").decode(u8);
  const rows = T.parseCsv(text);
  if (T.isRevolutCsv(rows)) return { type: "revolut-csv", source: "Revolut", rows: T.parseRevolutCsv(rows) };
  return { type: "table", source: /ubs/.test(lname) ? "UBS" : "", table: rows, mapping: T.guessCsvMapping(rows) };
};

/* id stabili: stesso movimento in due export sovrapposti = stesso id */
T.assignIds = (rows, source) => {
  const seen = {};
  for (const r of rows) {
    if (r.fixedId) { r.id = r.fixedId; continue; }
    const k = [source, r.d, T.normMerchant(r.desc), T.round2(r.amtLoc), r.cur].join("|");
    seen[k] = (seen[k] || 0) + 1;
    r.id = T.hash(k + "#" + seen[k]);
  }
  return rows;
};
/* aggiunge i movimenti allo stato: conversione valuta, classificazione, niente doppioni */
T.mergeTxs = (st, rows, source) => {
  const base = st.profile.currency || "CHF", fx = st.profile.fx || {};
  T.assignIds(rows, source);
  const have = new Set(st.txs.map(t => t.id));
  /* stesso conto letto da due fonti (estratto e collegamento automatico): stesso importo e valuta, data entro 3 giorni */
  const fam = s => /^revolut/.test(s || "") ? "revolut" : s;
  const pool = {};
  for (const t of st.txs) if (fam(t.src) === fam(source) && t.src !== source) { const k = t.cur + "|" + T.round2(t.amtLoc); (pool[k] = pool[k] || []).push(t); }
  let added = 0, dup = 0, noFx = 0;
  for (const r of rows) {
    if (have.has(r.id)) { dup++; continue; }
    const pk = r.cur + "|" + T.round2(r.amtLoc), cand = pool[pk];
    if (cand) { const i = cand.findIndex(t => Math.abs(T.daysBetween(t.d, r.d)) <= 3); if (i > -1) { cand.splice(i, 1); dup++; continue; } }
    let amt = r.amt;
    if (amt == null) { const rate = r.cur === base ? 1 : fx[r.cur]; if (!rate) { noFx++; amt = r.amtLoc; } else amt = T.round2(r.amtLoc * rate); }
    const tx = { id: r.id, d: r.d, desc: r.desc, amt, amtLoc: r.amtLoc, cur: r.cur, src: source, rcat: r.rcat || "", acct: r.acct || "" };
    if (r.pending) tx.pending = true;
    Object.assign(tx, T.classify(tx, st));
    st.txs.push(tx); have.add(r.id); added++;
  }
  st.txs.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  return { added, dup, noFx, total: rows.length, from: rows.length ? rows.reduce((m, r) => r.d < m ? r.d : m, rows[0].d) : null, to: rows.length ? rows.reduce((m, r) => r.d > m ? r.d : m, rows[0].d) : null };
};
})();
