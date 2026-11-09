# Integrazioni

## Panorama

```
Telefono (PWA, IndexedDB)  ──HTTPS + APP_TOKEN──>  Ponte personale (Cloudflare Worker)
                                                     ├─> Enable Banking API ──> Revolut (open banking, sola lettura)
                                                     ├─> Workers KV "FAMIGLIA" (copia cifrata della famiglia)
                                                     └─> Interactive Brokers Flex Web Service (report XML)
```

Il ponte serve a tre cose: tenere i segreti fuori dall'app pubblica, firmare le richieste a Enable Banking e superare il CORS. Il ponte non salva movimenti né report. Vedi `ponte/worker.js` e PROGETTO.md.

## Stato della configurazione di Marco (al 9 novembre 2026)

| Pezzo | Stato |
|---|---|
| App su GitHub Pages | Attiva, `https://marcoceccano.github.io/myFinancesOnFire/`, versione 1.8.0 (se Marco ha caricato l'ultima `docs`) |
| Enable Banking | Account registrato in **Production**, in **modalità ristretta**: attivata collegando il proprio conto Revolut dal Control Panel. |
| Ponte Cloudflare | Funzionante: "ponte verificato" il 03.11. Il KV `myfinances-famiglia` è collegato come `FAMIGLIA` e la verifica è riuscita il 04.11. Quando abbiamo lasciato Cowork doveva essere aggiornato al ponte **1.2.0** per Interactive Brokers. |
| Consenso Revolut (passo 3 dell'app) | **Non confermato** da Marco: chiedi se i movimenti arrivano da soli. |
| Famiglia | Configurata, con la moglie entrata con il QR (Android). |
| Interactive Brokers | Codice pronto (1.7 e 1.8). **Non confermato** che Marco abbia creato la Flex Query e inserito `IBKR_TOKEN` e `IBKR_QUERY_ID`. Il primo scaricamento reale non è mai stato visto: i test usano un report inventato. |

## Revolut con Enable Banking

- **API.** `https://api.enablebanking.com`, autenticazione con un JWT RS256 firmato dal ponte. Il JWT ha `kid` = EB_APP_ID, `iss` "enablebanking.com", `aud` "api.enablebanking.com" e dura al massimo 24 ore. Si tiene in memoria.
- **Flusso del consenso.**
  1. `/aspsps?country=LT&psu_type=personal&service=AIS`: cerca "Revolut".
  2. `POST /auth` con `access.valid_until`, `redirect_url` = REDIRECT_URL e uno `state` casuale generato dall'app. La durata chiesta è di 180 giorni, ridotta al massimo previsto dalla banca.
  3. L'utente conferma nell'app Revolut e torna all'app con `?code=&state=`.
  4. `POST /sessions {code}` restituisce la sessione e i conti. L'IBAN viene mascherato dal ponte.
- **Movimenti.**
  - Si leggono con `/accounts/{uid}/transactions` e si scorrono le pagine con `continuation_key`.
  - Si inviano le intestazioni PSU (IP, User-Agent e altre). Se la banca risponde con un errore PSU_HEADER, il ponte riprova senza.
  - Movimenti in sospeso (`PDNG`): sostituiti a ogni aggiornamento, conservando le modifiche fatte a mano.
  - L'id di un movimento è `hash("revolut-api|" + uid + "|" + transaction_id)`.
  - Doppioni con l'estratto importato: stessa valuta, stesso importo, date a meno di 3 giorni.
- **Aggiornamento automatico** all'apertura, al massimo ogni 4 ore. In famiglia `lastSync` è condiviso, così un telefono non riscarica se l'altro l'ha appena fatto (limite PSD2 di circa 4 accessi al giorno senza l'utente presente).
- **Variabili del ponte.** `EB_APP_ID`, `EB_PRIVATE_KEY` (PEM PKCS#8 o PKCS#1), `APP_TOKEN` (generato nell'app, almeno 24 caratteri), `ALLOWED_ORIGIN` = `https://marcoceccano.github.io`, `REDIRECT_URL` = `https://marcoceccano.github.io/myFinancesOnFire/`. Lo stesso indirizzo va negli "Allowed redirect URLs" di Enable Banking.
- Guida completa per l'utente: GUIDA-COLLEGAMENTO-REVOLUT.md.

## Famiglia (Workers KV)

- **Copia condivisa.** Una sola chiave KV `fam:<id>` con `{ver, at, data}`. `data` ha la forma `v1.g.<iv>.<cifrato>` (JSON gzip più AES-GCM 256, con l'id come dato associato).
- **Scritture.** Si scrive solo sulla versione attuale: se è cambiata nel frattempo, il ponte risponde 409 e il telefono rilegge, unisce e riprova.
- **QR.** Contiene `appUrl#famiglia=` + base64url di `[1, id, chiave, url del ponte, APP_TOKEN, nome]`. L'hash non arriva mai al server, e l'app lo legge e lo toglie subito, prima della navigazione.
- **Unione a tre vie** con la base dell'ultimo allineamento, salvata a parte nella chiave IndexedDB `famBase`. Dettagli in PROGETTO.md.
- **Costi.** Il piano gratuito di Cloudflare (100'000 letture e 1000 scritture al giorno, 1 GB) basta ampiamente.

## Interactive Brokers (Flex Web Service)

- **Chiamate.**
  - Prima `SendRequest?t=TOKEN&q=QUERY_ID&v=3`, che restituisce `ReferenceCode` e `Url`.
  - Poi `GetStatement?t=TOKEN&q=REF&v=3`, finché il report è pronto.
  - Si usa la versione 3, con l'intestazione `User-Agent` obbligatoria.
- **Limiti.** Al massimo 1 richiesta al secondo e 10 al minuto per token. Il ponte fa al massimo 6 tentativi di GetStatement ogni 3,5 secondi.
- **Codici di attesa** (si riprova): 1001, 1004-1009, 1019, 1021. **Errori** da spiegare:
  - 1012 token scaduto, 1015 token non valido;
  - 1014 query non valida, 1010 query di tipo vecchio;
  - 1013 restrizione IP, 1011 servizio non attivo;
  - 1018 e 1025 troppe richieste.
- **Token.** Scade (lo si sceglie alla generazione: per impostazione 6 ore, va presa la durata più lunga). Generarne uno nuovo invalida il precedente. L'app ricorda la scadenza (`portfolio.tokenUntil`) e avvisa 14 giorni prima.
- **Report richiesto.** Activity Flex Query in XML, ultimi 365 giorni, con le sezioni:
  - Account Information;
  - Open Positions (Summary);
  - Cash Report;
  - Net Asset Value in Base;
  - Cash Transactions (Dividends, Withholding Tax, Payment In Lieu Of Dividends, Deposits & Withdrawals).
- **Lettura** (`T.parseFlex`):
  - `OpenPosition` (solo il riepilogo se ci sono anche i lotti);
  - `CashReportCurrency` BASE_SUMMARY;
  - `EquitySummaryByReportDateInBase` (valore giorno per giorno);
  - `CashTransaction`.

  I valori sono convertiti con `fxRateToBase`. Storico, dividendi e versamenti si accumulano oltre i 365 giorni del report.
- **Da verificare con un report vero.** Nomi esatti dei tipi di CashTransaction, presenza di `subCategory="ETF"`, conti con più valute, formato delle date. Il report di prova `tests/fixtures/flex-esempio.xml` segue la documentazione pubblica ed esempi di altri progetti.

## Import di file

- **Revolut.** L'"estratto conto consolidato" in Excel è in realtà una sola colonna di righe CSV, con caratteri a doppia codifica (corretti da `T.fixMojibake` in 00-util), sezioni separate per valuta e una colonna con l'importo già convertito nella valuta base. È supportato anche il CSV dell'app Revolut.
- **UBS "Pagamenti registrati" (PDF).** Il PDF è cifrato RC4 o AES con password vuota e usa caratteri Type1 con codifica Differences. Il lettore è scritto da zero in `02-files.js`. Le righe diventano proposte di costi fissi.
- **CSV generico.** Riconosce le colonne e ricorda il profilo di ogni file per firma delle intestazioni.
- **xlsx.** Lettura zip e XML con `DecompressionStream`, senza librerie.
