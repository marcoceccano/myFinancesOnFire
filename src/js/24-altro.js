/* myFinances on FIRE · impostazioni, import, backup e configurazione guidata */
"use strict";
(function () {
const h = T.h, A = T.A;
const CURRENCIES = [["CHF", "Franco svizzero (CHF)"], ["EUR", "Euro (EUR)"], ["GBP", "Sterlina (GBP)"], ["USD", "Dollaro (USD)"]];
const FREQS = [["mensile", "Ogni mese"], ["bimestrale", "Ogni 2 mesi"], ["trimestrale", "Ogni 3 mesi"], ["semestrale", "Ogni 6 mesi"], ["annuale", "Una volta l'anno"]];

/* ---------- import ---------- */
A.importFlow = async () => {
  const f = await T.pickFile(".csv,.xlsx,.pdf,.json,text/csv,application/pdf,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  if (!f) return;
  return A.importFile(f);
};
A.importFile = async f => {
  try {
    if (/\.json$/i.test(f.name)) return A.restoreBackup(f);
    T.toast("Lettura di " + f.name + "...");
    const r = await T.readAnyFile(f.name, f.buf);
    if (r.type === "revolut-statement" || r.type === "revolut-csv") return A.confirmTxImport(f.name, r.rows, "revolut", "Revolut");
    if (r.type === "ubs-payments") return A.fixedFromPayments(r.payments);
    if (r.type === "table") return A.mapCsv(f.name, r);
    T.sheet("File non riconosciuto", h("p", "Questo PDF non sembra un elenco di pagamenti registrati UBS. Per i movimenti usa l'export CSV o Excel della banca."), [h("button.btn.primary", { type: "button", onclick: T.closeSheet }, "Ok")]);
  } catch (e) { console.error(e); T.sheet("Non riesco a leggere il file", h("p", String(e.message || e)), [h("button.btn.primary", { type: "button", onclick: T.closeSheet }, "Ok")]); }
};
A.confirmTxImport = (name, rows, source, label) => {
  const S = A.S;
  T.assignIds(rows, source);
  const have = new Set(S.txs.map(t => t.id)), fresh = rows.filter(r => !have.has(r.id));
  const from = rows.reduce((m, r) => r.d < m ? r.d : m, "9999"), to = rows.reduce((m, r) => r.d > m ? r.d : m, "0000");
  const missingFx = [...new Set(fresh.filter(r => r.amt == null && r.cur !== S.profile.currency && !(S.profile.fx || {})[r.cur]).map(r => r.cur))];
  T.sheet("Importa da " + label, h("div",
    h("div.kpis", T.kpi("Movimenti nel file", T.fmt.n0(rows.length), T.fmt.date(from) + " - " + T.fmt.date(to)), T.kpi("Nuovi", T.fmt.n0(fresh.length), (rows.length - fresh.length) + " gia' presenti")),
    missingFx.length ? h("div.note.warn", { style: { marginBlockStart: "10px" } }, "Manca il cambio per " + missingFx.join(", ") + ": aggiungilo in Altro > Profilo, altrimenti uso 1:1.") : null,
    h("p.small.muted", "I movimenti restano su questo telefono. Ricariche, cambi valuta, investimenti e giroconti vengono riconosciuti ed esclusi dalle spese.")),
    [h("button.btn", { type: "button", onclick: T.closeSheet }, "Annulla"), h("button.btn.primary", { type: "button", disabled: !fresh.length, onclick: () => {
      const res = T.mergeTxs(S, rows, source);
      S.imports.unshift({ at: new Date().toISOString(), file: name, source: label, added: res.added, dup: res.dup, from: res.from, to: res.to });
      S.imports = S.imports.slice(0, 50);
      if (S.profile.demo) S.profile.demo = false;
      T.closeSheet(); T.toast(res.added + " movimenti aggiunti"); A.ui.week = null; A.changed();
    } }, fresh.length ? "Importa " + fresh.length : "Niente di nuovo")]);
};
A.mapCsv = (name, r) => {
  const S = A.S, rows = r.table, m = Object.assign({}, r.mapping);
  const sig = (rows[m.headerRow] || []).join("|");
  const saved = (S.csvProfiles || []).find(p => p.sig === sig);
  if (saved) Object.assign(m, saved.mapping);
  let source = saved ? saved.name : r.source || "Banca";
  const head = (rows[m.headerRow] || []).map((c, i) => [String(i), (c || "Colonna " + (i + 1)) + ""]);
  const opt = [["-1", "(nessuna)"]].concat(head);
  const prev = h("div");
  const refresh = () => {
    T.clear(prev);
    const tx = T.parseGenericCsv(rows, m, S.profile.currency);
    prev.appendChild(h("div.small.muted", tx.length + " movimenti riconosciuti"));
    prev.appendChild(h("div.list", tx.slice(0, 5).map(t => h("div.li", h("div.grow", h("div.t", t.desc || "(senza descrizione)"), h("div.d", T.fmt.date(t.d))), h("div.a", T.fmt.n2(t.amtLoc) + " " + t.cur)))));
    return tx;
  };
  const sel = (label, k) => T.selectField(label, String(m[k]), opt, v => { m[k] = +v; refresh(); });
  const body = h("div",
    h("p.small.muted", "Indica quali colonne usare. La scelta viene ricordata per i prossimi file con le stesse colonne."),
    T.textField("Nome della fonte", source, v => source = v, { hint: "Per esempio UBS, PostFinance, carta di credito" }),
    sel("Data", "date"), sel("Descrizione", "desc"), sel("Importo (con segno)", "amount"),
    h("div.grid2", sel("Oppure: addebito", "debit"), sel("e accredito", "credit")), sel("Valuta (facoltativa)", "currency"),
    T.selectField("Formato data", m.dateHint, [["dmy", "giorno.mese.anno"], ["mdy", "mese/giorno/anno"]], v => { m.dateHint = v; refresh(); }),
    h("div.lbl", "Anteprima"), prev);
  refresh();
  T.sheet("Colonne del file", body, [h("button.btn", { type: "button", onclick: T.closeSheet }, "Annulla"), h("button.btn.primary", { type: "button", onclick: () => {
    const tx = T.parseGenericCsv(rows, m, S.profile.currency);
    if (!tx.length) { T.toast("Nessun movimento riconosciuto: controlla le colonne"); return; }
    S.csvProfiles = (S.csvProfiles || []).filter(p => p.sig !== sig); S.csvProfiles.push({ sig, name: source, mapping: m }); A.save();
    T.closeSheet(); setTimeout(() => A.confirmTxImport(name, tx, "csv:" + source.toLowerCase(), source), 50);
  } }, "Continua")]);
};
/* PDF UBS: pagamenti registrati -> costi fissi */
A.fixedFromPayments = pays => {
  const S = A.S;
  const items = pays.map(p => { const s = T.suggestFixed(p); const ex = S.fixed.find(f => f.payee && f.payee.toLowerCase() === p.payee.toLowerCase()); return Object.assign(s, { use: !(ex && ex.kind === "risparmio" && ex.freq !== "mensile"), existing: ex || null, freq: ex ? ex.freq : s.freq, name: ex ? ex.name : s.name, kind: ex ? ex.kind : s.kind }); });
  const body = h("div", h("p.small.muted", "Pagamenti trovati nel PDF. Scegli quali sono costi fissi e con che frequenza arrivano. Quelli gia' presenti vengono aggiornati."),
    items.map(it => h("div", { style: { borderBlockEnd: "1px solid var(--line)", paddingBlock: "8px" } },
      h("label.row", h("input", { type: "checkbox", checked: true, onchange: e => it.use = e.target.checked }), h("div.grow", h("b", it.payee), h("div.small.muted", T.fmt.n2(it.amount) + " " + S.profile.currency + (it.existing ? " \u00b7 aggiorna \u00ab" + it.existing.name + "\u00bb" : " \u00b7 nuova voce")))),
      h("div.grid2", T.textField("Nome", it.name, v => it.name = v), T.selectField("Frequenza", it.freq, FREQS, v => it.freq = v)),
      T.seg([["costo", "Costo"], ["risparmio", "Risparmio (3a, ecc.)"]], it.kind, v => it.kind = v))));
  T.sheet("Pagamenti registrati UBS", body, [h("button.btn", { type: "button", onclick: T.closeSheet }, "Annulla"), h("button.btn.primary", { type: "button", onclick: () => {
    let n = 0;
    for (const it of items.filter(x => x.use)) {
      if (it.existing) Object.assign(it.existing, { name: it.name, amount: it.amount, freq: it.freq, kind: it.kind, payee: it.payee });
      else S.fixed.push({ id: T.uid(), name: it.name, payee: it.payee, amount: it.amount, freq: it.freq, kind: it.kind, note: it.note || "" });
      n++;
    }
    T.closeSheet(); T.toast(n + " costi fissi aggiornati"); A.changed();
  } }, "Aggiorna i costi fissi")]);
};

/* ---------- backup ---------- */
A.exportBackup = () => {
  const S = A.S; S.meta.lastBackup = new Date().toISOString(); A.save();
  T.download("myfinances-backup-" + T.today() + ".json", JSON.stringify(T.makeBackup(S)));
  T.toast("Backup creato: salvalo in un posto sicuro (per esempio il tuo cloud personale)");
  A.render();
};
A.restoreBackup = async f => {
  let st;
  try { st = T.readBackup(JSON.parse(new TextDecoder().decode(new Uint8Array(f.buf)))); } catch (e) { T.sheet("Backup non valido", h("p", String(e.message || e)), [h("button.btn.primary", { type: "button", onclick: T.closeSheet }, "Ok")]); return; }
  const cov = (() => { const s = A.S; A.S = st; const c = T.coverage(st); A.S = s; return c; })();
  const ok = A.S.txs.length ? await T.confirm("Ripristinare il backup?", "Il backup contiene " + st.txs.length + " movimenti" + (cov ? " dal " + T.fmt.date(cov.from) + " al " + T.fmt.date(cov.to) : "") + ". I dati attuali su questo telefono verranno sostituiti.", "Ripristina", true) : true;
  if (!ok) return;
  st.profile.onboarded = true; A.S = st; await T.save(st, true); A.fire.key = ""; A.ui.week = null;
  T.toast("Backup ripristinato"); A.go("home", null, true);
};

/* ---------- ALTRO ---------- */
A.renderAltro = main => {
  if (A.sub) return A.renderSub(main, A.sub);
  const S = A.S, item = (t, d, fn, pill) => h("div.li.tap", { onclick: fn, role: "button", tabindex: "0" }, h("div.grow", h("div.t", t), d ? h("div.d", d) : null), pill || h("span.muted", "\u203a"));
  const last = S.imports[0];
  main.appendChild(h("div.card", h("h2", "Dati"), h("div.list",
    item("Collegamento automatico Revolut", T.bankConnected(S) ? (T.bankExpired(S) ? "Consenso scaduto" : "Collegato \u00b7 aggiornato " + A.relTime(S.bank.lastSync)) : "Movimenti aggiornati da soli, in sola lettura", () => A.go("altro", "collega"), T.bankConnected(S) ? h("span.pill" + (T.bankExpired(S) ? ".warn" : ".ok"), T.bankExpired(S) ? "Scaduto" : "Attivo") : null),
    item("Importa movimenti", "Revolut (Excel o CSV), PDF pagamenti registrati UBS, CSV di qualsiasi banca", () => A.importFlow()),
    item("Storico import", last ? "Ultimo: " + last.source + " il " + T.fmt.date(last.at.slice(0, 10)) : "Nessun import", () => A.go("altro", "storico")),
    item("Backup", S.meta.lastBackup ? "Ultimo il " + T.fmt.date(S.meta.lastBackup.slice(0, 10)) : "Mai fatto", () => A.go("altro", "backup"), S.meta.lastBackup ? null : h("span.pill.warn", "Da fare")))));
  main.appendChild(h("div.card", h("h2", "Impostazioni"), h("div.list",
    item("Profilo e reddito", (S.profile.currency || "CHF") + (S.profile.incomeMonthly ? " \u00b7 " + A.money(S.profile.incomeMonthly) + " netti al mese" : ""), () => A.go("altro", "profilo")),
    item("Costi fissi", S.fixed.length + " voci \u00b7 " + A.money(T.fixedMonthly(S).cost) + " al mese", () => A.go("altro", "fissi")),
    item("Categorie", S.categories.length + " categorie", () => A.go("altro", "categorie")),
    item("Regole degli esercenti", (S.rules || []).length + " regole tue", () => A.go("altro", "regole")),
    item("Periodi di vacanza", S.vacations.length + " periodi", () => A.go("altro", "vacanze")))));
  main.appendChild(h("div.card", h("h2", "App"), h("div.list",
    A.installPrompt ? item("Installa l'app", "Aggiungi l'icona alla schermata Home", async () => { A.installPrompt.prompt(); A.installPrompt = null; A.render(); }) : null,
    item("Prova con dati di esempio", "Sostituisce i dati con dati inventati", async () => { if (S.txs.length && !(await T.confirm("Caricare i dati di esempio?", "I tuoi dati su questo telefono verranno sostituiti. Fai prima un backup se ti servono.", "Carica", true))) return; A.S = T.makeDemoState(); await T.save(A.S, true); A.fire.key = ""; A.go("home", null, true); }),
    item("Privacy e informazioni", "Versione " + T.APP.version, () => A.go("altro", "info")),
    item("Cancella tutti i dati", "Rimuove tutto da questo telefono", async () => { if (!(await T.confirm("Cancellare tutto?", "Movimenti, impostazioni e budget verranno eliminati da questo telefono. Non si puo' annullare.", "Cancella", true))) return; await T.storage.clear(); A.S = T.newState(); A.fire.key = ""; A.go("home", null, true); }, h("span.bad", "\u203a")))));
};

A.renderSub = (main, sub) => {
  const S = A.S;
  const back = h("button.btn.ghost", { type: "button", onclick: () => history.length > 1 ? history.back() : A.go("altro") }, "\u2039 Altro");
  main.appendChild(back);
  const card = h("div.card"); main.appendChild(card);
  const save = () => { A.fire.key = ""; A.save(); };
  if (sub === "collega") {
    A.renderCollega(card);
  } else if (sub === "profilo") {
    card.appendChild(h("h2", "Profilo e reddito"));
    card.appendChild(T.textField("Nome (facoltativo)", S.profile.name, v => { S.profile.name = v; save(); }));
    card.appendChild(T.selectField("Valuta di base", S.profile.currency, CURRENCIES, v => { S.profile.currency = v; save(); }, { hint: "La valuta in cui vedi tutti i totali." }));
    card.appendChild(T.numField("Reddito netto al mese", S.profile.incomeMonthly, v => { S.profile.incomeMonthly = v || 0; save(); }, { hint: "Quello che entra sul conto in un mese normale, senza bonus." }));
    card.appendChild(h("h2", { style: { marginBlockStart: "14px" } }, "Cambi per i movimenti in altre valute"));
    card.appendChild(h("p.sub", "Servono solo per i file che non riportano gia' l'importo convertito. 1 unita' = quanti " + S.profile.currency + "."));
    for (const c of ["EUR", "USD", "GBP"].filter(c => c !== S.profile.currency)) card.appendChild(T.numField("1 " + c + " =", (S.profile.fx || {})[c], v => { S.profile.fx = S.profile.fx || {}; S.profile.fx[c] = v; save(); }, { step: 0.001 }));
  } else if (sub === "fissi") {
    card.appendChild(h("h2", "Costi fissi"));
    card.appendChild(h("p.sub", "Pagamenti regolari dal conto principale. \u00abDal\u00bb serve per un cambio gia' previsto (per esempio una nuova rata dall'anno prossimo)."));
    const list = h("div"); card.appendChild(list);
    const fill = () => {
      T.clear(list);
      S.fixed.forEach((f, i) => {
        const nx = f.next || {};
        list.appendChild(h("details.acc", h("summary", h("span", f.name + " \u00b7 " + A.money(T.monthlyOf(f)) + "/mese" + (f.kind === "risparmio" ? " (risparmio)" : ""))), h("div.acc-in",
          T.textField("Nome", f.name, v => { f.name = v; save(); }),
          h("div.grid2", T.numField("Importo", f.amount, v => { f.amount = v || 0; save(); }), T.selectField("Frequenza", f.freq, FREQS, v => { f.freq = v; save(); })),
          T.seg([["costo", "Costo"], ["risparmio", "Risparmio"]], f.kind || "costo", v => { f.kind = v; save(); }),
          h("div", { style: { blockSize: "10px" } }),
          h("div.grid2", T.textField("Nuovo importo dal (mese)", nx.from || "", v => { f.next = Object.assign(f.next || {}, { from: v }); save(); }, { type: "month", ph: "2027-01" }), T.numField("Nuovo importo", nx.amount, v => { if (v == null) { delete f.next; } else f.next = Object.assign(f.next || {}, { amount: v }); save(); })),
          T.textField("Nota", f.note || "", v => { f.note = v; save(); }),
          h("button.btn.danger", { type: "button", onclick: async () => { if (await T.confirm("Eliminare \u00ab" + f.name + "\u00bb?", "La voce viene tolta dai costi fissi.", "Elimina", true)) { S.fixed.splice(i, 1); save(); fill(); } } }, "Elimina"))));
      });
      list.appendChild(h("div.row.wrap", { style: { marginBlockStart: "12px" } },
        h("button.btn", { type: "button", onclick: () => { S.fixed.push({ id: T.uid(), name: "Nuova voce", amount: 0, freq: "mensile", kind: "costo" }); save(); fill(); } }, "Aggiungi voce"),
        h("button.btn", { type: "button", onclick: () => A.importFlow() }, "Importa PDF UBS")));
      list.appendChild(h("div.small.muted", { style: { marginBlockStart: "10px" } }, "Totale oggi: " + A.money(T.fixedMonthly(S).cost) + " al mese" + (T.hasNextFixed(S) ? " \u00b7 dopo i cambi previsti: " + A.money(T.fixedMonthly(S, true).cost) : "")));
    };
    fill();
  } else if (sub === "categorie") {
    card.appendChild(h("h2", "Categorie"));
    card.appendChild(h("p.sub", "Essenziale = difficile da tagliare. Vacanza = conta nel budget vacanze."));
    const list = h("div"); card.appendChild(list);
    const fill = () => {
      T.clear(list);
      S.categories.forEach((c, i) => list.appendChild(h("details.acc", h("summary", h("span.row", h("i.dot", { style: { background: c.color } }), c.name)), h("div.acc-in",
        T.textField("Nome", c.name, v => { c.name = v; save(); }),
        h("div.lbl", "Colore"), h("div.chips", T.PALETTE.map(col => h("button.chip", { type: "button", "aria-label": "Colore " + col, style: { background: col, minInlineSize: "36px", borderColor: col === c.color ? "var(--ink)" : "transparent" }, onclick: () => { c.color = col; save(); fill(); } }))),
        h("label.row", { style: { marginBlock: "10px" } }, h("input", { type: "checkbox", checked: !!c.essential, onchange: e => { c.essential = e.target.checked; save(); } }), "Essenziale"),
        h("label.row", { style: { marginBlockEnd: "10px" } }, h("input", { type: "checkbox", checked: !!c.vacation, onchange: e => { c.vacation = e.target.checked; save(); } }), "Spese di vacanza"),
        c.id !== "altro" ? h("button.btn.danger", { type: "button", onclick: async () => { if (!(await T.confirm("Eliminare \u00ab" + c.name + "\u00bb?", "I movimenti passano in \u00abAltro\u00bb.", "Elimina", true))) return; S.txs.forEach(t => { if (t.cat === c.id) t.cat = "altro"; }); S.rules = S.rules.filter(r => r.cat !== c.id); S.categories.splice(i, 1); save(); fill(); } }, "Elimina") : null))));
      list.appendChild(h("button.btn", { type: "button", style: { marginBlockStart: "12px" }, onclick: () => { S.categories.push({ id: "c" + T.uid(), name: "Nuova categoria", color: T.PALETTE[S.categories.length % T.PALETTE.length], essential: false, budget: 0 }); save(); fill(); } }, "Aggiungi categoria"));
    };
    fill();
  } else if (sub === "regole") {
    card.appendChild(h("h2", "Regole degli esercenti"));
    card.appendChild(h("p.sub", "Nascono quando correggi un movimento con \u00abvale anche per gli altri\u00bb. Le regole generiche dell'app restano sotto."));
    const list = h("div.list"); card.appendChild(list);
    const fill = () => { T.clear(list); if (!S.rules.length) list.appendChild(h("div.empty", "Nessuna regola tua")); S.rules.forEach((r, i) => list.appendChild(h("div.li", h("div.grow", h("div.t", r.m), h("div.d", r.flow === "spesa" ? A.cat(r.cat).name : r.flow === "escluso" ? "Escluso: " + (T.EXCLUDE_KINDS[r.kind] || "") : "Entrata")), h("button.btn.ghost", { type: "button", onclick: () => { S.rules.splice(i, 1); T.reclassifyAll(S); save(); fill(); } }, "Elimina")))); };
    fill();
  } else if (sub === "vacanze") {
    card.appendChild(h("h2", "Periodi di vacanza"));
    card.appendChild(h("p.sub", "Le spese in questi giorni vanno nel budget vacanze, non in quello settimanale."));
    const list = h("div"); card.appendChild(list);
    const fill = () => {
      T.clear(list);
      S.vacations.forEach((v, i) => list.appendChild(h("div", { style: { borderBlockEnd: "1px solid var(--line)", paddingBlock: "8px" } },
        T.textField("Nome", v.label || "", x => { v.label = x; save(); }),
        h("div.grid2", T.textField("Dal", v.from, x => { v.from = x; save(); }, { type: "date" }), T.textField("Al", v.to, x => { v.to = x; save(); }, { type: "date" })),
        h("button.btn.danger", { type: "button", onclick: () => { S.vacations.splice(i, 1); save(); fill(); } }, "Elimina"))));
      list.appendChild(h("button.btn", { type: "button", style: { marginBlockStart: "12px" }, onclick: () => { S.vacations.push({ from: T.today(), to: T.addDays(T.today(), 7), label: "Vacanza" }); save(); fill(); } }, "Aggiungi periodo"));
    };
    fill();
  } else if (sub === "storico") {
    card.appendChild(h("h2", "Storico import"));
    card.appendChild(h("div.list", S.imports.length ? S.imports.map(x => h("div.li", h("div.grow", h("div.t", x.source + " \u00b7 " + x.file), h("div.d", T.fmt.date(x.at.slice(0, 10)) + " \u00b7 periodo " + T.fmt.date(x.from) + " - " + T.fmt.date(x.to))), h("div.a", "+" + x.added))) : h("div.empty", "Nessun import")));
  } else if (sub === "backup") {
    card.appendChild(h("h2", "Backup"));
    card.appendChild(h("p", "I dati esistono solo su questo telefono. Il backup e' un file che contiene tutto: movimenti, regole, budget e parametri FIRE. Salvalo nel tuo cloud personale."));
    card.appendChild(h("div.row.wrap", h("button.btn.primary", { type: "button", onclick: () => A.exportBackup() }, "Crea backup"), h("button.btn", { type: "button", onclick: async () => { const f = await T.pickFile(".json,application/json"); if (f) A.restoreBackup(f); } }, "Ripristina da file")));
    card.appendChild(h("p.small.muted", { style: { marginBlockStart: "12px" } }, "Lo stesso file serve per passare i dati a un altro telefono. Se hai il collegamento automatico, il backup contiene anche indirizzo e codice del ponte: tienilo privato."));
  } else if (sub === "info") {
    card.appendChild(h("h2", T.APP.name + " " + T.APP.version));
    card.appendChild(h("p", "Budget settimanale, analisi delle spese e simulatore FIRE."));
    card.appendChild(h("h2", { style: { marginBlockStart: "12px" } }, "Privacy"));
    [ "Nessun account, nessun server: i dati restano nella memoria di questo telefono.",
      "I file degli estratti conto vengono letti sul telefono e non vengono inviati da nessuna parte.",
      "L'app non usa pubblicita', statistiche d'uso o servizi di terze parti.",
      "Il backup e' un file che crei tu e che decidi tu dove salvare.",
      "Puoi cancellare tutto in qualsiasi momento da Altro > Cancella tutti i dati." ].forEach(t => card.appendChild(h("p.small", "\u2022 " + t)));
    card.appendChild(h("h2", { style: { marginBlockStart: "12px" } }, "Avvertenza"));
    card.appendChild(h("p.small.muted", "Le simulazioni sono stime basate su rendimenti storici e sui dati che inserisci. Non sono una consulenza finanziaria, fiscale o previdenziale."));
    card.appendChild(h("p.small.muted", "Spazio usato: " + (JSON.stringify(S).length / 1024).toFixed(0) + " KB \u00b7 " + S.txs.length + " movimenti"));
  }
};

/* ---------- configurazione guidata ---------- */
A.wiz = { step: 0 };
A.renderOnboarding = main => {
  const S = A.S, w = A.wiz, steps = 4;
  const next = () => { w.step++; A.save(); A.render(); }, prev = () => { w.step = Math.max(0, w.step - 1); A.render(); };
  const finish = async () => { S.profile.onboarded = true; await T.save(S, true); T.storage.persist(); A.fire.key = ""; w.step = 0; A.go("home", null, true); };
  if (w.step > 0) main.appendChild(h("div.wiz-steps", Array.from({ length: steps }, (_, i) => h("i" + (i < w.step ? ".on" : "")))));
  const card = h("div.card"); main.appendChild(card);
  const nav = (canSkip, nextLabel) => h("div.row", { style: { marginBlockStart: "16px" } }, h("button.btn", { type: "button", onclick: prev }, "Indietro"), h("div.grow"), canSkip ? h("button.btn.ghost", { type: "button", onclick: next }, "Salta") : null, h("button.btn.primary", { type: "button", onclick: next }, nextLabel || "Avanti"));
  if (w.step === 0) {
    const logo = T.s("svg", { viewBox: "0 0 96 96", class: "logo", "aria-hidden": "true" });
    T.s("rect", { x: 0, y: 0, width: 96, height: 96, rx: 22, fill: "#1F3864" }, logo);
    T.s("path", { d: "M14 74 L36 52 L50 62 L72 38", fill: "none", stroke: "#F0A868", "stroke-width": 8, "stroke-linecap": "round", "stroke-linejoin": "round" }, logo);
    T.s("path", { d: "M76.0 10.0 L76.0 10.0 L76.0 10.2 L76.1 10.4 L76.1 10.7 L76.3 11.1 L76.4 11.6 L76.6 12.2 L76.8 12.9 L77.1 13.6 L77.4 14.4 L77.8 15.3 L78.1 16.2 L78.5 17.2 L78.9 18.2 L79.4 19.3 L79.8 20.4 L80.2 21.5 L80.6 22.7 L81.0 23.8 L81.3 25.0 L81.7 25.9 L81.9 26.8 L82.1 27.6 L82.3 28.5 L82.4 29.3 L82.4 30.1 L82.4 30.9 L82.3 31.6 L82.1 32.3 L81.8 33.0 L81.5 33.6 L81.0 34.1 L80.6 34.6 L80.0 35.0 L79.5 35.4 L78.8 35.7 L78.1 35.9 L77.4 36.1 L76.7 36.2 L76.0 36.2 L75.3 36.2 L74.6 36.1 L73.9 35.9 L73.2 35.7 L72.5 35.4 L72.0 35.0 L71.4 34.6 L71.0 34.1 L70.5 33.6 L70.2 33.0 L69.9 32.3 L69.7 31.6 L69.6 30.9 L69.6 30.1 L69.6 29.3 L69.7 28.5 L69.9 27.6 L70.1 26.8 L70.3 25.9 L70.7 25.0 L71.0 23.8 L71.4 22.7 L71.8 21.5 L72.2 20.4 L72.6 19.3 L73.1 18.2 L73.5 17.2 L73.9 16.2 L74.2 15.3 L74.6 14.4 L74.9 13.6 L75.2 12.9 L75.4 12.2 L75.6 11.6 L75.7 11.1 L75.9 10.7 L75.9 10.4 L76.0 10.2 L76.0 10.0Z", fill: "#FF7A30" }, logo);
    T.s("path", { d: "M76.0 21.0 L76.0 21.0 L76.0 21.1 L76.0 21.2 L76.1 21.4 L76.1 21.6 L76.2 21.9 L76.3 22.2 L76.4 22.5 L76.6 22.9 L76.8 23.3 L76.9 23.8 L77.1 24.3 L77.3 24.8 L77.6 25.4 L77.8 25.9 L78.0 26.5 L78.2 27.1 L78.5 27.7 L78.7 28.4 L78.8 29.0 L79.0 29.5 L79.2 29.9 L79.3 30.4 L79.4 30.9 L79.4 31.3 L79.4 31.7 L79.4 32.1 L79.3 32.5 L79.2 32.9 L79.1 33.2 L78.9 33.6 L78.7 33.9 L78.4 34.1 L78.2 34.3 L77.8 34.5 L77.5 34.7 L77.1 34.8 L76.8 34.9 L76.4 35.0 L76.0 35.0 L75.6 35.0 L75.2 34.9 L74.9 34.8 L74.5 34.7 L74.2 34.5 L73.8 34.3 L73.6 34.1 L73.3 33.9 L73.1 33.6 L72.9 33.2 L72.8 32.9 L72.7 32.5 L72.6 32.1 L72.6 31.7 L72.6 31.3 L72.6 30.9 L72.7 30.4 L72.8 29.9 L73.0 29.5 L73.2 29.0 L73.3 28.4 L73.5 27.7 L73.8 27.1 L74.0 26.5 L74.2 25.9 L74.4 25.4 L74.7 24.8 L74.9 24.3 L75.1 23.8 L75.2 23.3 L75.4 22.9 L75.6 22.5 L75.7 22.2 L75.8 21.9 L75.9 21.6 L75.9 21.4 L76.0 21.2 L76.0 21.1 L76.0 21.0Z", fill: "#FFD666" }, logo);
    card.appendChild(h("div.hero", logo, h("h2", "Benvenuto in " + T.APP.name), h("p", "Budget settimanale, spese per categoria e quando potrai raggiungere l'indipendenza finanziaria."), h("p.small", "Niente account e niente server: i dati restano su questo telefono.")));
    card.appendChild(h("div.list",
      h("button.btn.primary.block", { type: "button", onclick: next }, "Configura in 3 minuti"),
      h("div", { style: { blockSize: "10px" } }),
      h("button.btn.block", { type: "button", onclick: async () => { const f = await T.pickFile(".json,application/json"); if (f) A.restoreBackup(f); } }, "Ho gia' un backup"),
      h("div", { style: { blockSize: "10px" } }),
      h("button.btn.ghost.block", { type: "button", onclick: async () => { A.S = T.makeDemoState(); await T.save(A.S, true); A.go("home", null, true); } }, "Prova con dati di esempio")));
  } else if (w.step === 1) {
    card.appendChild(h("h2", "1 \u00b7 Valuta e reddito"));
    card.appendChild(T.selectField("Valuta", S.profile.currency, CURRENCIES, v => { S.profile.currency = v; A.save(); }));
    card.appendChild(T.numField("Reddito netto al mese (della famiglia)", S.profile.incomeMonthly || null, v => { S.profile.incomeMonthly = v || 0; A.save(); }, { hint: "Un mese normale, senza bonus. Lo puoi cambiare quando vuoi." }));
    card.appendChild(nav(false));
  } else if (w.step === 2) {
    card.appendChild(h("h2", "2 \u00b7 Costi fissi"));
    card.appendChild(h("p.sub", "Le spese che escono ogni mese o a scadenza fissa. Scrivi l'importo di ogni pagamento e quanto spesso arriva."));
    const tmpl = [["Affitto o mutuo", "mensile"], ["Cassa malati / assicurazione sanitaria", "mensile"], ["Leasing o rata auto", "mensile"], ["Energia e acqua", "trimestrale"], ["Internet e telefono", "mensile"], ["Assicurazioni (auto, casa)", "annuale"]];
    if (!S.fixed.length) tmpl.forEach(([n, f]) => S.fixed.push({ id: T.uid(), name: n, amount: 0, freq: f, kind: "costo" }));
    S.fixed.forEach(f => card.appendChild(h("div.grid2", { style: { alignItems: "end" } }, T.numField(f.name, f.amount || null, v => { f.amount = v || 0; A.save(); }), T.selectField("Frequenza", f.freq, FREQS, v => { f.freq = v; A.save(); }))));
    card.appendChild(h("div.row.wrap", h("button.btn", { type: "button", onclick: () => { S.fixed.push({ id: T.uid(), name: "Altro costo fisso", amount: 0, freq: "mensile", kind: "costo" }); A.render(); } }, "Aggiungi"), h("button.btn", { type: "button", onclick: () => A.importFlow() }, "Importa PDF UBS")));
    card.appendChild(nav(true));
  } else if (w.step === 3) {
    const F = S.fire;
    card.appendChild(h("h2", "3 \u00b7 Obiettivo FIRE"));
    card.appendChild(h("p.sub", "Servono per stimare quando potrai smettere di lavorare. Bastano numeri arrotondati."));
    card.appendChild(T.numField("Anno di nascita", F.birthYear, v => { F.birthYear = v; A.save(); }, { step: 1 }));
    card.appendChild(T.numField("Patrimonio investito", F.investable || null, v => { F.investable = v || 0; A.save(); }, { hint: "Azioni, ETF, fondi" }));
    card.appendChild(T.numField("Liquidita' e risparmi", F.cash || null, v => { F.cash = v || 0; A.save(); }));
    const pen = F.pensions[0] || (F.pensions[0] = { name: "Pensione statale", age: 65, monthly: 0 });
    card.appendChild(h("div.grid2", T.numField("Pensione statale da (eta')", pen.age, v => { pen.age = v || 65; A.save(); }), T.numField("Importo al mese (stima)", pen.monthly || null, v => { pen.monthly = v || 0; A.save(); })));
    card.appendChild(h("p.small.muted", "Cassa pensione, 3a e altri dettagli si aggiungono dopo nella sezione FIRE."));
    card.appendChild(nav(true));
  } else {
    card.appendChild(h("h2", "4 \u00b7 Primo estratto conto"));
    card.appendChild(h("p", "Importa l'export della carta che usi per le spese quotidiane. Funziona con l'estratto Revolut (Excel o CSV) e con il CSV di quasi tutte le banche."));
    card.appendChild(h("p.small.muted", "Su Revolut: Profilo > Documenti ed estratti > Estratto conto > Excel o CSV, periodo a scelta."));
    card.appendChild(h("button.btn.primary.block", { type: "button", onclick: async () => { const f = await T.pickFile(); if (!f) return; await finish(); A.importFile(f); } }, T.icon("import"), "Scegli il file"));
    card.appendChild(h("div.row", { style: { marginBlockStart: "16px" } }, h("button.btn", { type: "button", onclick: prev }, "Indietro"), h("div.grow"), h("button.btn.ghost", { type: "button", onclick: finish }, "Lo faccio dopo")));
  }
};
})();
