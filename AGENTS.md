# AGENTS.md: myFinances on FIRE

Istruzioni per agenti di programmazione (GitHub Copilot, Copilot cloud agent e simili). Le regole complete sono in [.github/copilot-instructions.md](.github/copilot-instructions.md); la conoscenza del progetto è in [conoscenza/](conoscenza/README.md) e [PROGETTO.md](PROGETTO.md).

## Comandi

| Cosa | Comando |
|---|---|
| Build (scrive `docs/`) | `npm run build` (oppure `python3 build.py`; su Windows `python build.py`) |
| Tutti i test | `npm test`, cioè `node tests/tutti.js` (Node 20+, Python 3) |
| Testi senza traduzione | `npm run traduzioni` (deve stampare `[]`) |
| Provare l'app nel browser | `npm run serve` e aprire http://localhost:8080 |

Non ci sono dipendenze da installare: niente `npm install`. Gli script di `package.json` scelgono da soli `python` (Windows) o `python3`.

## Regole essenziali

1. Modifica `src/`, mai `docs/` (è generata).
2. Nessun dato personale, token o chiave nel repository: è pubblico.
3. Ogni testo visibile: `T.tr("italiano")` più le traduzioni EN e DE in `src/js/03-dict.js`.
4. Niente librerie o CDN nell'app web.
5. Lo stato salvato resta compatibile: default in `T.newState()` / `T.FIRE_DEFAULTS`, conversioni in `T.migrate()`.
6. `ponte/worker.js` resta in sola lettura e non restituisce mai segreti all'app; aggiorna `VERSION` e `tests/ponte.mjs`.
7. Prima di chiudere un lavoro: `node tests/tutti.js` tutto verde, e un test nuovo per ogni funzione nuova.
8. Rispondi a Marco in italiano, con passi semplici.

## Struttura

- `src/js/` contiene i moduli. L'ordine di concatenazione è in `build.py`.
- `src/styles.css` è lo stile Bosco, con tema chiaro e scuro.
- `src/static/` contiene manifest, service worker, icone e pagine privacy e termini.
- `src/fonts/` contiene il carattere Rubik (OFL).
- `ponte/worker.js` è il Cloudflare Worker: Enable Banking, famiglia (KV) e Interactive Brokers (Flex).
- `tests/` contiene i test in Node con un DOM minimo (`dom-stub.js`) e le fixture inventate.
- `conoscenza/` contiene storia, decisioni, integrazioni, trappole e roadmap verso l'app nativa.
