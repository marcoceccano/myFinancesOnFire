/* myFinances on FIRE · schermata Spese e modifica dei movimenti */
"use strict";
(function () {
const h = T.h, A = T.A;

A.renderSpese = main => {
  const S = A.S, ui = A.ui, cov = T.coverage(S);
  if (!cov) { main.appendChild(h("div.card.empty", h("p", T.tr("Nessuna spesa ancora.")), h("button.btn.primary", { type: "button", onclick: () => A.importFlow() }, T.tr("Importa un estratto conto")))); return; }
  const months = [...new Set(S.txs.filter(t => t.flow === "spesa").map(t => t.d.slice(0, 7)))].sort();
  const sel = ui.months && ui.months.size ? ui.months : null;
  const chips = h("div.chips", h("button.chip" + (sel ? "" : ".on"), { type: "button", onclick: () => { ui.months = null; ui.page = 0; A.render(); } }, T.tr("Tutto")),
    months.slice().reverse().map(m => h("button.chip" + (sel && sel.has(m) ? ".on" : ""), { type: "button", onclick: () => { ui.months = new Set([m]); ui.page = 0; A.render(); } }, T.fmt.monthShort(m) + " " + m.slice(2, 4))));
  const vacT = h("label.row", { style: { gap: "8px", marginBlockStart: "8px" } }, h("input", { type: "checkbox", checked: ui.vac, onchange: e => { ui.vac = e.target.checked; A.render(); } }), T.tr("Includi le vacanze"));
  main.appendChild(h("div.card", chips, vacT));

  const f = { months: sel, vac: ui.vac };
  const agg = T.aggregate(S, f);
  const from = sel ? [...sel][0] + "-01" : cov.from;
  const to = sel ? (() => { const m = [...sel][0]; const last = T.iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 0)); return last > cov.to ? cov.to : last; })() : cov.to;
  const days = Math.max(1, T.daysBetween(from < cov.from ? cov.from : from, to) + 1), perM = agg.total / (days / T.DAYS_PER_MONTH);
  main.appendChild(h("div.kpis.k4", T.kpi(T.tr("Totale"), A.money(agg.total), sel ? T.fmt.month([...sel][0]) : T.tr("dal ") + T.fmt.date(cov.from)), T.kpi(T.tr("Al mese"), A.money(perM), "media"), T.kpi(T.tr("Al giorno"), A.money(agg.total / days), days + T.tr(" giorni")), T.kpi(T.tr("Movimenti"), T.fmt.n0(agg.n), ui.vac ? T.tr("vacanze incluse") : T.tr("vacanze escluse"))));
  main.appendChild(h("div", { style: { blockSize: "12px" } }));

  /* mese per mese, impilato per categoria */
  const top = Object.entries(T.aggregate(S, { vac: ui.vac }).cats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
  const c1 = h("div.card", h("h2", T.tr("Mese per mese")), h("p.sub", T.tr("Tocca una colonna per vedere il mese. La linea e' il budget mensile delle spese di tutti i giorni.")));
  main.appendChild(c1);
  const all = T.aggregate(S, { vac: ui.vac });
  const items = months.map(m => { const mc = all.months[m] || {}; const parts = top.map(id => ({ v: mc[id] || 0, c: A.cat(id).color, n: A.cat(id).name })); parts.push({ v: T.sum(Object.entries(mc).filter(([k]) => !top.includes(k)).map(x => x[1])), c: "#95A0B3", n: T.tr("Altre") }); return { l: T.fmt.monthShort(m), title: T.fmt.month(m), m, parts }; });
  c1.appendChild(T.columns(c1, items, { ref: T.picture(S).plan.variable, refLabel: "budget", h: 210, onClick: it => { ui.months = new Set([it.m]); A.render(); } }));
  c1.appendChild(h("div.legend", top.map(id => h("span", h("i.dot", { style: { background: A.cat(id).color } }), A.cat(id).name)), h("span", h("i.dot", { style: { background: "#95A0B3" } }), T.tr("Altre"))));

  /* per categoria */
  const cats = Object.entries(agg.cats).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const c2 = h("div.card", h("h2", T.tr("Per categoria")), h("p.sub", T.tr("Al mese, confrontato con il budget. Tocca per vedere i movimenti.")));
  const mFactor = days / T.DAYS_PER_MONTH;
  c2.appendChild(h("div", { style: { display: "flex", justifyContent: "center" } }, T.donut(cats.map(([id, v]) => ({ v, c: A.cat(id).color, n: A.cat(id).name, onClick: () => { ui.cat = id; ui.page = 0; A.render(); } })), A.money(agg.total), "totale")));
  const list = h("div.list");
  for (const [id, v] of cats) {
    const c = A.cat(id), pm = v / mFactor, b = +c.budget || 0;
    list.appendChild(h("div.li.tap", { onclick: () => { ui.cat = ui.cat === id ? null : id; ui.page = 0; A.render(); } }, h("i.dot", { style: { background: c.color } }),
      h("div.grow", h("div.row.between", h("span.t", c.name), h("span.a", A.money(pm))), T.progress(pm, Math.max(b, pm), pm > b && b ? "var(--bad)" : c.color, b || null), h("div.d", b ? (pm > b ? "+" + A.money(pm - b) + T.tr(" sopra il budget") : A.money(b - pm) + T.tr(" sotto il budget")) + " (" + A.money(b) + ")" : T.tr("nessun budget")))));
  }
  c2.appendChild(list); main.appendChild(c2);

  /* esercenti e giorni */
  const merch = Object.entries(agg.merch).sort((a, b) => b[1].v - a[1].v).slice(0, 10);
  main.appendChild(h("div.card", h("h2", T.tr("Dove spendi di piu'")), h("div.list", merch.map(([n, x]) => h("div.li.tap", { onclick: () => { ui.q = n; ui.cat = null; ui.page = 0; A.render(); } }, h("div.grow", h("div.t", n), h("div.d", x.n + T.tr(" movimenti, ") + A.money(x.v / x.n) + T.tr(" in media"))), h("div.a", A.money(x.v)))))));
  const wdays = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < days; i++) wdays[(T.parseIso(T.addDays(from < cov.from ? cov.from : from, i)).getDay() + 6) % 7]++;
  const c3 = h("div.card", h("h2", T.tr("Giorni della settimana")), h("p.sub", T.tr("Spesa media per giorno.")));
  main.appendChild(c3);
  c3.appendChild(T.columns(c3, agg.wd.map((v, i) => ({ l: T.weekdays()[i].slice(0, 3), title: T.weekdays()[i], parts: [{ v: wdays[i] ? v / wdays[i] : 0, c: "var(--brand2)" }] })), { h: 170 }));

  /* movimenti */
  const c4 = h("div.card", h("h2", T.tr("Movimenti")));
  const q = h("input", { type: "search", placeholder: T.tr("Cerca esercente o nota"), value: ui.q, "aria-label": T.tr("Cerca") });
  q.addEventListener("change", () => { ui.q = q.value; ui.page = 0; A.render(); });
  c4.appendChild(T.seg([["spesa", T.tr("Spese")], ["escluso", T.tr("Esclusi")], ["entrata", T.tr("Entrate")]], ui.flow, v => { ui.flow = v; ui.page = 0; A.render(); }));
  c4.appendChild(h("div", { style: { blockSize: "8px" } })); c4.appendChild(q);
  if (ui.cat) c4.appendChild(h("div.row", { style: { marginBlockStart: "8px" } }, h("span.pill", A.cat(ui.cat).name), h("button.btn.ghost", { type: "button", onclick: () => { ui.cat = null; A.render(); } }, T.tr("Togli filtro"))));
  const rows = S.txs.filter(t => t.flow === ui.flow && (!sel || sel.has(t.d.slice(0, 7))) && (ui.vac || ui.flow !== "spesa" || !T.isVacation(t, S)) && (!ui.cat || t.cat === ui.cat) && (!ui.q || (t.desc + " " + (t.note || "")).toLowerCase().includes(ui.q.toLowerCase()))).slice().reverse();
  const PG = 40, pages = Math.max(1, Math.ceil(rows.length / PG)); ui.page = Math.min(ui.page, pages - 1);
  const lst = h("div.list");
  for (const t of rows.slice(ui.page * PG, ui.page * PG + PG)) {
    const c = A.cat(t.cat), vac = T.isVacation(t, S);
    lst.appendChild(h("div.li.tap", { onclick: () => A.editTx(t) }, h("i.dot", { style: { background: t.flow === "spesa" ? c.color : "var(--line)" } }),
      h("div.grow", h("div.t", t.note || t.desc), h("div.d", T.fmt.date(t.d) + " \u00b7 " + (t.flow === "spesa" ? c.name : t.flow === "escluso" ? T.tr(T.EXCLUDE_KINDS[t.kind] || "Escluso") : T.tr("Entrata")) + (vac && t.flow === "spesa" ? T.tr(" \u00b7 vacanza") : "") + (t.pending ? T.tr(" \u00b7 in sospeso") : "") + (t.cur !== S.profile.currency ? " \u00b7 " + T.fmt.n2(Math.abs(t.amtLoc)) + " " + t.cur : ""))),
      h("div.a" + (t.amt > 0 ? ".ok" : ""), (t.amt > 0 ? "+" : "") + T.fmt.n2(t.amt))));
  }
  if (!rows.length) lst.appendChild(h("div.empty", T.tr("Nessun movimento")));
  c4.appendChild(h("div.small.muted", { style: { marginBlock: "8px 0" } }, rows.length + T.tr(" movimenti, ") + A.money(-T.sum(rows.map(r => r.amt)))));
  c4.appendChild(lst);
  if (pages > 1) c4.appendChild(h("div.row.between", h("button.btn", { type: "button", disabled: ui.page === 0, onclick: () => { ui.page--; A.render(); } }, T.tr("Precedenti")), h("span.small.muted", T.tr("pagina ") + (ui.page + 1) + T.tr(" di ") + pages), h("button.btn", { type: "button", disabled: ui.page >= pages - 1, onclick: () => { ui.page++; A.render(); } }, T.tr("Successivi"))));
  main.appendChild(c4);
};

/* modifica di un movimento: categoria, tipo, vacanza, nota; opzione T.tr("vale per tutti") */
A.editTx = t => {
  const S = A.S, st = { flow: t.flow, cat: t.cat || "altro", kind: t.kind || "interno", vac: t.vac === true ? "si" : t.vac === false ? "no" : "auto", note: t.note || "", all: true };
  const merchant = T.normMerchant(t.desc);
  const same = S.txs.filter(x => T.normMerchant(x.desc) === merchant).length;
  const catSel = T.selectField(T.tr("Categoria"), st.cat, S.categories.map(c => [c.id, c.name]), v => st.cat = v);
  const kindSel = T.selectField(T.tr("Tipo di movimento escluso"), st.kind, Object.entries(T.EXCLUDE_KINDS), v => st.kind = v);
  const sync = () => { catSel.hidden = st.flow !== "spesa"; kindSel.hidden = st.flow !== "escluso"; };
  const body = h("div",
    h("div.note", h("b", t.desc), h("div", T.fmt.date(t.d) + " \u00b7 " + T.fmt.n2(t.amt) + " " + S.profile.currency + (t.cur !== S.profile.currency ? " (" + T.fmt.n2(t.amtLoc) + " " + t.cur + ")" : "") + (t.rcat ? " \u00b7 " + t.rcat : ""))),
    h("div", { style: { blockSize: "12px" } }),
    h("div.lbl", T.tr("Che cos'e'")),
    T.seg([["spesa", T.tr("Spesa")], ["escluso", T.tr("Non e' una spesa")], ["entrata", T.tr("Entrata")]], st.flow, v => { st.flow = v; sync(); }),
    h("div", { style: { blockSize: "12px" } }), catSel, kindSel,
    h("div.lbl", T.tr("Vacanza")),
    T.seg([["auto", T.tr("Automatico")], ["si", T.tr("Si'")], ["no", "No"]], st.vac, v => st.vac = v),
    h("div", { style: { blockSize: "12px" } }),
    T.textField(T.tr("Nota o nome da mostrare (facoltativo)"), st.note, v => st.note = v),
    same > 1 || merchant ? h("label.row", { style: { gap: "10px" } }, h("input", { type: "checkbox", checked: true, onchange: e => st.all = e.target.checked }), h("span", T.tr("Vale anche per gli altri movimenti di \u00ab") + t.desc + T.tr("\u00bb e per quelli futuri") + (same > 1 ? " (" + same + T.tr(" in tutto)") : ""))) : null);
  sync();
  T.sheet(T.tr("Modifica movimento"), body, [
    h("button.btn", { type: "button", onclick: () => T.closeSheet() }, T.tr("Annulla")),
    h("button.btn.primary", { type: "button", onclick: () => {
      t.note = st.note.trim() || undefined;
      t.vac = st.vac === "si" ? true : st.vac === "no" ? false : undefined;
      const flow = st.flow, cat = flow === "spesa" ? st.cat : null, kind = flow === "escluso" ? st.kind : null;
      if (st.all) { T.addUserRule(S, t.desc, flow, cat, kind); t.manual = false; T.reclassifyAll(S); }
      else { t.manual = true; t.flow = flow; t.cat = cat; t.kind = kind; }
      T.closeSheet(); T.toast(st.all ? T.tr("Regola salvata: vale anche per i prossimi import") : T.tr("Movimento aggiornato")); A.changed();
    } }, T.tr("Salva"))]);
};
})();
