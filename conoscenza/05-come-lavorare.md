# Come lavorare sul progetto

## Cosa installare (una volta sola)

- **Visual Studio Code** con l'estensione **GitHub Copilot** (Chat compresa).
- **Git**: su Windows basta "Git for Windows".
- **Node.js 20 o più recente**: per i test (non servono pacchetti npm).
- **Python 3**: per `build.py`.
- Per l'app nativa, più avanti: Android Studio. Vedi 06-app-nativa.md.

## Comandi

```bash
npm run build         # ricostruisce docs/ da src/ (python3 build.py)
npm test              # build + tutti i test, circa 3 minuti (node tests/tutti.js)
npm run traduzioni    # testi senza EN/DE (node tests/traduzioni-mancanti.js)
npm run serve         # app su http://localhost:8080
```

Su Windows usa `python` al posto di `python3`. `tests/tutti.js` lo fa da solo.

**Test con i dati veri di Marco.** I file personali non entrano mai nel repository. `npm run test:personale` trova da solo il backup; per l'estratto Revolut e il PDF UBS si usano le variabili d'ambiente `MFOF_REVOLUT` e `MFOF_UBS`.

```bash
npm run test:personale    # cerca da solo il backup in "../Dati personali - NON pubblicare"
```

Su Windows PowerShell, per un file preciso: `$env:MFOF_BACKUP="..\Dati personali - NON pubblicare\nome.json"; npm test`

## Provare l'app

- **Sul computer.** Avvia il server e apri `http://localhost:8080`. Il service worker funziona solo su `localhost` o in https.
  - Per vedere l'app come su un telefono: in Chrome apri gli strumenti per sviluppatori e attiva la modalità dispositivo.
  - VS Code ha anche un browser integrato che Copilot può usare per guardare le schermate.
- **Sul telefono, senza pubblicare.**
  1. In VS Code apri il pannello **Ports** e scegli **Forward a Port** sulla porta 8080, con visibilità "Public" o con l'accesso GitHub.
  2. Apri l'indirizzo https che compare.
  3. Per vedere gli errori: collega il telefono con il cavo, attiva il debug USB e apri `chrome://inspect` sul computer.
- **I dati di esempio** (Altro, poi "Prova con dati di esempio") riempiono l'app con spese, FIRE e un portafoglio inventati.
- **Attenzione con la famiglia.** Non provare la famiglia sul telefono di Marco con dati di esempio: finirebbero anche sul telefono della moglie. L'app lo impedisce, ma resta un'attenzione da avere.

## Flusso con git

- **Repository.** `github.com/marcoceccano/myFinancesOnFire`. GitHub Pages pubblica `main` / `docs`.
- **Modifiche piccole.** Commit su `main` con `docs/` ricostruita e i test verdi.
- **Lavori grandi** (app nativa, un nuovo modello dei dati): un ramo e una pull request. Copilot cloud agent può aprirla da un'issue.
- **Prima di ogni commit** controlla che non entrino file personali. Il `.gitignore` blocca backup, xlsx, pdf, csv, xml (tranne le fixture), chiavi e `.dev.vars`.
- **Ponte.** Oggi Marco lo aggiorna incollandolo in Cloudflare. Volendo si può passare a `wrangler deploy`: serve un `wrangler.toml` in `ponte/` e i segreti con `wrangler secret put`. In quel caso documentalo nella guida.

## Aggiungere una funzione: lista di controllo

1. Il codice va in `src/js/` (un modulo nuovo va aggiunto anche a `ORDER` in `build.py`).
2. I testi passano da `T.tr()` e hanno le traduzioni EN e DE in `03-dict.js`.
3. I dati nuovi hanno un default in `T.newState()` o `T.FIRE_DEFAULTS`. Le conversioni vanno in `T.migrate()`. Se il dato va condiviso, aggiornalo anche in `13-family.js`.
4. Servono test nuovi nel file della schermata (`smoke.js`, `portafoglio.js`, ecc.) e in `unit.js` per la logica pura.
5. Esegui `node tests/tutti.js`: tutto deve essere verde.
6. Aggiorna PROGETTO.md, la sezione novità del README e, se serve, le guide e la privacy.
7. Esegui la skill **rilascio**.
