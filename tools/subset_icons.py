"""Genera un subconjunto de Material Symbols Outlined solo con los íconos que usa la app.

La fuente completa pesa ~4 MB; el subconjunto, unos pocos KB. Ejecutar tras agregar íconos:
    python tools/subset_icons.py
"""
import glob
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "node_modules/material-symbols/material-symbols-outlined.woff2"
OUT = ROOT / "public/fonts/material-symbols-outlined-subset.woff2"
# Íconos que se eligen dinámicamente en código (condicionales) además de los literales de las plantillas.
EXTRA = {"progress_activity", "print", "download", "visibility", "visibility_off", "description", "upload_file",
         "upload", "block", "verified", "cancel", "check", "send", "error", "close", "expand_more"}

names = set(EXTRA)
for f in glob.glob(str(ROOT / "src/app/**/*.*"), recursive=True):
    text = open(f, encoding="utf-8").read()
    names.update(re.findall(r"material-symbols-outlined[^>]*>\s*([a-z_0-9]+)\s*<", text))
    names.update(re.findall(r"icon: '([a-z_0-9]+)'", text))
    names.update(re.findall(r'icon="([a-z_0-9]+)"', text))
    names.update(re.findall(r"'([a-z_0-9]+)'", text))  # candidatos; los que no son íconos se ignoran

font = TTFont(SRC)
cmap = font.getBestCmap()
char_glyph = {chr(cp): g for cp, g in cmap.items()}
glyph_char = {g: ch for ch, g in char_glyph.items()}
ligs = {}
for lookup in font["GSUB"].table.LookupList.Lookup:
    for st in lookup.SubTable:
        st = getattr(st, "ExtSubTable", st)
        for first, entries in getattr(st, "ligatures", {}).items():
            for lig in entries:
                seq = [first] + list(lig.Component)
                if all(g in glyph_char for g in seq):
                    ligs["".join(glyph_char[g] for g in seq)] = lig.LigGlyph
wanted = sorted(n for n in names if n in ligs)
print(f"{len(wanted)} íconos:", " ".join(wanted))

opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = ["*"]
opts.layout_closure = False
opts.notdef_outline = True
sub = subset.Subsetter(opts)
letters = {g for ch, g in char_glyph.items() if re.match(r"[a-z0-9_]", ch)}
sub.populate(glyphs=sorted(letters | {ligs[n] for n in wanted}))
sub.subset(font)
OUT.parent.mkdir(parents=True, exist_ok=True)
font.flavor = "woff2"
font.save(OUT)
print("→", OUT, OUT.stat().st_size, "bytes")

# Versión en la URL para que el navegador no use una fuente anterior guardada en caché.
import hashlib
ver = hashlib.sha1(OUT.read_bytes()).hexdigest()[:8]
for ref in (ROOT / "src/index.html", ROOT / "src/styles/_base.scss"):
    txt = ref.read_text(encoding="utf-8")
    new = re.sub(r"(material-symbols-outlined-subset\.woff2)(\?v=[0-9a-f]+)?", rf"\1?v={ver}", txt)
    if new != txt:
        ref.write_text(new, encoding="utf-8")
print("versión", ver)
