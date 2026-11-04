/* Prova delle lingue: tutte le schermate in inglese e tedesco, testi senza traduzione.
   Uso: node tests/lingue.js docs/index.html [backup.json] */
"use strict";
const fs = require("fs"), stub = require("./dom-stub.js");
const [, , htmlPath, backupPath] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
const html = fs.readFileSync(htmlPath, "utf8"), js = html.split("<script>")[1].split("</script>")[0];
global.document = stub.document; global.window = global;
Object.defineProperty(global, "location", { value: { protocol: "https:", hostname: "x.github.io", origin: "https://x.github.io", pathname: "/myFinancesOnFire/", search: "", href: "" }, configurable: true, writable: true });
global.history = { length: 1, pushState() { }, replaceState() { }, back() { } }; global.scrollTo = () => { }; global.addEventListener = () => { };
Object.defineProperty(global, "navigator", { value: { storage: {}, languages: ["de-CH", "de"], clipboard: { writeText: async () => { } } }, configurable: true });
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
stub.buildShell(html);
const wait = ms => new Promise(r => setTimeout(r, ms || 60)), $ = id => stub.document.getElementById(id), txt = e => e.textContent.replace(/\s+/g, " ").trim();
const ITALIAN = /\b(spese|movimenti|importa|aggiorna|settimana|giorni|risparmio|collegamento|patrimonio|impostazioni|categorie|costi fissi|annulla|salva|elimina|nessun|della|delle|degli|il tuo|questo|anche|oppure|sono|resta|scegli|tocca)\b/i;
(async () => {
  eval(js); await wait(300);
  ok(T.LANG === "de" && /Willkommen/.test(txt($("view"))), "primo avvio con telefono in tedesco: benvenuto in tedesco");
  ok(T.A.S.categories[0].name === "Lebensmittel", "categorie predefinite create in tedesco");
  const chip = $("view").querySelectorAll("button.chip").find(b => txt(b) === "English"); chip.click(); await wait(100);
  ok(T.LANG === "en" && /Welcome/.test(txt($("view"))) && T.A.S.categories[0].name === "Groceries", "cambio lingua dalla schermata di benvenuto, categorie rinominate");
  /* dati di Marco */
  if (backupPath) { const st = T.readBackup(JSON.parse(fs.readFileSync(backupPath))); st.profile.onboarded = true; T.A.S = st; }
  else { T.A.S = T.makeDemoState(); }
  const S = T.A.S;
  ok((S.profile.lang || "it") === "it", "i dati esistenti restano in italiano finche' non cambi lingua");
  for (const L of ["de", "en", "it"]) {
    T._miss = new Set();
    T.A.setLanguage(L); await wait(50);
    const seen = [];
    for (const v of ["home", "spese", "budget", "fire", "altro"]) { T.A.go(v); await wait(1300); seen.push(txt($("view"))); }
    for (const sub of ["collega", "famiglia", "profilo", "fissi", "categorie", "regole", "vacanze", "storico", "backup", "info"]) { T.A.go("altro", sub); await wait(80); seen.push(txt($("view"))); }
    /* fogli */
    T.A.go("spese"); await wait(600);
    const li = $("view").querySelectorAll("div.li.tap").find(x => /\d{2}[./]\d{2}[./]\d{4}/.test(txt(x))); if (li) { li.dispatch("click"); await wait(80); seen.push(txt($("sheetBody"))); T.closeSheet(); }
    const csv = "Data;Descrizione;Addebito;Accredito\n01.10.2026;Migros;45,20;\n";
    await T.A.importFile({ name: "c.csv", buf: new TextEncoder().encode(csv).buffer }); await wait(100); seen.push(txt($("sheetBody"))); T.closeSheet();
    /* 1.5: foglio di Ricomincia da zero */
    T.A.go("altro"); await wait(80); T.A.resetFlow(); await wait(50); seen.push(txt($("sheetBody"))); T.closeSheet();
    /* 1.4: pannello del giorno, della settimana, simulatore con eta' scelta */
    T.A.go("home"); await wait(1300);
    { const dh = $("dayCard") ? $("dayCard").querySelectorAll("rect.hit") : []; if (dh.length) { dh[dh.length - 1].dispatch("click"); await wait(80); seen.push(txt($("sheetBody"))); T.closeSheet(); } }
    T.A.go("spese"); await wait(300);
    /* 1.6: dettagli della schermata Spese, costi fissi, periodo personalizzato */
    { $("catCard").querySelectorAll("div.li.tap")[0].dispatch("click"); await wait(80); seen.push(txt($("sheetBody"))); T.closeSheet();
      const bars = $("trendCard").querySelectorAll("rect.hit"); bars[bars.length - 1].dispatch("click"); await wait(80); seen.push(txt($("sheetBody"))); T.closeSheet();
      T.A.ui.withFixed = true; T.A.ui.period = "custom"; T.A.ui.from = "2026-09-01"; T.A.ui.to = "2026-10-15"; T.A.render(); await wait(200); seen.push(txt($("view")));
      T.A.fixedSheet("2026-09-01", "2026-10-15"); await wait(50); seen.push(txt($("sheetBody"))); T.closeSheet();
      T.A.ui.withFixed = false; T.A.ui.period = "anno"; T.A.render(); await wait(100); }
    T.A.S.fire.retireAge = 45; T.A.go("fire"); await wait(1300); seen.push(txt($("view"))); T.A.S.fire.retireAge = null;
    T.A.go("home"); await wait(1300);
    seen.push(txt($("title")) + " " + txt($("subtitle")) + " " + $("tabs").children.map(b => (b.querySelector("span") || { textContent: "" }).textContent).join(" "));
    const all = seen.join(" \n ");
    if (L !== "it") {
      const done = new Set(Object.values(T.DICT[L]));
      const isData = x => S.txs.some(t => t.desc === x || t.note === x) || S.rules.some(r => r.m === x) || S.categories.some(c => c.name === x) || S.fixed.some(f => f.name === x || f.payee === x);
      const misses = [...T._miss].filter(x => !done.has(x) && !isData(x) && ITALIAN.test(x.replace(/GUIDA-COLLEGAMENTO-REVOLUT\.md/g, "")));
      ok(misses.length === 0, L + ": nessun testo italiano senza traduzione" + (misses.length ? " -> " + JSON.stringify(misses.slice(0, 12)) : ""));
      const hits = all.split(/[.!?\n]/).filter(s => ITALIAN.test(s)).map(s => s.trim()).filter(s => !/Revolut|UBS|GUIDA-COLLEGAMENTO/.test(s) || ITALIAN.test(s.replace(/GUIDA-COLLEGAMENTO-REVOLUT\.md/g, "")));
      const real = hits.filter(s => !S.categories.some(c => s.includes(c.name)) && !S.txs.some(t => s.includes(t.desc)));
      ok(real.length === 0, L + ": schermate senza frasi italiane" + (real.length ? " -> " + JSON.stringify(real.slice(0, 8)) : ""));
    }
    ok(/[A-Za-z]/.test(all) && stub.errors.length === 0, L + ": tutte le schermate disegnate senza errori (" + all.length + " caratteri)");
  }
  T.A.setLanguage("de"); T.A.go("spese"); await wait(800);
  ok(/Okt|Sep/.test(txt($("view"))) && /\d{2}\.\d{2}\.2026/.test(txt($("view"))), "de: mesi e date in tedesco");
  T.A.setLanguage("en"); T.A.go("spese"); await wait(800);
  ok(/Oct|Sep/.test(txt($("view"))) && /\d{2}\/\d{2}\/2026/.test(txt($("view"))), "en: mesi e date in inglese");
  T.A.setLanguage("it");
  ok(S.categories.find(c => c.id === "alimentari").name === "Alimentari", "ritorno all'italiano: nomi originali");
  console.log("errori JS:", stub.errors.length); stub.errors.slice(0, 3).forEach(e => console.log(e));
  console.log(fails ? fails + " test falliti" : "Prova delle lingue superata");
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.log("ERRORE", e.stack); process.exitCode = 1; });
