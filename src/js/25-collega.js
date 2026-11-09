/* myFinances on FIRE · schermata del collegamento automatico e aggiornamento */
"use strict";
(function () {
const h = T.h, A = T.A;
const COUNTRIES = [["LT", T.tr("Lituania (Revolut Bank UAB)")], ["CH", T.tr("Svizzera")], ["IT", T.tr("Italia")], ["DE", T.tr("Germania")], ["FR", T.tr("Francia")], ["ES", T.tr("Spagna")], ["IE", T.tr("Irlanda")], ["NL", T.tr("Paesi Bassi")], ["AT", T.tr("Austria")], ["BE", T.tr("Belgio")], ["PT", T.tr("Portogallo")], ["PL", T.tr("Polonia")]];
A.appUrl = () => { try { return location.origin + location.pathname.replace(/index\.html$/, ""); } catch (e) { return ""; } };
const copy = async (txt, what) => {
  try { await navigator.clipboard.writeText(txt); T.toast(what + T.tr(" copiato")); }
  catch (e) { T.sheet(what, h("div", h("p.small.muted", T.tr("Tieni premuto sul testo per copiarlo.")), h("input", { type: "text", value: txt, readonly: true })), [h("button.btn.primary", { type: "button", onclick: T.closeSheet }, "Ok")]); }
};
A.relTime = iso => {
  if (!iso) return "mai"; const d = new Date(iso), now = new Date();
  const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  const ds = T.iso(d); return ds === T.today() ? T.tr("oggi alle ") + hm : ds === T.addDays(T.today(), -1) ? T.tr("ieri alle ") + hm : T.fmt.date(ds) + T.tr(" alle ") + hm;
};

/* aggiornamento: manuale o automatico all'apertura */
A.syncNow = async silent => {
  if (A._syncing) return; A._syncing = true; A.renderBar();
  try {
    const r = await T.bankSync(A.S);
    A.fire.key = ""; await T.save(A.S, true);
    if (A.inFamily && A.inFamily()) A.famSoon(300);
    if (!silent || r.added) T.toast(r.added ? r.added + (r.added === 1 ? T.tr(" nuovo movimento") : T.tr(" nuovi movimenti")) + T.tr(" da Revolut") : T.tr("Revolut aggiornato: niente di nuovo"));
    if (r.noFx) T.toast(T.tr("Manca il cambio per alcune valute: aggiungilo in Profilo e reddito"));
  } catch (e) {
    A.S.bank.lastError = e.message; A.save();
    if (silent) T.toast(T.tr("Aggiornamento Revolut non riuscito: ") + e.message.slice(0, 80));
    else T.sheet(T.tr("Aggiornamento non riuscito"), h("p", e.message), [h("button.btn", { type: "button", onclick: T.closeSheet }, T.tr("Chiudi")), h("button.btn.primary", { type: "button", onclick: () => { T.closeSheet(); A.go("altro", "collega"); } }, T.tr("Apri il collegamento"))]);
  } finally { A._syncing = false; A.render(); }
};
A.autoSync = () => {
  const S = A.S; if (!S || !T.bankConnected(S) || !S.bank.auto || A._syncing || T.bankExpired(S)) return;
  if (S.bank.lastSync && Date.now() - Date.parse(S.bank.lastSync) < 4 * 3600e3) return;
  A.syncNow(true);
};

/* consenso: andata verso Revolut e ritorno nell'app */
A.startConnect = async () => {
  const S = A.S, B = S.bank;
  try {
    T.toast(T.tr("Preparazione del collegamento..."));
    const banks = (await T.bankCall(S, "/banks", { country: B.country, name: "revolut" })).banks || [];
    if (!banks.length) throw new Error(T.tr("Revolut non risulta disponibile per ") + B.country + T.tr(": prova un altro paese."));
    const bank = banks.find(b => b.name.toLowerCase() === "revolut") || banks[0];
    B.aspsp = bank.name; B.pendingState = T.randomToken(24);
    const d = await T.bankCall(S, "/connect", { country: B.country, name: bank.name, state: B.pendingState, days: 180, language: S.profile.lang || "it" });
    await T.save(S, true);
    location.href = d.url;
  } catch (e) { T.sheet(T.tr("Collegamento non avviato"), h("p", e.message), [h("button.btn.primary", { type: "button", onclick: T.closeSheet }, "Ok")]); }
};
A.finishConnect = async qs => {
  const S = A.S, B = S.bank;
  const err = qs.get("error"), code = qs.get("code"), state = qs.get("state");
  if (err) { T.sheet(T.tr("Collegamento annullato"), h("p", (qs.get("error_description") || err) + "."), [h("button.btn.primary", { type: "button", onclick: T.closeSheet }, "Ok")]); B.pendingState = null; A.save(); return; }
  if (!code) return;
  if (!B.pendingState || state !== B.pendingState) { T.sheet(T.tr("Collegamento non riconosciuto"), h("p", T.tr("Il ritorno da Revolut non corrisponde a un collegamento avviato da questa app. Riprova da Altro > Collegamento automatico.")), [h("button.btn.primary", { type: "button", onclick: T.closeSheet }, "Ok")]); return; }
  try {
    T.toast(T.tr("Completamento del collegamento..."));
    const d = await T.bankCall(S, "/session", { code });
    if (!d.accounts || !d.accounts.length) throw new Error(T.tr("Nessun conto autorizzato. Se l'app Enable Banking e' in modalita' ristretta, collega lo stesso conto anche dal Control Panel."));
    Object.assign(B, { session: d.session_id, validUntil: d.valid_until || null, accounts: d.accounts, pendingState: null, lastError: null });
    S.profile.onboarded = true;
    await T.save(S, true);
    T.toast(T.tr("Revolut collegato: ") + d.accounts.length + (d.accounts.length === 1 ? T.tr(" conto") : T.tr(" conti")));
    A.go("altro", "collega", true);
    await A.syncNow(false);
  } catch (e) { B.pendingState = null; A.save(); T.sheet(T.tr("Collegamento non completato"), h("p", e.message), [h("button.btn.primary", { type: "button", onclick: T.closeSheet }, "Ok")]); }
};
A.disconnect = async () => {
  const S = A.S, B = S.bank;
  if (!(await T.confirm(T.tr("Scollegare Revolut?"), T.tr("Il consenso viene chiuso. I movimenti gia' scaricati restano nell'app."), T.tr("Scollega"), true))) return;
  try { if (B.session) await T.bankCall(S, "/disconnect", { session_id: B.session }); } catch (e) { }
  Object.assign(B, { session: null, validUntil: null, accounts: [], pendingState: null, cursors: {} });
  await T.save(S, true); T.toast(T.tr("Revolut scollegato")); A.render();
};

/* schermata */
A.renderCollega = card => {
  const S = A.S, B = S.bank, on = T.bankConnected(S), exp = T.bankExpired(S), left = T.bankDaysLeft(S);
  card.appendChild(h("h2", T.tr("Collegamento automatico Revolut")));
  card.appendChild(h("p.sub", T.tr("I movimenti arrivano da soli, in sola lettura, tramite Enable Banking e il tuo ponte personale. L'import dei file resta sempre disponibile.")));
  const member = A.isMember && A.isMember();
  if (member) card.appendChild(h("div.note", { style: { marginBlockEnd: "10px" } }, T.tr("Il collegamento Revolut e' di {n} e arriva con la famiglia: qui puoi aggiornare i movimenti. Il consenso lo rinnova {n} dal suo telefono.", { n: A.masterName() })));
  /* stato */
  if (on) {
    card.appendChild(h("div.note" + (exp || (left != null && left < 14) ? ".warn" : ""),
      h("b", exp ? T.tr("Consenso scaduto") : T.tr("Collegato")), h("div", B.validUntil ? (exp ? T.tr("Scaduto il ") : T.tr("Valido fino al ")) + T.fmt.date(B.validUntil.slice(0, 10)) + (left != null && !exp ? " (" + left + T.tr(" giorni)") : "") : ""),
      h("div", T.tr("Ultimo aggiornamento: ") + A.relTime(B.lastSync) + (B.lastResult ? ", " + B.lastResult.added + T.tr(" nuovi") + (B.lastResult.pending ? ", " + B.lastResult.pending + T.tr(" in sospeso") : "") : "")),
      B.lastError ? h("div.bad", B.lastError) : null));
    card.appendChild(h("div.list", B.accounts.map(a => h("div.li", h("div.grow", h("div.t", (a.currency || "") + " " + (a.name || T.tr("Conto"))), h("div.d", a.iban || ""))))));
    card.appendChild(h("label.row", { style: { marginBlock: "10px" } }, h("input", { type: "checkbox", checked: B.auto, onchange: e => { B.auto = e.target.checked; A.save(); } }), T.tr("Aggiorna da solo all'apertura (al massimo ogni 4 ore)")));
    card.appendChild(h("div.row.wrap", h("button.btn.primary", { type: "button", disabled: !!A._syncing || exp, onclick: () => A.syncNow(false) }, A._syncing ? T.tr("Aggiornamento...") : T.tr("Aggiorna ora")),
      member ? null : h("button.btn", { type: "button", onclick: () => A.startConnect() }, exp ? T.tr("Ricollega Revolut") : T.tr("Rinnova il consenso")), member ? null : h("button.btn.danger", { type: "button", onclick: () => A.disconnect() }, T.tr("Scollega"))));
  } else card.appendChild(h("div.note", member ? T.tr("Revolut non e' collegato in questo momento: lo collega {n} dal suo telefono.", { n: A.masterName() }) : T.tr("Non collegato. Segui i 3 passi qui sotto (la guida completa e' nel file GUIDA-COLLEGAMENTO-REVOLUT.md del progetto).")));
  if (member) return;

  /* passo 1: indirizzo dell'app */
  const url = A.appUrl();
  card.appendChild(h("details.acc", { open: on ? null : "" }, h("summary", T.tr("1 \u00b7 Indirizzo di questa app")), h("div.acc-in",
    h("p.small.muted", T.tr("Serve in due posti: su Enable Banking (Allowed redirect URLs) e nel ponte (REDIRECT_URL). Per ALLOWED_ORIGIN usa solo la parte iniziale.")),
    h("div.field", h("label", "REDIRECT_URL"), h("div.row", h("input", { type: "text", value: url, readonly: true }), h("button.btn", { type: "button", onclick: () => copy(url, T.tr("Indirizzo")) }, T.tr("Copia")))),
    h("div.field", h("label", "ALLOWED_ORIGIN"), h("div.row", h("input", { type: "text", value: location.origin, readonly: true }), h("button.btn", { type: "button", onclick: () => copy(location.origin, T.tr("Origine")) }, T.tr("Copia")))),
    /^https:/.test(location.protocol) ? null : h("div.note.warn", T.tr("L'app e' aperta da un file locale: il collegamento funziona solo dalla versione pubblicata su https.")))));

  /* passo 2: ponte */
  const res = h("div");
  card.appendChild(h("details.acc", { open: on ? null : "" }, h("summary", T.tr("2 \u00b7 Il tuo ponte (Cloudflare)")), h("div.acc-in",
    T.textField(T.tr("Indirizzo del ponte"), B.url, v => { B.url = v.trim(); A.save(); }, { ph: "https://myfinances-ponte.tuonome.workers.dev", hint: T.tr("Lo trovi in Cloudflare, nella pagina del Worker.") }),
    h("div.field", h("label", T.tr("Codice di accesso (APP_TOKEN)")),
      h("div.row", h("input", { type: "text", value: B.token, "aria-label": T.tr("Codice di accesso"), oninput: e => { B.token = e.target.value.trim(); A.save(); } }),
        h("button.btn", { type: "button", onclick: async () => { if (B.token && !(await T.confirm(T.tr("Generare un nuovo codice?"), T.tr("Dovrai incollare il nuovo codice anche nel ponte (APP_TOKEN), altrimenti il collegamento smette di funzionare."), T.tr("Genera")))) return; B.token = T.randomToken(32); A.save(); A.render(); } }, T.tr("Genera"))),
      h("div.row", { style: { marginBlockStart: "6px" } }, h("button.btn", { type: "button", disabled: !B.token, onclick: () => copy(B.token, T.tr("Codice")) }, T.tr("Copia il codice")), h("span.small.muted", T.tr("da incollare in Cloudflare come APP_TOKEN")))),
    h("button.btn.primary", { type: "button", onclick: async () => {
      T.clear(res); res.appendChild(h("div.row", h("span.spinner"), h("span.muted", T.tr("Verifica..."))));
      try {
        const d = await T.bankCall(S, "/check", {});
        T.clear(res);
        const line = (okv, txt) => h("div", (okv ? "\u2705 " : "\u274c ") + txt);
        res.appendChild(h("div.note", line(true, T.tr("Ponte raggiungibile e codice corretto")), line(true, T.tr("Applicazione Enable Banking: ") + (d.name || "") + " (" + (d.environment || "") + ")"),
          line(d.environment === "PRODUCTION", T.tr("Ambiente di produzione") + (d.environment === "PRODUCTION" ? "" : T.tr(": registra l'app in PRODUCTION, non in SANDBOX"))),
          (() => { const v = d.version || "", okv = !!v && T.verCmp(v, T.BRIDGE_VERSION) >= 0;
            return line(okv, okv ? T.tr("Versione del ponte: {v} (aggiornata)", { v }) : T.tr("Versione del ponte: {v}. Aggiorna alla {n}: in Cloudflare incolla il nuovo ponte/worker.js e premi Deploy.", { v: v || "?", n: T.BRIDGE_VERSION })); })(),
          line(!!d.ibkr, d.ibkr ? T.tr("Interactive Brokers configurato") : T.tr("Interactive Brokers non configurato (facoltativo)")),
          line(!!d.family, d.family ? T.tr("Spazio per la famiglia pronto") : T.tr("Spazio per la famiglia assente (serve solo se vuoi condividere con un altro telefono)")),
          line(!!d.active, d.active ? T.tr("Applicazione attiva") : T.tr("Applicazione non ancora attiva: nel Control Panel usa \u00abActivate by linking accounts\u00bb")),
          line(!!d.redirect_ok && d.redirect_url === url, d.redirect_ok && d.redirect_url === url ? T.tr("Indirizzo di ritorno corretto") : T.tr("Indirizzo di ritorno: nel ponte c'e' \u00ab") + (d.redirect_url || "") + T.tr("\u00bb, l'app e' su \u00ab") + url + T.tr("\u00bb e su Enable Banking deve esserci lo stesso indirizzo"))));
      } catch (e) { T.clear(res); res.appendChild(h("div.note.warn", e.message)); }
    } }, T.tr("Verifica il ponte")), res)));

  /* passo 3: banca */
  card.appendChild(h("details.acc", { open: on ? null : "" }, h("summary", T.tr("3 \u00b7 Collega Revolut")), h("div.acc-in",
    T.selectField(T.tr("Paese di Revolut"), B.country, COUNTRIES, v => { B.country = v; A.save(); }, { hint: T.tr("Per i conti Revolut con IBAN LT usa Lituania. Se Revolut non viene trovato, prova Svizzera o Italia.") }),
    h("p.small.muted", T.tr("Si apre la pagina di Enable Banking e poi l'app Revolut, dove confermi l'accesso in sola lettura. Fallo dal telefono su cui hai l'app Revolut. Alla fine torni qui e i movimenti si scaricano.")),
    h("button.btn.primary.block", { type: "button", disabled: !B.url || !B.token, onclick: () => A.startConnect() }, on ? T.tr("Ricollega Revolut") : T.tr("Collega Revolut")))));
};
})();
