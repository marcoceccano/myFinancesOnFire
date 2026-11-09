# Da PWA ad app nativa

Situazione al 9 novembre 2026, da riverificare quando si parte: store e strumenti cambiano spesso.

## Da dove si parte

- L'app è già una **PWA installabile**: Chrome su Android aggiunge l'icona e la apre a tutto schermo. Funziona offline e salva i dati in IndexedDB, che è legato all'**origine** `https://marcoceccano.github.io`.
- Gli utenti oggi sono **due telefoni Android**, Marco e la moglie, legati dalla famiglia (QR). Non serve iOS, per ora.
- Tutto il codice è web senza dipendenze, in un unico `docs/index.html` generato da `src/`.

## Cosa può dare un'app nativa in più

| Funzione | Interesse | Note |
|---|---|---|
| Presenza nel Play Store | Medio: Marco vuole che "diventi un'app", magari pubblicabile | Per un account personale nuovo serve un test chiuso: almeno 12 tester per 14 giorni consecutivi prima della produzione (vedi sotto) |
| Blocco con impronta o volto | Alto: ci sono dati finanziari | Plugin biometrico |
| Segreti nel portachiavi del telefono (APP_TOKEN, chiave della famiglia) | Alto | Oggi sono in IndexedDB |
| Notifiche locali (budget superato, token Interactive Brokers in scadenza, consenso Revolut in scadenza) | Alto | |
| "Condividi" un estratto dall'app della banca verso l'app | Medio | Web Share Target esiste anche per la PWA |
| Widget nella schermata Home (budget della settimana) | Medio | Richiede codice nativo (Kotlin) |
| Aggiornamento in sottofondo (Revolut, Interactive Brokers) | Basso | Android lo limita molto, e c'è il limite PSD2 |

## Opzioni

### A. Trusted Web Activity (Bubblewrap o PWABuilder)

L'app Android apre la PWA pubblicata dentro Chrome, a tutto schermo.

- **Pro:**
  - è lo stesso codice e si aggiorna pubblicando il sito, senza un rilascio sullo store;
  - il pacchetto si genera in un'ora;
  - i dati restano quelli di Chrome per la stessa origine.
- **Contro:**
  - nessuna funzione nativa vera: niente impronta, notifiche locali affidabili o widget;
  - per togliere la barra dell'indirizzo serve il file **Digital Asset Links** alla **radice del dominio** (`https://<dominio>/.well-known/assetlinks.json`). Con GitHub Pages "di progetto" (`marcoceccano.github.io/myFinancesOnFire/`) la radice è `marcoceccano.github.io`: serve il repository `marcoceccano.github.io` oppure un dominio personale.

### B. Capacitor (consigliata)

Il codice web va dentro l'app (WebView), più plugin nativi. La versione stabile al momento della stesura è la 8.5.x; la 9 è in alpha.

- **Pro:**
  - stessa base di codice (`src/` e `build.py` generano i file web, Capacitor li impacchetta);
  - funziona offline senza service worker;
  - ci sono plugin per impronta, archivio sicuro, notifiche locali, file, condivisione e collegamenti diretti;
  - più avanti si può fare iOS con lo stesso progetto (serve un Mac e l'account Apple Developer a pagamento).
- **Contro:**
  - ogni aggiornamento è un nuovo pacchetto Android;
  - serve Android Studio (JDK, Gradle) e una chiave di firma da conservare;
  - entrano dipendenze npm, ma solo nella cartella `app/`: `src/` resta senza dipendenze.

### C. Riscrittura (Kotlin, Flutter, React Native)

- **Pro:** è tutta nativa.
- **Contro:** è come rifare l'app, si perde il codice e i test di oggi. **Sconsigliata.**

## Raccomandazione

**Capacitor per Android**, a tappe, con la PWA che resta attiva in parallelo.

Se Marco vuole solo "l'icona dallo store" il prima possibile, la TWA (opzione A) è un ripiego valido. Le serve comunque il dominio sistemato (tappa 1).

## Piano a tappe

1. **Preparazione nella PWA, senza cambiare cosa vede l'utente.**
   - Uno strato `T.platform` (`src/js`) che dice se l'app gira nel browser o in Capacitor e offre funzioni con un'alternativa web: archivio sicuro, notifiche, condivisione, apertura dei collegamenti.
   - Nel ponte, `ALLOWED_ORIGIN` accetta già più origini separate da virgola. Prevedi anche più `REDIRECT_URL` consentiti: elenco nel ponte, scelta da parte dell'app solo tra quelli consentiti, test in `ponte.mjs`.
   - Il service worker non va registrato dentro Capacitor.
2. **Dominio.** Scegli se creare il repository `marcoceccano.github.io` (gratis) o comprare un dominio. Serve per `assetlinks.json` (App Links verificati) e per l'indirizzo di ritorno di Enable Banking.
3. **Progetto Capacitor** in `app/`, con il suo `package.json`:
   - `webDir` punta ai file generati da `build.py`;
   - package id, per esempio `ch.myfinancesonfire.app` (da decidere con Marco);
   - icone e splash dallo stile Bosco;
   - il pacchetto di debug va installato sul telefono di Marco.
4. **Rete e collegamenti.**
   - L'origine della WebView Android è `https://localhost`: va aggiunta ad `ALLOWED_ORIGIN` nel ponte.
   - Ritorno dal consenso Revolut: Enable Banking vuole un indirizzo https. Usa un **App Link** (`https://<dominio>/myFinancesOnFire/?code=...` apre l'app grazie all'intent filter e ad `assetlinks.json`). In alternativa la pagina web passa il codice all'app con uno schema `myfinances://`.
   - Aggiungi l'indirizzo agli "Allowed redirect URLs" di Enable Banking.
5. **Passaggio dei dati.** L'app nativa ha un archivio nuovo e vuoto. Il passaggio si fa con il QR della famiglia: l'app entra nella famiglia e scarica tutto. In alternativa, con backup e ripristino. Va spiegato bene nel primo avvio ("Vieni dalla versione web?").
6. **Funzioni native, una alla volta:** blocco con impronta; segreti nell'archivio sicuro; notifiche locali (budget, scadenze); condivisione di file verso l'app; widget (facoltativo, Kotlin).
7. **Distribuzione.**
   - **Uso personale:** il pacchetto firmato si installa a mano sui due telefoni (sideload). Non servono né lo store né i 12 tester.
   - **Play Store:**
     - account sviluppatore (25 USD una tantum);
     - Android App Bundle con Play App Signing;
     - livello API recente: da fine agosto 2026 le fonti indicano Android 16, API 36, da verificare in Play Console;
     - informativa privacy (`privacy.html`) e modulo "Sicurezza dei dati".
     - Per gli account **personali** creati dopo il 13.11.2023 serve un **test chiuso con almeno 12 tester per 14 giorni consecutivi** prima di chiedere l'accesso alla produzione. Gli account organizzazione ne sono esenti.
8. **Pulizia.** Quando tutti usano l'app nativa, la PWA può restare come versione web oppure portare all'app con un avviso.

## Rischi e attenzioni

- **Dati.** Il cambio di origine o di app non deve far perdere nulla. Prima di ogni passaggio: backup, poi verifica del ripristino.
- **Famiglia.** Telefoni con versioni diverse (PWA e nativa) devono continuare ad allinearsi: il formato della copia condivisa resta lo stesso.
- **Segreti.** La chiave di firma Android e l'eventuale `keystore` non entrano mai nel repository (aggiungili al `.gitignore`).
- **Privacy.** Aggiorna `privacy.html` e il modulo del Play Store. Il ponte è dell'utente, non dello sviluppatore, ma va spiegato quali dati passano: movimenti, report e copia cifrata.
