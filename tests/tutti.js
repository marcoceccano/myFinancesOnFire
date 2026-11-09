/* Esegue il build e tutti i test, poi stampa un riepilogo. Nessuna dipendenza: serve solo Node 20+ e Python 3.
   Uso:  node tests/tutti.js                (dati inventati)
         node tests/tutti.js --personale    (usa il backup piu' recente nella cartella "Dati personali - NON pubblicare",
                                             accanto al repository oppure dentro, se c'e')
   Facoltativo (dati reali, MAI nel repository):
     MFOF_BACKUP=percorso/backup.json      backup personale per collegamento, lingue, famiglia, portafoglio
     MFOF_REVOLUT=percorso/estratto.xlsx   estratto Revolut per il test di fumo
     MFOF_UBS=percorso/pagamenti.pdf       PDF UBS "Pagamenti registrati" per il test di fumo */
"use strict";
const { spawnSync } = require("child_process"), path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, ".."), HTML = path.join(ROOT, "docs", "index.html");
const opt = p => p && fs.existsSync(p) ? [p] : [];
/* cartella dei dati personali: accanto al repository (consigliato) oppure dentro (ignorata da git) */
const personalBackup = () => {
  for (const dir of [path.join(ROOT, "..", "Dati personali - NON pubblicare"), path.join(ROOT, "Dati personali - NON pubblicare")]) {
    if (!fs.existsSync(dir)) continue;
    const js = fs.readdirSync(dir).filter(f => /backup.*\.json$/i.test(f)).sort();
    if (js.length) return path.join(dir, js[js.length - 1]);
  }
  return null;
};
const wantPersonal = process.argv.includes("--personale");
const BK = opt(process.env.MFOF_BACKUP || (wantPersonal ? personalBackup() : null)), REV = opt(process.env.MFOF_REVOLUT), UBS = opt(process.env.MFOF_UBS);
const py = process.platform === "win32" ? "python" : "python3";
const steps = [
  ["build", py, ["build.py"]],
  ["traduzioni", "node", ["tests/traduzioni-mancanti.js"]],
  ["unit", "node", ["tests/unit.js"]],
  ["qr", "node", ["tests/qr.js", HTML]],
  ["ponte", "node", ["tests/ponte.mjs"]],
  ["smoke", "node", ["tests/smoke.js", HTML, ...REV, ...(REV.length ? UBS : [])]],
  ["collegamento", "node", ["tests/collegamento.js", HTML, ...BK]],
  ["lingue", "node", ["tests/lingue.js", HTML, ...BK]],
  ["famiglia", "node", ["tests/famiglia.js", HTML, ...BK]],
  ["portafoglio", "node", ["tests/portafoglio.js", HTML, ...BK]]
];
if (wantPersonal && !BK.length) console.log("Nessun backup trovato nella cartella \"Dati personali - NON pubblicare\": uso i dati inventati.\n");
const res = [];
for (const [name, cmd, args] of steps) {
  const t0 = Date.now(), r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", timeout: 15 * 60 * 1000 });
  const out = (r.stdout || "") + (r.stderr || ""), fails = out.split("\n").filter(l => /^FAIL|ERRORE|Error:/.test(l));
  const ok = r.status === 0 && !fails.length;
  res.push({ name, ok, s: ((Date.now() - t0) / 1000).toFixed(1) });
  console.log((ok ? "OK   " : "FAIL ") + name + " (" + res[res.length - 1].s + " s)");
  if (!ok) console.log(out.split("\n").filter(l => /FAIL|ERRORE|Error|falliti|\[/.test(l)).slice(0, 15).map(l => "     " + l).join("\n") || out.slice(-1500));
  if (name === "build" && !ok) break;
}
const bad = res.filter(r => !r.ok);
console.log(bad.length ? "\n" + bad.length + " gruppi di test falliti: " + bad.map(r => r.name).join(", ") : "\nTutti i test superati" + (BK.length ? " (con il backup personale)" : " (dati inventati)"));
process.exitCode = bad.length ? 1 : 0;
