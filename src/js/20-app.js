/* myFinances on FIRE · applicazione: stato, navigazione, Home */
"use strict";
(function () {
const h = T.h;
const A = T.A = { S: null, view: "home", sub: null, ui: { months: null, vac: false, cat: null, q: "", page: 0, flow: "spesa", week: null }, fire: { key: "", res: null, busy: false } };

A.save = () => T.save(A.S);
A.changed = () => { A.fire.key = ""; A.save(); A.render(); };
A.money = v => T.fmt.money(v);
A.cat = id => A.S.categories.find(c => c.id === id) || { id, name: T.tr("Senza categoria"), color: "#95A0B3" };

/* navigazione con il tasto indietro di Android */
A.go = (view, sub, replace) => {
  A.view = view; A.sub = sub || null;
  try { const st = { v: view, s: A.sub }; if (replace) history.replaceState(st, ""); else history.pushState(st, ""); } catch (e) { }
  A.render(); window.scrollTo && window.scrollTo(0, 0);
};
window.addEventListener && window.addEventListener("popstate", e => {
  if (!T.$("sheet").hidden) { T.closeSheet(); try { history.pushState({ v: A.view, s: A.sub }, ""); } catch (x) { } return; }
  const st = e.state || { v: "home" }; A.view = st.v || "home"; A.sub = st.s || null; A.render();
});

A.renderBar = () => {
  const b = T.$("btnSync"); if (!b || !A.S) return;
  b.hidden = !A.S.profile.onboarded || !T.bankConnected(A.S);
  b.classList.toggle("spin", !!A._syncing);
  b.disabled = !!A._syncing;
};
A.render = () => {
  const S = A.S, main = T.$("view");
  T.clear(main);
  T.fmt.cur = S.profile.currency || "CHF";
  const onb = !S.profile.onboarded;
  T.$("tabs").hidden = onb;
  T.setLang(S.profile.lang || "it", S.profile.currency);
  const TABS = { home: "Home", spese: "Spese", budget: "Budget", fire: "FIRE", altro: "Altro~menu" };
  document.querySelectorAll("#tabs button").forEach(b => { b.classList.toggle("on", b.dataset.tab === A.view); const sp = b.querySelector && b.querySelector("span"); if (sp) sp.textContent = T.tr(TABS[b.dataset.tab]); });
  T.$("tabs").setAttribute("aria-label", T.tr("Sezioni"));
  T.$("btnImport").setAttribute("aria-label", T.tr("Importa un estratto conto"));
  if (T.$("btnSync")) T.$("btnSync").setAttribute("aria-label", T.tr("Aggiorna da Revolut"));
  const cov = T.coverage(S);
  T.$("title").textContent = onb ? T.APP.name : ({ home: T.APP.name, spese: T.tr("Spese"), budget: "Budget", fire: T.tr("Obiettivo FIRE"), altro: T.tr("Altro~menu") })[A.view];
  T.$("subtitle").textContent = onb ? T.tr("Configurazione iniziale") : S.profile.demo ? T.tr("Dati di esempio · ") + (cov ? T.tr("fino al ") + T.fmt.date(cov.to) : "") : T.bankConnected(S) ? (A._syncing ? T.tr("Aggiornamento da Revolut...") : T.tr("Revolut aggiornato ") + A.relTime(S.bank.lastSync)) : cov ? T.tr("Dati fino al ") + T.fmt.date(cov.to) : T.tr("Nessun movimento importato");
  T.$("btnImport").hidden = onb;
  A.renderBar();
  if (onb) return A.renderOnboarding(main);
  const fn = { home: A.renderHome, spese: A.renderSpese, budget: A.renderBudget, fire: A.renderFire, altro: A.renderAltro }[A.view] || A.renderHome;
  fn(main);
};

/* ---------- risultati FIRE, calcolati in differita e messi in cache ---------- */
A.fireKey = (extra) => JSON.stringify([A.S.fire, A.S.fixed, A.S.categories.map(c => c.budget), A.S.budget, A.S.profile.incomeMonthly, A.S.txs.length, extra || ""]);
A.fireResult = cb => {
  const key = A.fireKey();
  if (A.fire.key === key && A.fire.res) return A.fire.res;
  if (!A.fire.busy) {
    A.fire.busy = true;
    setTimeout(() => { try { A.fire.res = T.simulateFire(A.S); A.fire.key = key; } catch (e) { console.error(e); A.fire.res = null; } A.fire.busy = false; cb && cb(); }, 30);
  }
  return null;
};

/* ---------- HOME ---------- */
A.renderHome = main => {
  const S = A.S, pic = T.picture(S), cov = T.coverage(S);
  if (!cov) {
    main.appendChild(h("div.card", h("h2", T.tr("Primo passo")), h("p", T.tr("Importa l'estratto conto della carta che usi per le spese di tutti i giorni (per esempio l'export Revolut). L'app lo legge sul telefono e lo divide in categorie.")),
      h("button.btn.primary.block", { type: "button", onclick: () => A.importFlow() }, T.icon("import"), T.tr("Importa un estratto conto"))));
  } else {
    const thisWeek = T.weekStart(T.today());
    const hasThis = S.txs.some(t => t.flow === "spesa" && t.d >= thisWeek);
    const ws = A.ui.week || (hasThis ? thisWeek : T.weekStart(cov.to));
    const w = T.week(S, ws), cap = w.cap, left = cap - w.spent;
    const isCurrent = ws === thisWeek, past = ws < thisWeek;
    const daysLeft = isCurrent ? 7 - T.daysBetween(ws, T.today()) : 0;
    const col = w.spent > cap ? "var(--bad)" : w.spent > cap * 0.85 ? "var(--warn)" : "var(--ok)";
    const nav = h("div.row.between",
      h("button.btn.ghost", { type: "button", "aria-label": T.tr("Settimana precedente"), onclick: () => { A.ui.week = T.addDays(ws, -7); A.render(); } }, "\u2039"),
      h("div", { style: { textAlign: "center" } }, h("div", { style: { fontWeight: 650 } }, isCurrent ? T.tr("Questa settimana") : past && !hasThis && ws === T.weekStart(cov.to) ? T.tr("Ultima settimana con dati") : T.tr("Settimana")), h("div.small.muted", T.fmt.dateShort(ws) + " - " + T.fmt.dateShort(w.end))),
      h("button.btn.ghost", { type: "button", "aria-label": T.tr("Settimana successiva"), disabled: ws >= thisWeek, onclick: () => { A.ui.week = T.addDays(ws, 7); A.render(); } }, "\u203a"));
    const lines = [h("div.big", A.money(w.spent)), h("div.muted", T.tr("spesi su ") + A.money(cap))];
    if (left >= 0) lines.push(h("div.mid.ok", T.tr("Restano ") + A.money(left)), isCurrent && daysLeft > 0 ? h("div.small.muted", T.tr("per ") + daysLeft + (daysLeft === 1 ? T.tr(" giorno") : T.tr(" giorni")) + ": " + A.money(left / daysLeft) + T.tr(" al giorno")) : null);
    else lines.push(h("div.mid.bad", T.tr("Sforato di ") + A.money(-left)), h("div.small.muted", T.tr("la prossima settimana parte da ") + A.money(Math.max(0, cap + left))));
    if (w.vac > 0) lines.push(h("div.small", { style: { color: "var(--accent)", fontWeight: 600 } }, T.tr("In vacanza: ") + A.money(w.vac) + T.tr(" nel budget vacanze")));
    const card = h("div.card", h("h2", T.tr("Budget settimanale")), nav, h("div.ring-wrap", { style: { marginBlockStart: "8px" } }, T.ring(cap ? w.spent / cap : 0, cap ? T.fmt.pct(w.spent / cap) : "-", T.tr("del tetto"), col), h("div", lines)));
    if (cov.to < T.addDays(T.today(), -6) && !T.bankConnected(S)) card.appendChild(h("div.note.warn", { style: { marginBlockStart: "10px" } }, T.tr("Ultimo movimento importato il ") + T.fmt.date(cov.to) + T.tr(". Importa l'estratto per aggiornare la settimana."), " ", h("button.btn.ghost", { type: "button", onclick: () => A.importFlow() }, T.tr("Importa"))));
    main.appendChild(card);
    const hist = T.weeksHistory(S, 8, T.weekStart(cov.to));
    const c2 = h("div.card", h("h2", T.tr("Ultime 8 settimane")), h("p.sub", T.tr("Spese di tutti i giorni contro il tetto settimanale (linea rossa). In arancione le spese di vacanza, che hanno un budget a parte.")));
    main.appendChild(c2);
    c2.appendChild(T.columns(c2, hist.map(x => ({ l: T.fmt.dateShort(x.start), title: T.tr("Settimana dal ") + T.fmt.date(x.start), parts: [{ v: x.spent, c: x.spent > x.cap ? "var(--bad)" : "var(--brand2)", n: T.tr("tutti i giorni") }, { v: x.vac, c: "var(--accent)", n: T.tr("vacanza") }] })), { ref: cap, refLabel: T.tr("tetto ") + T.fmt.n0(cap), h: 180, onClick: it => { A.ui.week = hist[hist.findIndex(x => T.fmt.dateShort(x.start) === it.l)].start; A.render(); } }));
    /* mese */
    const mk = cov.to.slice(0, 7), agg = T.aggregate(S, { months: new Set([mk]) });
    const monthDays = new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate();
    const elapsed = mk === T.today().slice(0, 7) ? +T.today().slice(8) : +cov.to.slice(8);
    const budgetM = pic.plan.variable;
    main.appendChild(h("div.card", h("h2", T.fmt.month(mk)),
      h("div.row.between", h("span", T.tr("Spese di tutti i giorni")), h("b", A.money(agg.total) + " / " + A.money(budgetM))),
      T.progress(agg.total, budgetM, agg.total > budgetM ? "var(--bad)" : "var(--brand2)", budgetM * elapsed / monthDays),
      h("div.small.muted", { style: { marginBlockStart: "6px" } }, T.tr("La tacca indica dove dovresti essere oggi (") + elapsed + T.tr(" giorni su ") + monthDays + ")."),
      h("div.kpis", { style: { marginBlockStart: "12px" } }, T.kpi(T.tr("Costi fissi"), A.money(pic.now.fixed), T.tr("al mese")), T.kpi(T.tr("Tasso di risparmio"), pic.rateNow == null ? "-" : T.fmt.pct(pic.rateNow), pic.income ? T.tr("su ") + A.money(pic.income) + T.tr(" netti") : T.tr("inserisci il reddito")))));
  }
  /* FIRE */
  const fc = h("div.card", h("h2", T.tr("Obiettivo FIRE")));
  main.appendChild(fc);
  const res = A.fireResult(() => { if (A.view === "home") A.render(); });
  if (!S.fire.birthYear) fc.appendChild(h("p.muted", T.tr("Inserisci eta' e patrimonio per vedere quando potresti raggiungere l'indipendenza finanziaria.")));
  if (res) {
    fc.appendChild(h("div.ring-wrap", T.ring(res.progress, T.fmt.pct(res.progress), T.tr("del numero FIRE"), "var(--ok)"),
      h("div", h("div.small.muted", T.tr("Eta' FIRE stimata")), h("div.big", res.fireAge != null ? T.fmt.n1(res.fireAge) + T.tr(" anni") : T.tr("oltre i 70")), h("div.small.muted", T.tr("con ") + T.fmt.pct(res.conf) + T.tr(" di probabilita'")), h("div.small.muted", T.tr("Numero FIRE ") + A.money(res.fireNumber)))));
  } else fc.appendChild(h("div.row", h("span.spinner"), h("span.muted", T.tr("Calcolo in corso..."))));
  fc.appendChild(h("button.btn.block", { type: "button", style: { marginBlockStart: "10px" }, onclick: () => A.go("fire") }, T.tr("Apri il simulatore")));
  /* promemoria */
  const tips = [];
  const B = S.bank, left = T.bankDaysLeft(S);
  if (T.bankConnected(S) && T.bankExpired(S)) tips.push(h("div.li.tap", { onclick: () => A.startConnect() }, h("div.grow", h("div.t", T.tr("Ricollega Revolut")), h("div.d", T.tr("Il consenso e' scaduto il ") + T.fmt.date(B.validUntil.slice(0, 10)) + T.tr(": i movimenti non arrivano piu' da soli."))), h("span.pill.warn", T.tr("Scaduto"))));
  else if (T.bankConnected(S) && left != null && left < 14) tips.push(h("div.li.tap", { onclick: () => A.startConnect() }, h("div.grow", h("div.t", T.tr("Rinnova il collegamento Revolut")), h("div.d", T.tr("Scade tra ") + left + T.tr(" giorni, il ") + T.fmt.date(B.validUntil.slice(0, 10)) + T.tr(". Bastano due tocchi nell'app Revolut."))), h("span.pill.warn", T.tr("Presto"))));
  else if (T.bankConnected(S) && B.lastError) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "collega") }, h("div.grow", h("div.t", T.tr("Aggiornamento Revolut non riuscito")), h("div.d", B.lastError))));
  else if (!T.bankConnected(S) && B.url) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "collega") }, h("div.grow", h("div.t", T.tr("Completa il collegamento Revolut")), h("div.d", T.tr("Manca il consenso nell'app Revolut")))));
  if (S.txs.length && (!S.meta.lastBackup || T.daysBetween(S.meta.lastBackup.slice(0, 10), T.today()) > 30)) tips.push(h("div.li.tap", { onclick: () => A.exportBackup() }, h("div.grow", h("div.t", T.tr("Fai un backup")), h("div.d", S.meta.lastBackup ? T.tr("Ultimo il ") + T.fmt.date(S.meta.lastBackup.slice(0, 10)) : T.tr("Non ne hai ancora fatto uno. I dati sono solo su questo telefono."))), h("span.pill.warn", T.tr("Consigliato"))));
  if (!pic.income) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "profilo") }, h("div.grow", h("div.t", T.tr("Inserisci il reddito netto mensile")), h("div.d", T.tr("Serve per il tasso di risparmio e per il FIRE")))));
  if (!S.fixed.length) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "fissi") }, h("div.grow", h("div.t", T.tr("Aggiungi i costi fissi")), h("div.d", T.tr("Affitto, cassa malati, leasing, bollette")))));
  if (tips.length) main.appendChild(h("div.card", h("h2", T.tr("Da fare")), h("div.list", tips)));
};
})();
