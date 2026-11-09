# Istruzioni per GitHub Copilot: myFinances on FIRE

## Il progetto in breve

**myFinances on FIRE** è una Progressive Web App personale di finanza per una coppia in Svizzera. Valuta di base CHF, lingue italiano, inglese e tedesco. È pubblicata su GitHub Pages: <https://marcoceccano.github.io/myFinancesOnFire/> (cartella `docs/`).

Cosa fa:
- budget settimanale e spese giorno per giorno;
- analisi delle spese per periodo e categoria, con costi fissi;
- simulatore FIRE Monte Carlo;
- portafoglio Interactive Brokers;
- condivisione cifrata in famiglia.

Cosa legge:
- estratti Revolut e PDF UBS (import di file);
- movimenti Revolut in automatico (open banking, solo lettura) tramite Enable Banking e un Cloudflare Worker personale, il "ponte";
- il report Flex di Interactive Brokers, tramite lo stesso ponte.

Versione attuale: **1.8.0**. Il prossimo obiettivo è trasformarla in **app nativa**: vedi [conoscenza/06-app-nativa.md](../conoscenza/06-app-nativa.md).

## Prima di lavorare

1. Leggi [PROGETTO.md](../PROGETTO.md) (architettura, modello dei dati, scelte) e l'indice [conoscenza/README.md](../conoscenza/README.md).
2. Per una modifica a un'area, leggi la parte relativa in `conoscenza/` (integrazioni, trappole, decisioni).
3. Esegui `node tests/tutti.js` prima e dopo ogni modifica: tutti i gruppi devono restare verdi.

## Regole che non si rompono

- **Zero dipendenze nell'app web.**
  - Solo JavaScript del browser: IndexedDB, WebCrypto, DecompressionStream, SVG.
  - Niente framework, librerie o CDN.
  - Il build è `npm run build` (cioè `python3 build.py`, su Windows `python build.py`): concatena `src/js/*.js` nell'ordine della lista `ORDER`, incorpora CSS, font e icona e scrive `docs/`.
  - Un nuovo modulo va aggiunto a `ORDER` in `build.py` e, se serve ai test unitari, alla lista in `tests/unit.js`.
- **Non modificare `docs/` a mano.** È generata da `build.py`. Modifica `src/` e ricostruisci.
- **Nessun dato personale nel repository**, che è pubblico.
  - Niente backup, estratti, importi reali, token, chiavi o nomi di conti.
  - Le fixture dei test sono inventate.
  - I dati personali stanno nella cartella "Dati personali - NON pubblicare", accanto alla cartella del repository (`../Dati personali - NON pubblicare`). Se per sbaglio è dentro, git la ignora comunque (`.gitignore`). Puoi leggerla per capire il contesto. Non copiarne mai il contenuto nel codice, nei test o nei documenti.
- **Ogni testo visibile passa da `T.tr("testo italiano")`** e ha la traduzione EN e DE in `src/js/03-dict.js`.
  - Usa i segnaposto `{x}` (es. `T.tr("Ancora {n} anni", { n })`) invece di concatenare pezzi di frase.
  - `node tests/traduzioni-mancanti.js` deve stampare `[]`.
- **I codici interni non si traducono** (valori `flow`, `rcat`, chiavi di frequenza, id di categoria).
- **Dati sempre compatibili.**
  - Lo stato vive in IndexedDB.
  - Ogni campo nuovo ha un default in `T.newState()` o `T.FIRE_DEFAULTS`.
  - Le conversioni di dati vecchi vanno in `T.migrate()`, con un flag in `meta` se sono una tantum.
  - Il formato del backup (`T.makeBackup`) non deve perdere campi.
- **Ponte (`ponte/worker.js`) in sola lettura e sicuro.**
  - Nessun pagamento.
  - Il token e i segreti non tornano mai all'app.
  - Controllo di origine e APP_TOKEN.
  - A ogni modifica aggiorna `VERSION` e i test in `tests/ponte.mjs`.
  - Marco lo aggiorna incollandolo a mano in Cloudflare, quindi deve restare compatibile con le versioni precedenti dell'app.
- **Interfaccia mobile-first, stile "Bosco".**
  - Usa le variabili CSS del tema, le proprietà logiche (`margin-inline-start`, ecc.) e il tema scuro.
  - Vedi [conoscenza/02-decisioni-e-preferenze.md](../conoscenza/02-decisioni-e-preferenze.md).

## Stile del codice

- Il namespace globale è `T` (utilità e logica). L'app e le schermate sono in `T.A` (alias `A`).
- Per il DOM si usa l'helper `T.h("div.card#id", {attr}, ...figli)`, per l'SVG `T.s(...)`.
- Commenti e nomi in **italiano**, come il resto del codice. Frasi brevi.
- Gli importi si formattano con `T.fmt.*` / `A.money()`, le date con `T.fmt.date()`. Le date interne sono stringhe `YYYY-MM-DD` in ora locale (`T.today()`, `T.addDays()`): mai `toISOString()` per le date di calendario.
- `A.render()` ridisegna la schermata corrente e conserva lo scorrimento. Solo `A.go()` cambia schermata e riporta in cima.

## Come parlare con Marco

- Marco scrive in **italiano**: rispondi in italiano, in modo semplice e operativo.
- È un utente esperto ma non uno sviluppatore. Per i passaggi fuori dal codice (GitHub, Cloudflare, Interactive Brokers, Enable Banking, Play Store) dai istruzioni numerate, clic per clic.
- Nei testi dell'app e nelle guide niente trattini lunghi (—, –): usa virgole, due punti o frasi separate.
- Proponi le scelte importanti prima di farle (aspetto grafico, cambi al modello dei dati, nuove dipendenze).

## Rilascio

Segui la skill [rilascio](skills/rilascio/SKILL.md):
1. aggiorna la versione;
2. aggiorna la sezione novità di README e PROGETTO;
3. esegui build e test;
4. fai commit.

Il deploy avviene con il push su `main`: GitHub Pages pubblica `docs/`.
