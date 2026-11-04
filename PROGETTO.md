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
  styles.css            stile mobile "Bosco", tema chiaro e scuro, proprieta' logiche; __FONTS__ diventa il carattere Rubik incluso
  fonts/                Rubik 400 e 700 (WOFF, sottoinsieme latino, licenza SIL OFL 1.1), incorporati da build.py
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
    13-family.js        famiglia: copia condivisa cifrata (AES-GCM), unione a tre vie, creazione, ingresso, allineamento
    14-qr.js            codice QR (ISO/IEC 18004, modo byte, correzione M) disegnato in SVG
    09-demo.js          dati di esempio inventati
    10-dom.js           helper per l'interfaccia (h, foglio, toast, campi)
    11-charts.js        grafici SVG: anello, colonne, ciambella, linea e ventaglio (toccabili), semicerchio di riuscita, settimana giorno per giorno
    20-app.js           stato dell'interfaccia, navigazione, Home
    21-spese.js         schermata Spese e modifica movimento
    22-budget.js        schermata Budget
    23-fire.js          schermata FIRE
    24-altro.js         impostazioni, import, backup, configurazione guidata
    25-collega.js       schermata del collegamento automatico, consenso, aggiornamento
    26-famiglia.js      schermata Famiglia, ingresso dal QR, allineamento automatico, Ricomincia da zero
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
- L'eta' FIRE e' la prima eta' con probabilita' sopra la soglia (predefinita 90%), interpolata.
- Il calcolo e' diviso in tre parti: `T.firePrepare` (sequenze e tabelle), `T.fireCurve` (probabilita' per ogni eta', in differita) e `T.fireAt` (dettaglio per l'eta' scelta: bande, riuscita, spesa media mediana in pensione, capitale residuo mediano). Cosi' il cursore ricalcola solo l'eta' scelta.
- L'eta' scelta dal cursore e' `fire.retireAge` (vuota = eta' stimata).
- Zone di riuscita (`T.FIRE_ZONES`): sotto 50% non regge, 50-75% da rivedere, 75-85% ragionevole, 85-95% solido, da 95% molto probabile.
- Numero FIRE = spesa annua / tasso di prelievo.
- Nella schermata Budget l'effetto del budget si misura con due simulazioni rapide: abitudini di oggi contro budget.

## Test

- `node tests/unit.js`: date, importi, CSV, Revolut CSV, CSV generico, classificazione, regole, riga PDF UBS, statistiche, FIRE, backup.
- `node tests/lingue.js docs/index.html [backup.json]`: tutte le schermate in tedesco e inglese, frasi rimaste in italiano, cambio lingua dei dati, mesi e date.
- `node tests/qr.js docs/index.html`: tabelle della norma QR (capacita', blocchi, allineamento, formato, versione) e lettura completa delle matrici generate con un decodificatore indipendente.
- `node tests/famiglia.js docs/index.html [backup.json]`: due telefoni con l'app vera (contesti separati), ponte vero con KV simulato. Copre creazione, cifratura, QR, ingresso, modifiche incrociate e conflitti, scritture concorrenti sul ponte (409), regole, ruoli FIRE e profilo, Revolut condiviso, cambio chiave, uscita, Ricomincia da zero.
- `node tests/ponte.mjs`: ponte con Enable Banking simulato (firma JWT verificata, chiavi PKCS#8 e PKCS#1, CORS, token, percorsi rifiutati, nessun accesso ai pagamenti).
- `node tests/collegamento.js docs/index.html [backup.json]`: app + ponte reale + banca simulata. Copre verifica, consenso, ritorno, primo aggiornamento senza doppioni con l'estratto, movimenti in sospeso, limiti dell'aggiornamento automatico, avvisi di scadenza ed errori.
- `node tests/smoke.js docs/index.html [estratto-revolut.xlsx] [pagamenti-ubs.pdf]`: configurazione guidata, dati di esempio, tutte le schermate, settimana giorno per giorno con pannello del giorno e della settimana, scheda FIRE della Home, cursore dell'eta' e grafici FIRE da toccare, modifica movimento con regola, budget, FIRE, impostazioni, backup e ripristino, import reali facoltativi, CSV generico. Segnala anche gli errori JavaScript.
- I file reali si passano solo da riga di comando e non vanno mai nel repository (vedi `.gitignore`).

## Famiglia (13-family.js, 26-famiglia.js, ponte /family)

- **Chiavi:** chi crea la famiglia genera un identificativo (18 byte) e una chiave AES-256 (32 byte). Il QR contiene `#famiglia=` + base64url di `[1, id, chiave, indirizzo del ponte, APP_TOKEN, nome]`. Il frammento dopo `#` non arriva mai al server di GitHub e l'app lo toglie subito dalla barra degli indirizzi.
- **Copia condivisa:** movimenti, regole, categorie, vacanze, costi fissi, import, profili CSV, budget, FIRE, profilo (nome, valuta, reddito, cambi), collegamento Revolut (ponte, sessione, conti, ultimo aggiornamento, cursori) e l'elenco dei telefoni. Restano locali lingua, interfaccia, base dell'allineamento e chiavi.
- **Cifratura:** JSON compresso gzip, AES-GCM con IV casuale e l'identificativo della famiglia come dato associato. Formato `v1.g.<iv>.<dati>`. Il ponte rifiuta tutto cio' che non ha questo formato.
- **Ponte:** `POST /family` con `op` get/put/delete. Un valore KV per famiglia con numero di versione; put solo sulla versione attuale (altrimenti 409, il telefono rilegge e riunisce). `have` evita di riscaricare se la versione non e' cambiata.
- **Unione a tre vie** (base = ultimo allineamento, salvata a parte con chiave `famBase`): voce per voce (movimenti per id, categorie per id, regole per esercente, vacanze per date e nome, ...). Se e' cambiato solo un lato vince quel lato; se sono cambiati tutti e due vince il telefono che allinea per ultimo. Le cancellazioni si propagano senza segnaposto grazie alla base.
- **Ruoli:** FIRE e profilo li prende sempre dal telefono di chi ha creato la famiglia; chi entra tiene in locale solo `fire.retireAge` (il cursore). Le schermate FIRE e Profilo sono in sola lettura per chi entra; il collegamento Revolut si aggiorna ma non si rinnova ne' si scollega.
- **Revolut:** `lastSync` e i cursori sono condivisi (vince il piu' recente), cosi' un telefono non riscarica se l'altro l'ha appena fatto (limite PSD2 di circa 4 accessi al giorno senza l'utente presente).
- **Quando si allinea:** all'apertura (prima di Revolut), 5 secondi dopo ogni salvataggio, dopo un aggiornamento Revolut e ogni 3 minuti con l'app aperta. Se un foglio e' aperto o stai scrivendo, aspetta (fino a 30 secondi) per non cambiare i dati sotto le dita.
- **Sicurezza:** "Cambia la chiave" crea una nuova famiglia con i dati attuali e cancella la vecchia copia. Il backup non contiene la famiglia.

## Ricomincia da zero

Propone il backup, permette di tenere ponte e consenso Revolut (i movimenti degli ultimi 90 giorni si riscaricano), altrimenti revoca il consenso. Scioglie la famiglia (chi l'ha creata) o ne esce (chi c'e' entrato). Cancella l'archivio, la base della famiglia, il database con il vecchio nome `traguardo` e le copie in localStorage, poi riparte dalla configurazione iniziale.

## Migrazione 1.4

Una volta sola (`meta.v14`): la soglia di probabilita' passa da 85% a 90% se era rimasta quella predefinita, e i colori delle categorie che erano nella vecchia tavolozza passano alla tavolozza Bosco nella stessa posizione (`T.PALETTE_OLD` -> `T.PALETTE`).

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
