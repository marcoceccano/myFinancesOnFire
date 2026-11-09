#!/usr/bin/env python3
"""Costruisce l'app pubblicabile in docs/ (la cartella che GitHub Pages pubblica) a partire da src/.
Uso: python3 build.py   (nessuna dipendenza esterna)"""
import base64, datetime, hashlib, os, re, shutil

# Data di "ultimo aggiornamento" di privacy e condizioni: cambiala solo quando cambia il testo di PRIVACY.md.
PRIVACY_DATE = "06.11.2026"
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, OUT = os.path.join(ROOT, "src"), os.path.join(ROOT, "docs")
ORDER = ["00-util", "03-dict", "03-i18n", "08-market", "01-store", "02-files", "04-importers", "05-categorize", "06-stats", "07-fire", "12-bank", "13-family", "14-qr", "15-ibkr", "09-demo",
         "10-dom", "11-charts", "20-app", "21-spese", "22-budget", "23-fire", "24-altro", "25-collega", "26-famiglia", "27-portafoglio", "30-main"]
def read(p): return open(p, encoding="utf-8").read()
js = "\n".join(read(os.path.join(SRC, "js", n + ".js")) for n in ORDER)
css = read(os.path.join(SRC, "styles.css"))
# carattere Rubik (licenza SIL OFL) incluso nella pagina: funziona offline e senza server esterni
def face(w):
    b = base64.b64encode(open(os.path.join(SRC, "fonts", "rubik-%d.woff" % w), "rb").read()).decode()
    return '@font-face{font-family:"MF Rubik";font-style:normal;font-weight:%d;font-display:swap;src:url(data:font/woff;base64,%s) format("woff")}' % (w, b)
css = css.replace("__FONTS__", face(400) + "\n" + face(700))
fav = "data:image/png;base64," + base64.b64encode(open(os.path.join(SRC, "static", "icons", "icon-192.png"), "rb").read()).decode()
html = read(os.path.join(SRC, "index.template.html")).replace("__CSS__", css).replace("__JS__", js.replace("</script", "<\\/script")).replace("__FAVICON__", fav)
ver = hashlib.sha1(html.encode("utf-8")).hexdigest()[:10]
if os.path.exists(OUT): shutil.rmtree(OUT, ignore_errors=True)
shutil.copytree(os.path.join(SRC, "static"), OUT, dirs_exist_ok=True)
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)
sw = read(os.path.join(OUT, "sw.js")).replace("__VERSION__", ver)
open(os.path.join(OUT, "sw.js"), "w", encoding="utf-8").write(sw)
for page in ("privacy.html", "terms.html"):
    pv = read(os.path.join(OUT, page)).replace("__DATE__", PRIVACY_DATE)
    open(os.path.join(OUT, page), "w", encoding="utf-8").write(pv)
print("docs/ pronta, versione cache", ver, "index.html", len(html) // 1024, "KB")
