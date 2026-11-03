# myFinances on FIRE: documento di progetto

Questo documento descrive com'e' fatta l'app e perche'. Serve a chi continua lo sviluppo, persona o assistente di programmazione: basta fornirgli questo file e la cartella del progetto.

## Obiettivi e vincoli

1. **App e dati separati.** Il codice non contiene dati personali. I dati entrano solo con import o backup e restano sul dispositivo.
2. **Pubblicabile in qualsiasi momento.** Un nuovo utente parte da una configurazione guidata (circa 3 minuti) o dai dati di esempio.
3. **Nessun server.** Calcoli, grafici e lettura dei file avvengono sul telefono. Niente account, niente statistiche, niente librerie da CDN.
4. **Funziona offline.** Progressive Web App con service worker; installabile su Android da Chrome.
5. **Zero dipendenze.** Solo JavaScript del browser (DecompressionStream, IndexedDB, WebCrypto, SVG). Il build e' un piccolo script Python.

## Struttura

```
src/
  index.template.html   guscio HTML (barra, navigazione, foglio dal basso)
  styles.css            stile mobile, tema chiaro e scuro, proprieta' logiche
  js/                   moduli concatenati da build.py in questo ordine:
    00-util.js          numeri, date multilingua, CSV, hash, formattazione, correzione testo con doppia codifica
    03-dict.js          traduzioni inglese e tedesco (chiave = testo italiano)
    03-i18n.js          lingua attiva, T.tr(), mesi e giorni, formati, rinomina dei nomi creati dall'app
    08-market.js        serie storiche pubbliche dei rendimenti (S&P 500 dal 1928, Nasdaq 100, Nasdaq Composite)
    01-store.js         stato, IndexedDB (poi localStorage), migrazioni, backup
    02-files.js         lettura .xlsx (zip + XML) e testo PDF (anche PDF protetti RC4/AES con password vuota)
    04-importers.js     Revolut (estratto Excel consolidato e CSV dell'app), PDF UBS "Pagamenti registrati", CSV generico
    05-categorize.js    categorie e regole predefinite generiche, classificazione, regole utente
    06-stats.js         medie, quadro mensile, settimane, aggregati, proposte di budget
    07-fire.js          simulatore Monte Carlo
    12-bank.js          collegamento automatico: chiamate al ponte, conversione dei movimenti, sincronizzazione
    09-demo.js          dati di esempio inventati
    10-dom.js           helper per l'interfaccia (h, foglio, toast, campi)
    11-charts.js        grafici SVG: anello, colonne, ciambella, linea, ventaglio
    20-app.js           stato dell'interfaccia, navigazione, Home
    21-spese.js         schermata Spese e modifica movimento
    22-budget.js        schermata Budget
    23-fire.js          schermata FIRE
    24-altro.js         impostazioni, import, backup, configurazione guidata
    25-collega.js       schermata del collegamento automatico, consenso, aggiornamento
    30-main.js          avvio, service worker, installazione
  static/               manifest, service worker, icone, privacy.html (copiati in docs/)
ponte/worker.js         ponte Cloudflare Worker verso Enable Banking (vedi sotto)
docs/                   app costruita, da pubblicare
tests/                  unit.js (moduli), smoke.js (interfaccia completa in Node con un DOM minimo), fixtures inventate
```

## Modello dei dati (schema 1)

Un unico oggetto salvato in IndexedDB (database `myfinances-on-fire`, chiave `state`). Il backup e' lo stesso oggetto dentro `{app:"myfinances-on-fire", kind:"backup", schema, version, exported, state}`. Per compatibilita' l'app riprende anche i dati e i backup creati con il nome precedente (`traguardo`).

| Campo | Contenuto |
|---|---|
| `profile` | nome, valuta di base, reddito netto mensile, cambi per le altre valute, `onboarded`, `demo` |
| `categories` | `{id, name, color, essential, vacation?, budget}` (budget mensile) |
| `txs` | movimenti `{id, d, desc, amt (valuta base, negativo = uscita), amtLoc, cur, src, rcat, acct, flow, cat, kind, manual?, vac?, note?}` |
| `rules` | regole utente `{m (esercente normalizzato), exact, flow, cat, kind, src}` |
| `fixed` | costi fissi `{id, name, payee, amount, freq, kind: costo o risparmio, next?: {from, amount}, note}` |
| `vacations` | periodi `{from, to, label}` |
| `budget` | `preset`, `vacationYear`, `investMonthly` |
| `fire` | parametri del simulatore (vedi sotto) |
| `csvProfiles` | mappature colonne ricordate per i CSV generici, chiave = intestazione |
| `imports`, `meta` | storico import, ultimo backup |
| `bank` | collegamento automatico: indirizzo e codice del ponte, paese, sessione, scadenza del consenso, conti, ultima data per conto, ultimo aggiornamento |

`flow` vale `spesa`, `escluso` (ricariche, cambi, investimenti, giroconti, pagamento carta) o `entrata`. I rimborsi restano `spesa` con importo positivo e riducono il totale.

**Id dei movimenti:** hash di fonte, data, esercente normalizzato, importo, valuta e numero di occorrenza nel giorno. Reimportare un periodo sovrapposto non crea doppioni.

## Classificazione

Ordine di precedenza:

1. scelta manuale sul singolo movimento;
2. regole utente: stesso esercente normalizzato, oppure contenuto come parola intera se la regola non e' `exact`;
3. categoria della banca (cambio valuta, ricarica);
4. regole generiche dei movimenti esclusi (robo-advisor, fondi monetari, broker, carte di credito);
5. prelievi di contante;
6. accrediti non riconosciuti, che diventano entrate;
7. regole generiche per categoria (catene svizzere ed europee);
8. altrimenti `altro`.

Quando l'utente corregge un movimento con *vale anche per gli altri*, nasce una regola utente e tutti i movimenti non manuali vengono riclassificati.

## Import supportati

- **Revolut, estratto consolidato .xlsx.** Una colonna con righe CSV, testo in doppia codifica. Legge solo la parte *Conti correnti*, sezione per valuta; per le valute estere usa la colonna gia' convertita nella valuta di base. Intestazioni riconosciute in italiano, inglese, tedesco e francese.
- **Revolut, CSV dell'app** (`Type, Product, Started Date, ...`). Scarta gli stati diversi da completato e converte con i cambi del profilo.
- **UBS, PDF "Pagamenti registrati".** Decifra RC4 o AES con password vuota, decomprime e ricostruisce le righe per coordinate. Propone voci di costo fisso, riconoscendo affitto, cassa malati, leasing, energia, telefonia e 3a. Aggiorna le voci esistenti in base al beneficiario.
- **CSV generico di qualsiasi banca.** Riconosce automaticamente data, descrizione, importo o addebito/accredito e valuta. L'utente conferma le colonne con un'anteprima, e la mappatura viene ricordata.

## Collegamento automatico (12-bank.js, 25-collega.js, ponte/worker.js)

- **Percorso dei dati:** banca -> Enable Banking (AISP autorizzato, modalita' ristretta gratuita con i propri conti) -> ponte dell'utente (Cloudflare Worker) -> app.
- **Il ponte:**
  - firma le richieste con JWT RS256 (chiave privata Enable Banking come Secret);
  - accetta solo richieste dall'origine dell'app (`ALLOWED_ORIGIN`) con il codice `APP_TOKEN`, confrontato in tempo costante;
  - espone solo `/check`, `/banks`, `/connect`, `/session`, `/status`, `/transactions`, `/disconnect`;
  - non salva nulla e non espone i pagamenti;
  - l'indirizzo di ritorno del consenso e' fisso (`REDIRECT_URL`) e non arriva dal client;
  - inoltra le intestazioni PSU (utente presente) e riprova senza se la banca le rifiuta.
- **Consenso:**
  - l'app genera uno `state` casuale e lo salva prima di andare su Enable Banking;
  - al ritorno (`?code=&state=`) verifica lo `state`, crea la sessione e pulisce l'URL.
  - Se il ritorno avviene in un'altra finestra, l'app installata ricarica lo stato salvato quando torna visibile.
- **Sincronizzazione:**
  - per ogni conto scarica dalla data dell'ultimo movimento definitivo meno 10 giorni, con paginazione `continuation_key`;
  - all'apertura al massimo ogni 4 ore, oppure manuale.
- **Movimenti:**
  - id = hash di conto + `transaction_id` (o `entry_reference`);
  - data = `transaction_date`, altrimenti `booking_date`;
  - descrizione = controparte, altrimenti causale;
  - importo con segno da `credit_debit_indicator`;
  - i movimenti in sospeso (`PDNG`) vengono sostituiti a ogni giro, conservando le modifiche manuali.
- **Doppioni tra fonti:** estratto Revolut e collegamento sono la stessa "famiglia". Un movimento con stessa valuta e importo, a 3 giorni o meno da uno dell'altra fonte, viene considerato lo stesso.
- **Errori:** tradotti in messaggi comprensibili (token, origine, indirizzo di ritorno, app non attiva, firma, consenso scaduto). La Home avvisa 14 giorni prima della scadenza del consenso.

## Lingue (03-dict.js, 03-i18n.js)

- Lingue: italiano (testo di base), inglese, tedesco standard. Al primo avvio l'app usa la lingua del telefono (altrimenti inglese). Si cambia dalla schermata di benvenuto o da Altro > Profilo e reddito.
- **Come funziona:**
  - nel codice i testi restano in italiano dentro `T.tr("...")`;
  - `T.tr` cerca la traduzione nel dizionario della lingua attiva, e se manca mostra l'italiano;
  - i testi che passano dagli helper dell'interfaccia (`T.h`, campi, grafici, toast) vengono tradotti anche senza `T.tr` esplicito;
  - una chiave con `~contesto` (per esempio `Altro~menu`) distingue parole uguali con significati diversi.
- **Formati:** con il franco svizzero i numeri usano lo stile svizzero della lingua (`it-CH`, `de-CH`, `en-CH`); con le altre valute, `it-IT`, `de-DE` o `en-GB`. Le date sono 31.12.2026, in inglese 31/12/2026.
- **Dati:** cambiando lingua, i nomi creati dall'app vengono tradotti solo se non li hai modificati (categorie, costi fissi, rendite, vacanze). I dati creati prima della 1.3 restano in italiano finche' non cambi lingua.
- **Aggiungere una lingua:**
  1. in `03-dict.js` copia il blocco `"en"` con un nuovo codice (per esempio `"fr"`) e traduci i valori;
  2. in `03-i18n.js` aggiungi la lingua a `T.LANGS`, `T.MONTHS` e `T.WEEKDAYS`;
  3. esegui `node tests/lingue.js docs/index.html` per trovare frasi rimaste in italiano.
- Le pagine `privacy.html` e `terms.html` sono trilingui sullo stesso indirizzo (servono a Enable Banking).

## Simulatore FIRE (07-fire.js)

- Passo annuale, importi in moneta di oggi.
- Rendimento reale del portafoglio = quota azionaria x rendimento storico ricampionato a blocchi (5 anni) + resto x rendimento prudente, entrambi al netto dell'inflazione.
- I profili di mercato correggono il livello delle sequenze storiche: *mondiale* = S&P 500 meno 1,3 punti l'anno dal 1972.
- **Fino al ritiro:** patrimonio x (1 + r) + risparmio annuo. Il risparmio e' automatico (reddito meno spese) o manuale.
- **Dopo il ritiro:** il fabbisogno e' la spesa annua meno le rendite attive, con imposta media sui prelievi.
  - *Strategia fissa:* si preleva sempre lo stesso fabbisogno reale.
  - *Guardrail:* se il tasso di prelievo corrente supera quello iniziale di oltre la banda, si taglia del passo, ma mai sotto la spesa minima. Se scende sotto la banda, si aumenta del passo, al massimo +25%.
- I capitali una tantum entrano all'eta' indicata.
- Per ogni eta' di ritiro si calcola la probabilita' che il patrimonio duri fino all'eta' finale. Si usano le stesse sequenze di rendimento per tutte le eta', cosi' il confronto e' equo.
- L'eta' FIRE e' la prima eta' con probabilita' sopra la soglia, interpolata.
- Numero FIRE = spesa annua / tasso di prelievo.
- Nella schermata Budget l'effetto del budget si misura con due simulazioni rapide: abitudini di oggi contro budget.

## Test

- `node tests/unit.js`: date, importi, CSV, Revolut CSV, CSV generico, classificazione, regole, riga PDF UBS, statistiche, FIRE, backup.
- `node tests/lingue.js docs/index.html [backup.json]`: tutte le schermate in tedesco e inglese, frasi rimaste in italiano, cambio lingua dei dati, mesi e date.
- `node tests/ponte.mjs`: ponte con Enable Banking simulato (firma JWT verificata, chiavi PKCS#8 e PKCS#1, CORS, token, percorsi rifiutati, nessun accesso ai pagamenti).
- `node tests/collegamento.js docs/index.html [backup.json]`: app + ponte reale + banca simulata. Copre verifica, consenso, ritorno, primo aggiornamento senza doppioni con l'estratto, movimenti in sospeso, limiti dell'aggiornamento automatico, avvisi di scadenza ed errori.
- `node tests/smoke.js docs/index.html [estratto-revolut.xlsx] [pagamenti-ubs.pdf]`: configurazione guidata, dati di esempio, tutte le schermate, modifica movimento con regola, budget, FIRE, impostazioni, backup e ripristino, import reali facoltativi, CSV generico. Segnala anche gli errori JavaScript.
- I file reali si passano solo da riga di comando e non vanno mai nel repository (vedi `.gitignore`).

## Scelte fatte

- **Un solo file HTML con CSS e JS incorporati:** funziona anche aprendolo dal disco e semplifica la cache offline. I sorgenti restano separati in `src/`.
- **Niente librerie:** nessun aggiornamento di sicurezza da inseguire e nessuna chiamata di rete.
- **Settimana da lunedi'.** Il tetto settimanale e' il budget mensile delle spese variabili x 12 / 52. Le spese di vacanza hanno un budget annuo a parte.
- **Medie mensili** calcolate sui giorni coperti dai dati (giorni / 30,44).
- **Un solo stato per dispositivo.** Per usare l'app in due si passa il backup; la sincronizzazione vera e' nella roadmap.

## Roadmap possibile

1. Condivisione diretta dall'app della banca a myFinances on FIRE (Web Share Target).
2. Sincronizzazione tra due telefoni tramite un file su un cloud personale scelto dall'utente.
3. Collegamento automatico anche per altre banche europee (il ponte e' gia' generico; serve la scelta della banca nell'app).
4. Altre lingue (francese per la Svizzera romanda): basta un nuovo blocco nel dizionario.
5. Simulatore: rendite con indicizzazione parziale, imposte sulle sole plusvalenze, ritiro del 2 pilastro a eta' variabile.

## Pubblicare sul Play Store

1. Pubblica `docs/` su un dominio https (GitHub Pages va bene).
2. Su pwabuilder.com inserisci l'indirizzo e genera il pacchetto Android (Trusted Web Activity).
3. Copia il file `assetlinks.json` generato in `docs/.well-known/` e ripubblica: serve a Google per verificare che app e sito sono tuoi.
4. Crea un account sviluppatore Google Play (25 dollari una tantum) e carica il pacchetto.
5. Come informativa privacy indica l'indirizzo di `privacy.html`. Nel modulo *Sicurezza dei dati* dichiara che l'app non raccoglie ne' condivide dati.
6. Prima di pubblicare verifica che il nome sia libero e scegli una licenza per il codice.
