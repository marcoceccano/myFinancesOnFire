---
name: rilascio
description: Prepara una nuova versione di myFinances on FIRE (numero di versione, novità, build, test, commit) e spiega a Marco come pubblicarla. Usala quando Marco chiede di "fare una nuova versione", "rilasciare" o "pubblicare".
---
# Rilascio di una nuova versione

1. **Numero di versione.** Aggiorna `T.APP.version` in `src/js/00-util.js` e `version` in `package.json`.
   - Correzione: aumenta l'ultima cifra (1.8.0 → 1.8.1).
   - Funzione nuova: aumenta quella di mezzo (1.8.x → 1.9.0).
2. **Ponte.** Se è cambiato `ponte/worker.js`:
   - aggiorna `VERSION` e i messaggi dell'app che citano la versione minima del ponte;
   - aggiorna le guide (`GUIDA-*.md`).
3. **Documentazione.**
   - In `README.md` aggiungi in cima una sezione "Novità della X.Y", con frasi brevi e senza trattini lunghi.
   - Aggiorna `PROGETTO.md` (moduli, modello dei dati, decisioni) e, se serve, `conoscenza/01-storia.md`.
   - Se cambia cosa viene trasmesso o salvato, aggiorna `PRIVACY.md` e `src/static/privacy.html` in IT, EN e DE.
   - In quel caso aggiorna anche `PRIVACY_DATE` in `build.py` (data di "ultimo aggiornamento" mostrata nelle pagine privacy e condizioni). Se il testo non cambia, la data resta com'è.
4. **Controlli.**
   - `node tests/traduzioni-mancanti.js` deve stampare `[]`.
   - `node tests/tutti.js` deve essere tutto verde. Se Marco ha i suoi file, ripetilo anche con `MFOF_BACKUP`, `MFOF_REVOLUT` e `MFOF_UBS`.
   - Controlla che `git status` non contenga file personali (`*.json` di backup, `.xlsx`, `.pdf`, `.csv`, `.xml` fuori da `tests/fixtures/`).
5. **Commit e tag.** Messaggio di commit `vX.Y.Z: <riassunto>`, poi `git tag vX.Y.Z`.
6. **Pubblicazione.** Con il push su `main`, GitHub Pages pubblica `docs/` in un paio di minuti.
7. **Messaggio a Marco, in italiano.**
   - Le novità, in un elenco breve.
   - Se è cambiato il ponte: dove incollarlo in Cloudflare e cosa premere.
   - Sul telefono: chiudere e riaprire l'app due volte (il service worker scarica la nuova versione). In Altro deve comparire la versione nuova.
   - Il telefono di Debora (famiglia) si aggiorna allo stesso modo.
