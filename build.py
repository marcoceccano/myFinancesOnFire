#!/usr/bin/env python3
"""Costruisce l'app pubblicabile in docs/ (la cartella che GitHub Pages pubblica) a partire da src/.
Uso: python3 build.py   (nessuna dipendenza esterna)"""
import base64, datetime, hashlib, os, re, shutil
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, OUT = os.path.join(ROOT, "src"), os.path.join(ROOT, "docs")
ORDER = ["00-util", "08-market", "01-store", "02-files", "04-importers", "05-categorize", "06-stats", "07-fire", "12-bank", "09-demo",
         "10-dom", "11-charts", "20-app", "21-spese", "22-budget", "23-fire", "24-altro", "25-collega", "30-main"]
def read(p): return open(p, encoding="utf-8").read()
js = "\n".join(read(os.path.join(SRC, "js", n + ".js")) for n in ORDER)
css = read(os.path.join(SRC, "styles.css"))
fav = "data:image/png;base64," + base64.b64encode(open(os.path.join(SRC, "static", "icons", "icon-192.png"), "rb").read()).decode()
html = read(os.path.join(SRC, "index.template.html")).replace("__CSS__", css).replace("__JS__", js.replace("</script", "<\\/script")).replace("__FAVICON__", fav)
ver = hashlib.sha1(html.encode("utf-8")).hexdigest()[:10]
if os.path.exists(OUT): shutil.rmtree(OUT)
shutil.copytree(os.path.join(SRC, "static"), OUT)
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)
sw = read(os.path.join(OUT, "sw.js")).replace("__VERSION__", ver)
open(os.path.join(OUT, "sw.js"), "w", encoding="utf-8").write(sw)
for page in ("privacy.html", "terms.html"):
    pv = read(os.path.join(OUT, page)).replace("__DATE__", datetime.date.today().strftime("%d.%m.%Y"))
    open(os.path.join(OUT, page), "w", encoding="utf-8").write(pv)
print("docs/ pronta, versione cache", ver, "index.html", len(html) // 1024, "KB")
