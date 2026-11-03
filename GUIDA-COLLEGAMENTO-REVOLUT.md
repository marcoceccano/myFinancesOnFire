# Collegamento automatico con Revolut: guida passo passo

Alla fine di questa guida i movimenti Revolut arrivano da soli in myFinances on FIRE, in sola lettura. Serve circa un'ora, una volta sola.

## Come funziona

```
Revolut  ->  Enable Banking  ->  il tuo ponte (Cloudflare)  ->  app sul telefono
```

- **Enable Banking** e' un servizio autorizzato di open banking. Legge i movimenti dopo che tu dai il consenso nell'app Revolut.
- **Il ponte** e' un piccolo programma tuo, gratuito, su Cloudflare. Conserva la chiave di Enable Banking, che non puo' stare nell'app pubblica su GitHub. Risponde solo alla tua app e non salva i movimenti.
- **L'app** chiede i movimenti nuovi quando la apri (al massimo ogni 4 ore) o quando tocchi il pulsante di aggiornamento in alto.

Nessuno puo' fare pagamenti con questo collegamento: e' solo lettura.

## Cosa ti serve

- Il PC per i passi 1-3, il telefono con l'app Revolut per i passi 4-5.
- Un'email **personale** (non quella di lavoro) per Enable Banking e Cloudflare.
- La cartella del progetto `myfinances-on-fire` di questo pacchetto.

Gli indirizzi qui sotto usano il tuo repository: `https://marcoceccano.github.io/myFinancesOnFire/`. Se il tuo e' diverso, usa il tuo, uguale carattere per carattere (maiuscole e barra finale comprese).

---

## Passo 1 · Aggiorna l'app su GitHub (PC, 5 minuti)

1. Apri il repository `myFinancesOnFire` su github.com.
2. **Add file > Upload files**.
3. Apri la cartella `myfinances-on-fire` sul PC, seleziona tutto il contenuto (Ctrl+A) e trascinalo nella pagina. I file con lo stesso nome vengono sostituiti.
4. **Commit changes** e aspetta 1-2 minuti.
5. Controlla che si aprano:
   - `https://marcoceccano.github.io/myFinancesOnFire/privacy.html`
   - `https://marcoceccano.github.io/myFinancesOnFire/terms.html`

Sul telefono l'app si aggiorna da sola alla prima apertura con rete; se non vedi le novita', chiudila e riaprila.

## Passo 2 · Enable Banking (PC, 15 minuti)

### 2a. Crea l'account
1. Vai su `https://enablebanking.com/sign-in/`, inserisci la tua email personale e apri il link che ricevi.
2. Nel menu in alto apri **API applications**.

### 2b. Registra l'applicazione
Compila **Add a new application** cosi':

| Campo | Cosa scrivere |
|---|---|
| Environment | **Production** (non Sandbox) |
| Private key | lascia **Generate in the browser (using SubtleCrypto) and export private key** |
| Application name | `myFinances on FIRE` |
| Allowed redirect URLs | `https://marcoceccano.github.io/myFinancesOnFire/` |
| Application description | `Budget personale: lettura dei miei movimenti Revolut` |
| Email for data protection matters | la tua email personale |
| Privacy URL | `https://marcoceccano.github.io/myFinancesOnFire/privacy.html` |
| Terms URL | `https://marcoceccano.github.io/myFinancesOnFire/terms.html` |

Premi **Register**. Il browser scarica un file tipo `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pem`:
- il **nome del file** (senza `.pem`) e' l'**ID dell'applicazione**;
- il **contenuto** e' la **chiave privata**. Tienila al sicuro, non caricarla mai su GitHub e non mandarla a nessuno.

### 2c. Attiva l'applicazione con il tuo conto
L'applicazione appena creata e' **Inactive**. Per usarla gratis con i tuoi conti:
1. Sulla scheda dell'applicazione premi **Activate by linking accounts**.
2. Scegli il paese e **Revolut**. Per un conto con IBAN che inizia con LT scegli **Lithuania**.
3. Autorizza nell'app Revolut (sul telefono arriva la richiesta di conferma).
4. Seleziona tutti i conti in valuta che usi (CHF, EUR, ...).

Lo stato diventa **Active** (modalita' ristretta: funziona solo con i conti che hai collegato tu, che e' proprio quello che serve).

## Passo 3 · Il ponte su Cloudflare (PC, 15 minuti)

### 3a. Crea il Worker
1. Crea un account gratuito su `https://dash.cloudflare.com/sign-up` con l'email personale.
2. Nel menu a sinistra apri **Workers & Pages** (o **Compute > Workers**) e premi **Create**.
3. Scegli **Start with Hello World!**, dai il nome `myfinances-ponte` e premi **Deploy**. La prima volta Cloudflare ti fa scegliere un sottodominio `workers.dev`: va bene qualsiasi nome.
4. Premi **Edit code**, cancella tutto il codice di esempio e incolla il contenuto del file `ponte/worker.js` del progetto. Premi **Deploy**.
5. Annota l'indirizzo del Worker, tipo `https://myfinances-ponte.TUONOME.workers.dev`.

### 3b. Imposta le variabili
Nel Worker apri **Settings > Variables and Secrets** e aggiungi, una per una (**Add**, poi **Deploy** alla fine):

| Nome | Tipo | Valore |
|---|---|---|
| `EB_APP_ID` | Text | l'ID dell'applicazione (nome del file .pem senza estensione) |
| `EB_PRIVATE_KEY` | **Secret** | tutto il contenuto del file .pem, comprese le righe `-----BEGIN ...-----` e `-----END ...-----` (aprilo con Blocco note) |
| `ALLOWED_ORIGIN` | Text | `https://marcoceccano.github.io` (senza barra finale) |
| `REDIRECT_URL` | Text | `https://marcoceccano.github.io/myFinancesOnFire/` |

`APP_TOKEN` lo aggiungi al passo 4 dal telefono.

### 3c. Controlla
Apri l'indirizzo del Worker nel browser. Deve comparire una riga tipo:
`{"ok":false,"service":"myfinances-ponte","version":"1.0.0","missing":["APP_TOKEN"]}`
Manca solo `APP_TOKEN`: e' giusto, lo aggiungi ora.

## Passo 4 · Il codice di accesso (telefono, 5 minuti)

Il codice di accesso e' la "password" tra l'app e il ponte. Lo generi sul telefono, cosi' non passa da altre parti.

1. Apri myFinances on FIRE sul telefono: **Altro > Collegamento automatico Revolut**.
2. Al punto **2 · Il tuo ponte** premi **Genera**, poi **Copia il codice**.
3. Nello stesso punto incolla l'indirizzo del Worker (quello del passo 3a).
4. Sempre dal telefono apri `https://dash.cloudflare.com` nel browser, entra nel Worker `myfinances-ponte` > **Settings > Variables and Secrets** > **Add**:
   - nome `APP_TOKEN`, tipo **Secret**, valore: incolla il codice. Premi **Deploy**.
5. Torna nell'app e premi **Verifica il ponte**. Devono comparire tutte spunte verdi:
   - ponte raggiungibile e codice corretto;
   - applicazione Enable Banking in produzione e attiva;
   - indirizzo di ritorno corretto.

Se qualcosa e' rosso, il messaggio dice cosa correggere (vedi anche la tabella in fondo).

## Passo 5 · Collega Revolut (telefono, 2 minuti)

1. Al punto **3 · Collega Revolut** lascia **Lituania** e premi **Collega Revolut**.
2. Si apre Enable Banking e poi l'app Revolut: conferma l'accesso in sola lettura e seleziona i conti.
3. Torni nell'app, che scarica i movimenti degli ultimi giorni. Quelli gia' importati con l'estratto vengono riconosciuti e non si duplicano.

Se alla fine ti trovi in una scheda di Chrome invece che nell'app installata, chiudi la scheda e riapri l'app: trova il collegamento gia' fatto.

---

## Uso di tutti i giorni

- I movimenti si aggiornano quando apri l'app (al massimo ogni 4 ore) o con il pulsante di aggiornamento in alto.
- I pagamenti con carta ancora **in sospeso** compaiono subito e contano nel budget della settimana; quando diventano definitivi vengono sostituiti, senza doppioni.
- Il consenso dura circa 6 mesi (dipende da Revolut). Due settimane prima della scadenza la Home mostra **Rinnova il collegamento Revolut**: due tocchi nell'app Revolut.
- I conti in EUR e USD vengono convertiti con i cambi di **Altro > Profilo e reddito**. Aggiornali ogni tanto.
- L'import dell'estratto conto resta disponibile e non crea doppioni con i movimenti scaricati.

## Problemi frequenti

| Messaggio | Cosa fare |
|---|---|
| Il ponte non risponde | Controlla l'indirizzo del Worker (deve iniziare con `https://`) e la connessione. |
| Il codice di accesso non corrisponde (APP_TOKEN) | Copia di nuovo il codice dall'app e reimpostalo in Cloudflare come Secret, poi Deploy. |
| Il ponte non accetta richieste da questo indirizzo (ALLOWED_ORIGIN) | `ALLOWED_ORIGIN` deve essere esattamente `https://marcoceccano.github.io`, senza barra finale. |
| Indirizzo di ritorno non corretto | Lo stesso indirizzo deve comparire nell'app (punto 1), in `REDIRECT_URL` e negli Allowed redirect URLs di Enable Banking. |
| Applicazione non ancora attiva | Enable Banking: **Activate by linking accounts** sulla scheda dell'applicazione (passo 2c). |
| Enable Banking non riconosce la firma | `EB_APP_ID` deve essere il nome del file .pem e `EB_PRIVATE_KEY` il suo contenuto completo. |
| Nessun conto autorizzato | Collega gli stessi conti anche nel Control Panel di Enable Banking (passo 2c) e riprova. |
| Revolut non e' disponibile per il paese scelto | Prova **Svizzera** o **Italia** al punto 3. |
| Consenso scaduto o revocato | Home o Altro > Collegamento: **Ricollega Revolut**. |

## Sicurezza

- **Su GitHub** c'e' solo codice: niente chiavi, niente codici, niente movimenti. Il file `.gitignore` blocca i file `.pem`.
- **La chiave privata** e' solo nel file .pem sul tuo PC e nel ponte (come Secret). Puoi cancellare il file dopo averlo copiato in Cloudflare, oppure conservarlo in un posto sicuro.
- **Il codice di accesso** e' sull'app e nel ponte. Se perdi il telefono: in Cloudflare cambia `APP_TOKEN` con un valore qualsiasi e revoca l'accesso di Enable Banking dalle impostazioni di Revolut sulle app collegate.
- **Il backup** dell'app contiene anche indirizzo del ponte e codice di accesso: tienilo privato come gia' fai.
- **Il ponte** non salva movimenti e non puo' fare pagamenti: espone solo consenso, stato e lettura.
- **Limiti di Cloudflare** (piano gratuito: 100'000 richieste al giorno) e di Enable Banking (modalita' ristretta gratuita, solo i tuoi conti): per l'uso personale non li raggiungerai. Se Enable Banking un giorno cambiasse le condizioni, l'import dell'estratto conto continua a funzionare.
