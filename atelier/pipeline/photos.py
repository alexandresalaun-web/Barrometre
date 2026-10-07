#!/usr/bin/env python3
"""Télécharge les photos de face des produits mis en avant et les convertit en petites vignettes WebP.
Lit work/photos_voulues.json : des paires [code, nom de l'image de face] écrites par prep.js. Les vignettes déjà là sont gardées.
Usage : photos.py DOSSIER_DE_TRAVAIL [--elaguer]"""
import json, os, sys, subprocess, io
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
TRAVAIL = sys.argv[1]
UA = "LeBarrometre/1.0 (+https://github.com/alexandresalaun-web/Barrometre)"
DOS = os.path.join(TRAVAIL, "photos"); os.makedirs(DOS, exist_ok=True)
voulues = json.load(open(os.path.join(TRAVAIL, "photos_voulues.json")))
if "--elaguer" in sys.argv:        # ne garder que les vignettes encore utiles (la tâche mensuelle les remet en mémoire d'un mois sur l'autre)
    utiles = {c + ".webp" for c, _ in voulues}; retirees = 0
    for f in os.listdir(DOS):
        if f.endswith(".webp") and f not in utiles: os.remove(os.path.join(DOS, f)); retirees += 1
    print("vignettes devenues inutiles retirées :", retirees, flush=True)
rates_p = os.path.join(TRAVAIL, "photos_absentes.json")
rates = set(json.load(open(rates_p))) if os.path.exists(rates_p) else set()
reste = [(c, img) for c, img in voulues if img and not os.path.exists(os.path.join(DOS, c + ".webp")) and c not in rates]
print("voulues", len(voulues), "sans image connue", sum(1 for c, i in voulues if not i), "à chercher", len(reste), flush=True)
def chemin(code):
    if len(code) <= 8: return code
    c = code.zfill(13)
    return f"{c[0:3]}/{c[3:6]}/{c[6:9]}/{c[9:]}"
def telecharge(t):
    code, img = t
    chemins = [chemin(code)] + ([chemin(code.zfill(13))] if len(code) <= 8 else [])
    for ch in chemins:
        try:
            raw = subprocess.run(["curl", "-sS", "-m", "40", "-A", UA, f"https://images.openfoodfacts.org/images/products/{ch}/{img}.200.jpg"], capture_output=True, timeout=60).stdout
            if raw[:2] == b"\xff\xd8":
                im = Image.open(io.BytesIO(raw)).convert("RGB"); im.thumbnail((120, 104), Image.LANCZOS)
                im.save(os.path.join(DOS, code + ".webp"), "WEBP", quality=52, method=6)
                return code, True
        except Exception:
            pass
    return code, False
ok = 0
with ThreadPoolExecutor(8) as ex:
    for i, (code, bon) in enumerate(ex.map(telecharge, reste)):
        if bon: ok += 1
        else: rates.add(code)
        if i % 500 == 0:
            print(i, "ok", ok, "absentes", len(rates), flush=True); json.dump(sorted(rates), open(rates_p, "w"))
json.dump(sorted(rates), open(rates_p, "w"))
print("FIN ok", ok, "absentes", len(rates), flush=True)
