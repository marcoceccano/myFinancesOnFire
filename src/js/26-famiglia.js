/* myFinances on FIRE · schermata Famiglia, ingresso con il QR, allineamento automatico, ricomincia da zero */
"use strict";
(function () {
const h = T.h, A = T.A;
A.isMember = () => !!(A.S && A.S.family && A.S.family.role === "member");
A.inFamily = () => !!(A.S && A.S.family && A.S.family.id);
A.masterName = () => (A.S.family && (A.S.family.master || "")) || T.tr("chi ha creato la famiglia");

/* ---------- allineamento ---------- */
const editing = () => { const ae = document.activeElement; return !T.$("sheet").hidden || !!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName || "")); };
A.softRender = () => { if (editing()) { A._dirtyRender = true; return; } A._dirtyRender = false; A.render(); };
A.famSync = async (silent, force) => {
  const S = A.S;
  if (!A.inFamily() || S.family.gone && !force) return null;
  if (A._famBusy) { A._famAgain = true; return null; }
  /* mentre scrivi o hai un foglio aperto aspetta un poco, per non cambiare i dati sotto le dita */
  if (!force && editing() && (A._famWait = (A._famWait || 0) + 1) <= 6) { A.famSoon(5000); return null; }
  A._famWait = 0; A._famBusy = true;
  let res = null;
  try {
    res = await T.famSync(S);
    S.family.lastError = null;
    if (res.pulled) { A.fire.key = ""; if (res.by && res.by !== S.family.name) T.toast(T.tr("Aggiornato con le modifiche di {n}", { n: res.by })); }
  } catch (e) {
    if (S.family) S.family.lastError = e.message;
    if (!silent) T.toast(e.message);
  } finally {
    A._famSaving = true; try { await T.save(S, true); } finally { A._famSaving = false; }
    A._famBusy = false;
    if ((res && res.pulled) || (S.family && S.family.gone) || A.view === "altro") A.softRender();
    if (A._famAgain) { A._famAgain = false; A.famSoon(1500); }
  }
  return res;
};
A.famSoon = ms => { clearTimeout(A._famT); A._famT = setTimeout(() => A.famSync(true), ms == null ? 5000 : ms); };
T.onSaved = st => { if (A.S && st === A.S && A.inFamily() && !st.family.gone && !A._famSaving) A.famSoon(); };

/* ---------- ingresso dal QR (o dal collegamento incollato) ---------- */
A.joinFlow = p => {
  const S = A.S;
  if (S.family && S.family.id === p.fid) { T.toast(T.tr("Questo telefono e' gia' in questa famiglia")); return; }
  const st = { name: "" }, msg = h("div");
  const hasData = S.txs.length > 0;
  const body = h("div",
    h("p", T.tr("{n} ti invita a condividere spese, categorie e budget.", { n: p.name || T.tr("Qualcuno") })),
    h("p.small.muted", T.tr("Vedrai gli stessi dati e potrai modificarli; i movimenti Revolut arrivano anche qui. Il FIRE e il reddito li gestisce {n}.", { n: p.name || T.tr("chi ti invita") })),
    T.textField(T.tr("Il tuo nome"), "", v => st.name = v.trim(), { ph: T.tr("per esempio Debora") }),
    hasData ? h("div.note.warn", T.tr("I dati gia' presenti su questo telefono vengono sostituiti da quelli della famiglia.")) : null,
    S.family ? h("div.note.warn", { style: { marginBlockStart: "8px" } }, T.tr("Questo telefono e' gia' in un'altra famiglia: entrando qui, esci da quella.")) : null,
    msg);
  const go = h("button.btn.primary", { type: "button", onclick: async () => {
    go.disabled = true; T.clear(msg); msg.appendChild(h("div.row", { style: { marginBlockStart: "10px" } }, h("span.spinner"), h("span.muted", T.tr("Scarico i dati della famiglia..."))));
    try {
      const ns = await T.famJoin(p, st.name || T.tr("Telefono"), T.LANG);
      A.S = ns; A.fire.key = ""; A.ui.week = null;
      await T.save(ns, true);
      T.closeSheet(); T.toast(T.tr("Ora sei nella famiglia di {n}", { n: p.name || "" }));
      A.go("home", null, true);
      A.famSync(true).then(() => A.autoSync());
    } catch (e) { go.disabled = false; T.clear(msg); msg.appendChild(h("div.note.warn", { style: { marginBlockStart: "10px" } }, e.message)); }
  } }, T.tr("Entra nella famiglia"));
  T.sheet(T.tr("Entra nella famiglia"), body, [h("button.btn", { type: "button", onclick: () => T.closeSheet() }, T.tr("Annulla")), go]);
};
/* collegamento con #famiglia=... all'apertura: lo toglie subito dalla barra degli indirizzi */
A._joinHash = (() => { try { return location.hash || ""; } catch (e) { return ""; } })();   /* letto subito, prima di ogni navigazione */
A.checkJoinLink = () => {
  const hash = A._joinHash || ""; A._joinHash = "";
  if (!/famiglia=/.test(hash)) return false;
  try { history.replaceState(null, "", location.pathname + (location.search || "")); } catch (e) { }
  const p = T.famParse(hash);
  if (!p) { T.toast(T.tr("Il QR della famiglia non e' valido")); return false; }
  A.joinFlow(p); return true;
};

/* ---------- schermata Famiglia (Altro > Famiglia) ---------- */
A.renderFamiglia = card => {
  const S = A.S, F = S.family, B = S.bank;
  card.appendChild(h("h2", T.tr("Famiglia")));
  const devices = () => {
    const list = h("div.list");
    Object.entries(F.devices || {}).sort((a, b) => (a[1].role === "master" ? 0 : 1) - (b[1].role === "master" ? 0 : 1)).forEach(([id, d]) => list.appendChild(h("div.li",
      h("div.grow", h("div.t", (d.name || T.tr("Telefono")) + (id === F.device ? T.tr(" (questo telefono)") : "")), h("div.d", (d.role === "master" ? T.tr("gestisce il FIRE") : T.tr("spese e budget")) + " \u00b7 " + T.tr("visto ") + A.relTime(d.seen))))));
    return list;
  };
  const status = () => h("div.note" + (F.gone || F.lastError ? ".warn" : ""),
    h("b", F.gone ? T.tr("La famiglia non e' piu' raggiungibile") : F.role === "master" ? T.tr("Famiglia attiva") : T.tr("Sei nella famiglia di {n}", { n: A.masterName() })),
    h("div", F.gone ? T.tr("E' stata sciolta o la chiave e' cambiata. Chiedi un QR nuovo oppure esci dalla famiglia.") : T.tr("Ultimo allineamento: ") + A.relTime(F.lastSync)),
    F.lastError && !F.gone ? h("div.bad", F.lastError) : null);
  const joinBox = () => {
    let val = "";
    return h("details.acc", h("summary", T.tr("Hai ricevuto un QR?")), h("div.acc-in",
      h("p.small.muted", T.tr("Inquadralo con la fotocamera del telefono e tocca il collegamento: si apre l'app e ti chiede di entrare. In alternativa incolla qui il collegamento.")),
      T.textField(T.tr("Collegamento della famiglia"), "", v => val = v, { ph: "https://...#famiglia=..." }),
      h("button.btn", { type: "button", onclick: () => { const p = T.famParse(val); if (!p) T.toast(T.tr("Il collegamento non e' valido")); else A.joinFlow(p); } }, T.tr("Entra"))));
  };
  if (!F) {
    card.appendChild(h("p.sub", T.tr("Condividi spese, categorie, budget e collegamento Revolut con un altro telefono, per esempio quello di tua moglie o di tuo marito. I dati passano dal tuo ponte gia' cifrati: senza la chiave del QR nessuno li puo' leggere, nemmeno Cloudflare.")));
    [T.tr("Spese, categorie, regole, budget, costi fissi e vacanze: li modificate tutti e due."),
     T.tr("FIRE e reddito: li gestisci tu, gli altri li vedono."),
     T.tr("Revolut: i movimenti li scarica un telefono alla volta e arrivano anche sull'altro.")].forEach(t => card.appendChild(h("p.small", "\u2022 " + t)));
    if (!B.url || !B.token) {
      card.appendChild(h("div.note.warn", T.tr("Per creare la famiglia serve il ponte: configuralo prima in Collegamento automatico.")));
      card.appendChild(h("button.btn", { type: "button", style: { marginBlockStart: "10px" }, onclick: () => A.go("altro", "collega") }, T.tr("Apri il collegamento")));
    } else {
      let name = S.profile.name && !/\se\s|&/.test(S.profile.name) ? S.profile.name : "";
      const msg = h("div");
      card.appendChild(T.textField(T.tr("Il tuo nome"), name, v => name = v.trim(), { ph: T.tr("per esempio Marco") }));
      const btn = h("button.btn.primary.block", { type: "button", onclick: async () => {
        btn.disabled = true; T.clear(msg); msg.appendChild(h("div.row", { style: { marginBlockStart: "10px" } }, h("span.spinner"), h("span.muted", T.tr("Creo la famiglia..."))));
        try { await T.famCreate(S, name || T.tr("Telefono")); await T.save(S, true); A.ui.showQr = true; T.toast(T.tr("Famiglia creata")); A.render(); }
        catch (e) { btn.disabled = false; T.clear(msg); msg.appendChild(h("div.note.warn", { style: { marginBlockStart: "10px" } }, e.message)); }
      } }, T.tr("Crea la famiglia"));
      card.appendChild(btn); card.appendChild(msg);
    }
    card.appendChild(joinBox());
    return;
  }
  card.appendChild(status());
  if (!F.gone) card.appendChild(h("p.small.muted", { style: { marginBlockStart: "8px" } }, F.role === "master"
    ? T.tr("Spese, categorie e budget sono condivisi. FIRE e reddito li gestisci tu.")
    : T.tr("Spese, categorie e budget sono condivisi. FIRE e reddito li gestisce {n}: qui li vedi.", { n: A.masterName() })));
  card.appendChild(h("h4", T.tr("Telefoni")));
  card.appendChild(devices());
  card.appendChild(h("div.row.wrap", { style: { marginBlockStart: "10px" } },
    h("button.btn", { type: "button", disabled: !!A._famBusy, onclick: async () => { await A.famSync(false, true); A.render(); } }, T.tr("Allinea ora"))));
  if (F.role === "master" && !F.gone) {
    const qrBox = h("div.qr-box");
    const fillQr = () => {
      T.clear(qrBox);
      if (!A.ui.showQr) { qrBox.appendChild(h("button.btn.primary.block", { type: "button", onclick: () => { A.ui.showQr = true; fillQr(); } }, T.tr("Mostra il QR per aggiungere un telefono"))); return; }
      const link = T.famLink(S, A.appUrl());
      qrBox.appendChild(h("div.qr-wrap", T.qrSvg(link, 280, T.tr("QR per entrare nella famiglia"))));
      qrBox.appendChild(h("ol.steps",
        h("li", T.tr("Sull'altro telefono apri la fotocamera e inquadra il QR.")),
        h("li", T.tr("Tocca il collegamento che compare: si apre l'app con i tuoi dati e chiede il nome.")),
        h("li", T.tr("Dal menu del browser scegli Installa app (o Aggiungi a schermata Home)."))));
      qrBox.appendChild(h("div.note.warn", T.tr("Mostralo solo di persona: chi ha questo QR vede tutte le vostre finanze. Non fare screenshot e non inviarlo in chat.")));
      qrBox.appendChild(h("button.btn.block", { type: "button", style: { marginBlockStart: "8px" }, onclick: () => { A.ui.showQr = false; fillQr(); } }, T.tr("Nascondi il QR")));
    };
    fillQr();
    card.appendChild(h("h4", T.tr("Aggiungi un telefono")));
    card.appendChild(qrBox);
    card.appendChild(h("h4", T.tr("Sicurezza")));
    card.appendChild(h("div.row.wrap",
      h("button.btn", { type: "button", onclick: async () => {
        if (!(await T.confirm(T.tr("Cambiare la chiave?"), T.tr("Gli altri telefoni smettono di ricevere gli aggiornamenti finche' non inquadrano il nuovo QR. Usalo se hai perso un telefono o se il QR e' finito in mani sbagliate."), T.tr("Cambia la chiave"), true))) return;
        try { await T.famRekey(S); await T.save(S, true); A.ui.showQr = true; T.toast(T.tr("Chiave cambiata: fai inquadrare il nuovo QR")); A.render(); } catch (e) { T.toast(e.message); }
      } }, T.tr("Cambia la chiave")),
      h("button.btn.danger", { type: "button", onclick: async () => {
        if (!(await T.confirm(T.tr("Sciogliere la famiglia?"), T.tr("La copia condivisa viene cancellata dal ponte. Ogni telefono tiene i dati che ha, ma non si allineano piu'."), T.tr("Sciogli"), true))) return;
        await T.famLeave(S); await T.save(S, true); T.toast(T.tr("Famiglia sciolta")); A.render();
      } }, T.tr("Sciogli la famiglia"))));
  } else {
    card.appendChild(h("button.btn.danger", { type: "button", style: { marginBlockStart: "10px" }, onclick: async () => {
      if (!(await T.confirm(T.tr("Uscire dalla famiglia?"), T.tr("Su questo telefono resta una copia dei dati, senza il collegamento Revolut di {n}.", { n: A.masterName() }), T.tr("Esci"), true))) return;
      await T.famLeave(S); await T.save(S, true); T.toast(T.tr("Non fai piu' parte della famiglia")); A.render();
    } }, T.tr("Esci dalla famiglia")));
    if (F.gone) card.appendChild(joinBox());
  }
};

/* ---------- ricomincia da zero ---------- */
A.resetFlow = () => {
  const S = A.S, B = S.bank, F = S.family, member = A.isMember(), canKeep = !member && !!(B.url && B.token);
  const st = { keep: canKeep };
  const body = h("div",
    h("p", T.tr("Cancella da questo telefono movimenti, categorie, regole, budget, costi fissi e impostazioni del FIRE, e riparte dalla configurazione iniziale.")),
    h("button.btn.block", { type: "button", onclick: () => A.exportBackup() }, T.tr("Scarica prima un backup")),
    canKeep ? h("label.row", { style: { gap: "10px", marginBlockStart: "12px", alignItems: "flex-start" } }, h("input", { type: "checkbox", checked: true, onchange: e => st.keep = e.target.checked }),
      h("span", h("b", T.tr("Tieni il ponte e il collegamento Revolut")), h("div.small.muted", T.bankConnected(S) ? T.tr("Non devi reinserire nulla: i movimenti Revolut degli ultimi 90 giorni si riscaricano da soli.") : T.tr("Non devi reinserire indirizzo e codice del ponte.")))) : null,
    F && !member ? h("div.note.warn", { style: { marginBlockStart: "12px" } }, T.tr("La famiglia viene sciolta: gli altri telefoni tengono la loro copia ma non ricevono piu' aggiornamenti.")) : null,
    member ? h("div.note.warn", { style: { marginBlockStart: "12px" } }, T.tr("Esci dalla famiglia di {n}: i dati condivisi restano sugli altri telefoni.", { n: A.masterName() })) : null);
  T.sheet(T.tr("Ricomincia da zero"), body, [h("button.btn", { type: "button", onclick: () => T.closeSheet() }, T.tr("Annulla")),
    h("button.btn.danger", { type: "button", onclick: async () => {
      if (!(await T.confirm(T.tr("Sei sicuro?"), T.tr("Tutti i dati di questo telefono vengono cancellati. Non si puo' annullare."), T.tr("Si', cancella tutto"), true))) return;
      await A.doReset(st.keep);
    } }, T.tr("Ricomincia"))]);
};
A.doReset = async keep => {
  const S = A.S, B = S.bank, F = S.family, member = A.isMember();
  clearTimeout(A._famT);
  if (F) { try { await T.famLeave(S); } catch (e) { } }
  if (!keep && !member && B.session) { try { await T.bankCall(S, "/disconnect", { session_id: B.session }); } catch (e) { } }
  const kept = keep && !member ? { url: B.url, token: B.token, country: B.country, aspsp: B.aspsp, session: B.session, validUntil: B.validUntil, accounts: B.accounts, auto: B.auto } : null;
  await T.storage.wipe();
  const ns = T.newState();
  if (kept && kept.url) Object.assign(ns.bank, kept);
  A.S = ns; A.fire.key = ""; A.fire.base = null; A.wiz.step = 0;
  A.ui = { months: null, vac: false, cat: null, q: "", page: 0, flow: "spesa", week: null };
  await T.save(ns, true);
  T.toast(T.tr("Fatto: l'app riparte da zero"));
  A.go("home", null, true);
};
})();
