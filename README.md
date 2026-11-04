# myFinances on FIRE

App per il telefono che mette insieme tre cose:

- **Budget settimanale**: quanto avete speso questa settimana rispetto al tetto, quanto resta al giorno e, giorno per giorno, dove avete speso (tocca un giorno per il dettaglio).
- **Spese**: mese per mese, per categoria, per esercente, con la possibilita' di correggere le categorie.
- **FIRE**: simulatore Monte Carlo che usa le vostre spese reali e vi dice a che eta' potete smettere. Con il cursore scegli l'eta' e vedi subito la probabilita' di riuscita.

Disponibile in italiano, inglese e tedesco. I dati restano sul telefono. L'app non ha server, account o statistiche: e' solo un insieme di file che il browser scarica e poi usa anche offline.

## Novita' della 1.5

- **Famiglia:** condividi spese, categorie, budget e collegamento Revolut con un altro telefono. L'altro telefono inquadra un QR e vede subito gli stessi dati; le modifiche si allineano da sole. FIRE e reddito li gestisce chi crea la famiglia. I dati passano dal tuo ponte gia' cifrati. Guida: `GUIDA-FAMIGLIA.md`.
- **Ricomincia da zero** (Altro): propone prima il backup, chiede se tenere il ponte e il collegamento Revolut, cancella tutto (anche i dati salvati con il vecchio nome) e riparte dalla configurazione iniziale.
- **Ponte 1.1.0:** custodisce la copia cifrata della famiglia (serve uno spazio Workers KV chiamato `FAMIGLIA`).

## Novita' della 1.4

- **Home:** al posto delle ultime 8 settimane c'e' la settimana giorno per giorno, divisa per categoria, con il tetto giornaliero. Tocca un giorno per vedere categorie e movimenti.
- **Spese:** le ultime 8 settimane sono qui. Tocca una settimana per vederla giorno per giorno.
- **FIRE:** cursore dell'eta' in cui smetti, indicatore della probabilita' di riuscita con 5 fasce, 4 riquadri (prima eta' al 90%, arrivo mediano, spesa media in pensione, capitale residuo), grafici da toccare. La soglia predefinita e' il 90%.
- **Aspetto:** stile Bosco (crema, verde bosco, ocra, terracotta), carattere Rubik incluso nell'app, tema scuro, nuova icona. I colori delle categorie esistenti passano alla nuova tavolozza se non li avevi cambiati.

## Cosa c'e' in questa cartella

| Cartella o file | A cosa serve |
|---|---|
| `ponte/worker.js` | Il ponte per il collegamento automatico con Revolut (Cloudflare Worker). Vedi `GUIDA-COLLEGAMENTO-REVOLUT.md`. |
| `GUIDA-COLLEGAMENTO-REVOLUT.md` | Guida passo passo per far arrivare i movimenti Revolut da soli. |
| `GUIDA-FAMIGLIA.md` | Guida per condividere l'app con un altro telefono (spazio KV nel ponte, QR, sicurezza). |
| `docs/` | **L'app pronta da pubblicare.** E' quella che va online (il nome `docs` lo richiede GitHub Pages). |
| `src/` | Il codice sorgente, diviso in moduli leggibili. |
| `build.py` | Ricostruisce `docs/` da `src/`: `python3 build.py`. Nessuna libreria da installare. |
| `tests/` | Test automatici: `node tests/unit.js`, `node tests/smoke.js docs/index.html`, `node tests/ponte.mjs`, `node tests/collegamento.js docs/index.html`, `node tests/lingue.js docs/index.html`, `node tests/qr.js docs/index.html`, `node tests/famiglia.js docs/index.html`. |
| `PROGETTO.md` | Come e' fatta l'app: architettura, dati, regole, scelte. Da dare a chi continua lo sviluppo. |
| `PRIVACY.md` | Informativa sulla privacy (pubblicata anche in `docs/privacy.html`). |
| `.gitignore` | Impedisce di caricare per sbaglio backup ed estratti conto nel repository. |

Il file con i tuoi dati personali **non** e' in questa cartella e non deve mai entrarci.

## Provarla subito sul computer

Apri `docs/index.html` con Chrome o Edge. Funziona tutto tranne l'uso offline, che richiede la pubblicazione su un indirizzo https.

## Pubblicarla e installarla sul telefono (circa 10 minuti)

1. Crea un account su github.com con la tua email **personale**, non quella di lavoro.
2. Crea un nuovo repository, per esempio `myfinances-on-fire`, di tipo **Public** (GitHub Pages gratuito richiede un repository pubblico; contiene solo codice, nessun dato).
3. Nel repository: **Add file > Upload files**, trascina tutto il contenuto di questa cartella, poi **Commit changes**.
4. **Settings > Pages**: in *Build and deployment* scegli *Deploy from a branch*, ramo `main`, cartella `/docs`, **Save**.
5. Dopo un paio di minuti l'app e' su `https://TUO-UTENTE.github.io/myfinances-on-fire/`.
6. Sul telefono apri quell'indirizzo con Chrome, menu in alto a destra, **Installa app** (o *Aggiungi a schermata Home*).

## Caricare i tuoi dati

1. Copia sul telefono il file di backup personale (per esempio scaricandolo dall'app OneDrive).
2. Apri myFinances on FIRE, tocca **Ho gia' un backup** e scegli il file.

## Collegamento automatico con Revolut

I movimenti possono arrivare da soli, in sola lettura, tramite Enable Banking e un piccolo ponte tuo su Cloudflare (gratuiti). La guida completa e' in `GUIDA-COLLEGAMENTO-REVOLUT.md`.

## La routine mensile

1. Revolut (solo se non usi il collegamento automatico): estratto conto in Excel o CSV del periodo, poi nell'app l'icona di import in alto. I movimenti gia' presenti vengono riconosciuti e saltati.
2. UBS, solo quando cambia qualcosa: PDF dei pagamenti registrati, stesso pulsante. Aggiorna i costi fissi.
3. **Altro > Backup > Crea backup** e salva il file nel tuo cloud personale.

Le categorie si correggono toccando un movimento: con *Vale anche per gli altri movimenti* la correzione diventa una regola per tutti gli import futuri.

## Aggiornare l'app

Modifica i file in `src/`, esegui `python3 build.py`, carica di nuovo la cartella `docs/` su GitHub. Il telefono scarica la nuova versione alla prima apertura con rete; i dati restano.

## Un domani sul Play Store

L'app e' gia' pensata per essere pubblicata: nessun dato personale nel codice, configurazione guidata al primo avvio, dati di esempio, informativa privacy, icone e funzionamento offline.
I passaggi sono in fondo a `PROGETTO.md` (pacchetto Android con PWABuilder, account sviluppatore Google, verifica del dominio).
