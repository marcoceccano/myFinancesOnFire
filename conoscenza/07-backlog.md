# Backlog e questioni aperte

## Questioni aperte (risposte di Marco del 9 novembre 2026)

1. **Reddito netto mensile.** Marco lo inserisce a mano nell'app (Altro > Profilo e reddito). Chiuso.
2. **Revolut automatico.** Funziona. Chiuso.
3. **Interactive Brokers.** La Flex Query funziona. Il grafico del valore nel tempo non mostrava nulla cambiando orizzonte: corretto nella 1.9 (date del report in tutti i formati, storico ripulito, riga "Storico: N giorni" sotto il grafico). Da confermare con il report vero di Marco.
4. **Ponte.** Marco non sapeva se fosse alla 1.2.0. Dalla 1.9 "Verifica il ponte" mostra la versione e dice se va aggiornato.

## Idee e richieste non ancora fatte

**Dall'Excel "Life Planning"** (la richiesta iniziale, non ancora portata nell'app):
- progressione dello **stipendio** negli anni e **peso delle tasse** sul lordo;
- **net worth** nel tempo (patrimonio totale: conti, 3a, 2° pilastro, Interactive Brokers, azioni del datore di lavoro);
- **vesting delle azioni** del datore di lavoro, nel patrimonio e nel FIRE;
- **spese per anno** (progressione), oltre al periodo libero già presente.

**FIRE** (dal simulatore HTML v15, non tutto è nell'app):
- spesa **base e flessibile** (75/25) con i guardrail;
- **riserva di liquidità** di 2 anni;
- **acquisto della casa** a una certa data;
- orizzonte legato all'età della moglie (fino ai suoi 100 anni);
- capitale residuo minimo desiderato;
- rendite con indicizzazione parziale, imposte sulle sole plusvalenze, ritiro del 2° pilastro a età variabile;
- dopo il FIRE in Italia: spese in EUR, fiscalità diversa.

**App:**
- notifiche: budget settimanale superato, token o consenso in scadenza (con l'app nativa);
- blocco con impronta (con l'app nativa);
- "Condividi" un estratto dall'app della banca verso myFinances (Web Share Target o nativo);
- altre banche europee con Enable Banking (il ponte è già generico; serve la scelta della banca nell'app);
- francese per la Svizzera romanda (nuovo blocco nel dizionario);
- budget per persona dentro la famiglia (chi ha speso cosa), se richiesto;
- export CSV o Excel delle spese per il commercialista o per l'Excel personale;
- aggiornamento del ponte con `wrangler deploy` invece del copia e incolla.

## Debito tecnico

- `03-dict.js` è un unico file grande (circa 950 voci per lingua). Si potrebbe dividere per lingua, mantenendo lo stesso formato.
- Alcune schermate (`24-altro.js`, `27-portafoglio.js`) sono lunghe: dividerle per sottoschermata quando servirà toccarle.
- I test girano su un DOM finto. Un controllo nel browser vero (per esempio Playwright, solo come strumento di sviluppo e fuori da `src/`) darebbe più sicurezza su layout e grafici. Va proposto a Marco prima di aggiungere dipendenze.
- Privacy: nella 1.9 è stata tolta dal dizionario la traduzione di un costo fisso con un nome di luogo, e i costi fissi "Affitto casa ..." diventano "Affitto". Le versioni vecchie restano nella cronologia del repository: ripulirla solo se Marco lo chiede.
