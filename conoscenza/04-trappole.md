# Trappole già incontrate

Problemi reali visti durante lo sviluppo, con la soluzione adottata. Prima di toccare queste aree, rileggi qui.

## Sul telefono

- **La tastiera si chiudeva subito nei campi di testo** (1.3.1).
  - Causa: aprendosi, la tastiera fa scattare `resize`, e l'app ridisegnava tutto, perdendo il campo attivo.
  - Soluzione: ridisegnare solo se cambia la **larghezza**, e mai se c'è un campo con il fuoco (vedi `30-main.js`).
  - Lo stesso principio vale per gli aggiornamenti in sottofondo (famiglia, Revolut): mentre l'utente scrive o un foglio è aperto, si aspetta (`A.softRender`, l'attesa in `A.famSync`).
- **Ogni tocco riportava in cima alla schermata** (1.6).
  - Causa: `A.render()` svuotava la vista e la pagina tornava in alto.
  - Soluzione: `A.render()` salva e ripristina `scrollY`. Solo `A.go()` (cambio schermata) imposta `A._toTop`.
- **L'app installata non si aggiorna subito.**
  - Il service worker serve la versione in cache; la nuova si attiva dopo una o due riaperture. Bisogna **chiudere e riaprire l'app due volte**: dillo sempre a Marco dopo un rilascio.
  - Il nome della cache (`sw.js`) contiene l'hash del contenuto (`__VERSION__` sostituito da `build.py`).
- **Il collegamento della famiglia nel QR** (`#famiglia=`) va letto **all'avvio**, prima di qualsiasi `history.replaceState`, che lo cancellerebbe. Vedi `A._joinHash` in `26-famiglia.js`.
- **Su Android l'app installata è legata al browser che l'ha installata.** Il QR della famiglia va aperto e installato dallo stesso browser, di solito Chrome. I dati non passano da Chrome a un altro browser.

## Pubblicazione su GitHub

- **Il caricamento dal sito di GitHub** con "choose files" appiattisce le cartelle.
  - Bisogna **trascinare il contenuto** della cartella (non la cartella stessa) oppure solo `docs/`.
  - All'inizio Marco aveva caricato zip interi o la cartella sbagliata: GitHub mostrava ancora la versione vecchia.
  - Con git e VS Code il problema sparisce.
- **GitHub Pages** pubblica la cartella `/docs` del ramo `main`, e serve `.nojekyll` (già in `src/static`). Dopo un push servono circa 1-10 minuti, più la cache del telefono.
- **L'indirizzo è `myFinancesOnFire`, con la S.** Marco ci tiene: "Finances" al plurale anche nel nome dell'app.

## Lingue

- **Le costanti dei moduli vengono create in italiano** (la lingua all'avvio è "it"). Vanno tradotte quando si disegna, non quando si definiscono.
- **Chiavi con contesto** (`"Altro~menu"`, `"1A~orizzonte"`) per parole uguali con significati diversi.
- **Frasi spezzate in pezzi** (`T.tr("Ancora ") + n + T.tr(" anni")`) si traducono male. Usa sempre i segnaposto `{n}`.
- **Non tradurre i codici interni** (`rcat` come "Cambio valuta", `flow`, la frequenza "mensile"): sono usati nei confronti.
- `tests/lingue.js` cerca parole italiane nelle schermate EN e DE con una lista di parole. I nomi dei file (`GUIDA-...md`) sono esclusi.

## Dati

- **Il nome vecchio "traguardo".** L'app legge ancora il database e i backup con quel nome. "Ricomincia da zero" deve cancellare anche quello (`T.storage.wipe`), altrimenti i dati ricompaiono.
- **Le date sono locali.** `toISOString()` sposta di un giorno vicino alla mezzanotte, quindi per il calendario usa sempre `T.iso`, `T.today()` e `T.addDays()`.
- **Colori delle categorie.** Nella 1.4 i colori predefiniti sono passati alla tavolozza Bosco (`T.PALETTE_OLD` → `T.PALETTE`), ma solo se l'utente non li aveva cambiati.
- **Regole condivise in famiglia.** Se una regola arriva dall'altro telefono, bisogna riclassificare (`T.reclassifyAll`) e unire di nuovo.
- **Reddito netto mensile.** Se viene da una media che comprende bonus e azioni, il tasso di risparmio e il risparmio del FIRE risultano gonfiati. Vedi il backlog.

## Ponte e servizi esterni

- **La chiave privata di Enable Banking** può essere PKCS#8 (`BEGIN PRIVATE KEY`) o PKCS#1 (`BEGIN RSA PRIVATE KEY`): il ponte le accetta tutte e due. Nelle variabili di Cloudflare gli a capo possono arrivare come `\n` letterali.
- **Intestazioni PSU.** Alcune banche le rifiutano: in quel caso il ponte riprova senza.
- **Interactive Brokers.**
  - Il token con restrizione IP non funziona, perché gli indirizzi di Cloudflare cambiano.
  - Il report del mattino può essere "in preparazione" (1019).
  - Non superare le 10 richieste al minuto.
- **Cloudflare dalla pagina web.** L'editor ("Edit code") sostituisce tutto il codice: va incollato il file intero e poi premuto **Deploy**. Le variabili restano.

## Test

- **L'ambiente di test non ha né browser né rete.** Tutto passa da `tests/dom-stub.js`, con larghezza fissa a 360 px. Le verifiche visive sono state fatte disegnando gli SVG in immagini. Con VS Code puoi usare il browser vero (vedi 05-come-lavorare.md).
- **Ogni test deve passare anche senza i dati di Marco.** Nella 1.8 `collegamento.js` e `lingue.js` passavano solo con il suo backup: è stato corretto nel pacchetto per Copilot (demo in italiano, con `demo: false`).
- **`ponte/package.json`** (`"type": "module"`) esiste solo perché Node non avvisi sul file ES module.
