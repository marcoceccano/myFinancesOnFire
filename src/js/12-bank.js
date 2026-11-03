/* myFinances on FIRE · collegamento automatico con la banca (open banking, sola lettura)
   L'app parla solo con il ponte dell'utente (ponte/worker.js); il ponte parla con Enable Banking. */
"use strict";
(function () {
T.BANK_DEFAULTS = { url: "", token: "", country: "LT", aspsp: "Revolut", session: null, validUntil: null, accounts: [],
  lastSync: null, lastResult: null, lastError: null, auto: true, pendingState: null, cursors: {} };
T.bankDefaults = () => JSON.parse(JSON.stringify(T.BANK_DEFAULTS));
T.randomToken = n => { const b = new Uint8Array(n || 32); crypto.getRandomValues(b); let s = ""; b.forEach(x => s += String.fromCharCode(x)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
T.bankConnected = st => !!(st.bank && st.bank.session && st.bank.accounts && st.bank.accounts.length);
T.bankExpired = st => !!(st.bank && st.bank.validUntil && Date.parse(st.bank.validUntil) < Date.now());
T.bankDaysLeft = st => st.bank && st.bank.validUntil ? Math.floor((Date.parse(st.bank.validUntil) - Date.now()) / 864e5) : null;

T.bankErrorText = (status, d) => {
  const e = (d && d.error) || "", det = String((d && (d.detail || d.message)) || "");
  if (status === 401 || e === "unauthorized") return "Il codice di accesso non corrisponde a quello impostato nel ponte (APP_TOKEN).";
  if (e === "origin_not_allowed") return "Il ponte non accetta richieste da questo indirizzo: controlla ALLOWED_ORIGIN.";
  if (/EXPIRED|REVOKED|CLOSED|INVALID_SESSION|SESSION_NOT|access.?expired|consent/i.test(det)) return "Il consenso Revolut e' scaduto o e' stato revocato: ricollega Revolut.";
  if (/REDIRECT/i.test(det)) return "L'indirizzo di ritorno non e' registrato su Enable Banking: controlla REDIRECT_URL e gli Allowed redirect URLs.";
  if (/NOT_ACTIVE|inactive|not active|NOT_ACTIVATED/i.test(det)) return "L'applicazione Enable Banking non e' ancora attiva: collega il tuo conto dal Control Panel.";
  if (/kid|JWT|signature|token/i.test(det)) return "Enable Banking non riconosce la firma: controlla EB_APP_ID e EB_PRIVATE_KEY nel ponte.";
  if (e === "bank_not_found") return "Revolut non e' disponibile per il paese scelto: prova un altro paese.";
  if (status === 429 || /TOO_MANY|rate/i.test(det)) return "Troppe richieste alla banca: riprova tra qualche ora.";
  return "Errore " + status + (e ? " (" + e + ")" : "") + (det ? ": " + det.slice(0, 180) : "");
};
T.bankCall = async (st, path, body) => {
  const B = st.bank;
  if (!B || !B.url || !B.token) throw new Error("Il ponte non e' configurato: inserisci indirizzo e codice di accesso.");
  let r;
  try { r = await fetch(B.url.trim().replace(/\/+$/, "") + path, { method: "POST", headers: { "Authorization": "Bearer " + B.token.trim(), "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); }
  catch (e) { throw new Error("Il ponte non risponde: controlla l'indirizzo e la connessione."); }
  let d = null; try { d = await r.json(); } catch (e) { }
  if (!r.ok) { const err = new Error(T.bankErrorText(r.status, d)); err.status = r.status; err.data = d; throw err; }
  return d;
};

/* movimento Enable Banking -> riga di import */
T.mapEbTx = (t, acc) => {
  const ta = t.transaction_amount || {}, x = parseFloat(ta.amount);
  if (!isFinite(x)) return null;
  const ind = t.credit_debit_indicator;
  const amt = ind === "DBIT" ? -Math.abs(x) : ind === "CRDT" ? Math.abs(x) : x;
  const d = T.parseDate(t.transaction_date || t.booking_date || t.value_date); if (!d) return null;
  const party = amt < 0 ? t.creditor && t.creditor.name : t.debtor && t.debtor.name;
  const rem = (t.remittance_information || []).filter(s => s && !/^RF\d{2}|^\d{8,}$/.test(String(s).trim())).join(" ").trim();
  const btc = t.bank_transaction_code || {}, code = String(btc.description || btc.code || "");
  const desc = String(party || rem || t.note || code || "Movimento").replace(/\s+/g, " ").trim();
  const c = (code + " " + rem + " " + desc).toLowerCase();
  const rcat = /exchange|conversion|cambio valuta|conversione/.test(c) ? "Cambio valuta"
    : /top.?up|ricarica|aufladung/.test(c) ? "Ricarica"
    : /\batm\b|cash withdrawal|prelievo/.test(c) ? "Prelievo"
    : /refund|rimborso|rückerstattung/.test(c) || (amt > 0 && t.merchant_category_code) ? "Rimborso"
    : t.merchant_category_code || /card/.test(c) ? "Esercente" : "";
  const ref = t.transaction_id || t.entry_reference || null;
  return { d, desc, rcat, amtLoc: T.round2(amt), cur: ta.currency || acc.currency || "", amt: null, fee: 0,
    acct: acc.name ? acc.name + (acc.currency ? " (" + acc.currency + ")" : "") : "Revolut " + (acc.currency || ""),
    pending: t.status === "PDNG", fixedId: ref ? T.hash("revolut-api|" + acc.uid + "|" + ref) : null };
};

/* scarica i movimenti nuovi di tutti i conti collegati */
T.bankSync = async (st, opt) => {
  opt = opt || {};
  const B = st.bank;
  if (!T.bankConnected(st)) throw new Error("Revolut non e' collegato.");
  if (T.bankExpired(st)) throw new Error("Il consenso Revolut e' scaduto: ricollega Revolut.");
  const today = T.today(), rows = [];
  const fam = st.txs.filter(t => /^revolut/.test(t.src || "") && !t.pending).map(t => t.d).sort();
  const lastKnown = fam.length ? fam[fam.length - 1] : null;
  for (const acc of B.accounts) {
    let from = opt.from || (B.cursors[acc.uid] ? T.addDays(B.cursors[acc.uid], -10) : lastKnown ? T.addDays(lastKnown, -10) : T.addDays(today, -89));
    if (from > today) from = today;
    let key = null, pages = 0, maxBooked = B.cursors[acc.uid] || null;
    do {
      const d = await T.bankCall(st, "/transactions", { account_uid: acc.uid, date_from: from, continuation_key: key || undefined });
      for (const t of (d && d.transactions) || []) {
        const r = T.mapEbTx(t, acc); if (!r) continue;
        rows.push(r);
        if (!r.pending && (!maxBooked || r.d > maxBooked)) maxBooked = r.d;
      }
      key = (d && d.continuation_key) || null; pages++;
    } while (key && pages < 40);
    if (maxBooked) B.cursors[acc.uid] = maxBooked > today ? today : maxBooked;
  }
  /* i movimenti in sospeso vengono sostituiti a ogni aggiornamento, conservando le modifiche fatte a mano */
  const old = {};
  st.txs = st.txs.filter(t => { if (t.src === "revolut-api" && t.pending) { old[t.id] = t; return false; } return true; });
  const res = T.mergeTxs(st, rows, "revolut-api");
  let back = 0;
  for (const t of st.txs) {
    const o = old[t.id]; if (!o) continue; back++;
    if (o.manual || o.note || o.vac != null) ["manual", "flow", "cat", "kind", "note", "vac"].forEach(k => { if (o[k] !== undefined) t[k] = o[k]; });
  }
  B.lastSync = new Date().toISOString(); B.lastError = null;
  B.lastResult = { added: Math.max(0, res.added - back), dup: res.dup, pending: st.txs.filter(t => t.src === "revolut-api" && t.pending).length, received: rows.length, noFx: res.noFx };
  return B.lastResult;
};
})();
