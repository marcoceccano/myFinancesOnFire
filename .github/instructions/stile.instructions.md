---
applyTo: "src/styles.css,src/index.template.html,src/static/**"
---
# Stile "Bosco"

Marco ha scelto lo stile Bosco tra 4 proposte (v1.4). Voleva un aspetto meno "da app fatta con l'AI": niente blu generico.

**Colori**

| Ruolo | Colore |
|---|---|
| Sfondo | `#F3EEE4` |
| Schede | `#FFFDF8` |
| Testo | `#1F2B24` |
| Testo secondario | `#5F6B62` |
| Linee | `#E4DCCD` |
| Riempimenti | `#EEE7DA` |
| Verde bosco (brand, barra in alto) | `#2F5D46` |
| Verde secondario | `#3E7A5E` |
| Ocra | `#D99A2B` |
| Terracotta | `#C4623F` |

Le 5 zone della probabilità FIRE: `#C4623F`, `#D99A2B`, `#C8C27A`, `#8DB596`, `#2F5D46`.

**Carattere**
- Rubik 400 e 700, sottoinsieme latino, incluso come WOFF in base64 da `build.py` (`__FONTS__` in `styles.css`).
- I numeri sono tabellari.

**Forme**
- Angoli 20 px sulle schede, pulsanti a pillola, ombra morbida `0 2px 10px rgba(47,93,70,.08)`.

**Regole**
- Sempre le variabili CSS (`var(--brand)`, ecc.), mai colori fissi nei componenti. Fanno eccezione le tavolozze delle categorie e dei grafici, in `05-categorize.js` e `27-portafoglio.js`.
- Il tema scuro sta in `@media (prefers-color-scheme: dark)` (verde scuro e antracite). Ogni variabile nuova va definita in tutti e due i temi.
- Proprietà logiche (`inline-size`, `margin-block-start`, `inset-inline-start`).
- Aree toccabili di almeno 44 px.
- Se cambiano i colori del brand, aggiorna anche `theme-color` in `index.template.html`, il manifest, le icone in `src/static/icons` e le pagine `privacy.html` e `terms.html`.
