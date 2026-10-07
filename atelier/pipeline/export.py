#!/usr/bin/env python3
"""Lit l'export complet d'Open Food Facts (openfoodfacts-products.jsonl.gz, une fiche JSON par ligne) sur l'entrée standard
et en tire les produits vendus en France qui ont une catégorie et une valeur énergétique, au format attendu par prep.js
(raw/p_XX.jsonl.gz).

Usage :  zcat openfoodfacts-products.jsonl.gz | grep -F '"en:france"' | python3 export.py DOSSIER_RAW
(le grep ne sert qu'à aller plus vite : le script revérifie le pays)

Depuis 2026, les fiches rangent les valeurs nutritionnelles dans `nutrition.aggregated_set` (pour 100 g ou 100 ml, produit tel
que vendu) au lieu de l'ancien `nutriments`. Les deux formes sont lues. Les valeurs estimées à partir des ingrédients
(source « estimate ») sont écartées : seules comptent celles de l'étiquette ou du fabricant."""
import gzip, json, os, re, sys
try:
    import orjson; charge = orjson.loads
except ImportError:
    charge = json.loads
RAW = sys.argv[1]; os.makedirs(RAW, exist_ok=True)
NUT = ["energy-kcal", "energy-kj", "fat", "saturated-fat", "carbohydrates", "sugars", "fiber", "proteins", "salt"]
FACTEUR = {"g": 1, "mg": 1e-3, "µg": 1e-6, "mcg": 1e-6, "ug": 1e-6, "kg": 1e3, "kcal": 1, "kj": 1, "kJ": 1}
def num(v):
    if isinstance(v, bool) or v is None: return None
    if isinstance(v, (int, float)): return float(v) if v == v and abs(v) != float("inf") else None
    try:
        x = float(v); return x if x == x and abs(x) != float("inf") else None
    except (TypeError, ValueError):
        return None
def nutrition(o):
    """Rend (valeurs pour 100 g ou 100 ml, pour_100_ml) ou (None, False)."""
    nu = o.get("nutrition")
    if isinstance(nu, dict):
        a = nu.get("aggregated_set")
        if isinstance(a, dict) and a.get("per") in ("100g", "100ml") and a.get("preparation", "as_sold") == "as_sold":
            src = a.get("nutrients") or {}; out = {}
            for k in NUT + ["energy", "sodium"]:
                v = src.get(k)
                if not isinstance(v, dict) or v.get("source") == "estimate": continue
                x = num(v.get("value")); f = FACTEUR.get(v.get("unit"), None if v.get("unit") else 1)
                if x is None or f is None: continue
                out[k] = x * f
            if "energy-kj" not in out and "energy" in out: out["energy-kj"] = out["energy"]
            if "salt" not in out and "sodium" in out: out["salt"] = out["sodium"] * 2.5
            return {k: out[k] for k in NUT if k in out}, a.get("per") == "100ml"
    n = o.get("nutriments")
    if isinstance(n, dict) and n:
        out = {}
        for k in NUT:
            x = num(n.get(k + "_100g"))
            if x is not None: out[k] = x
        if "energy-kj" not in out and num(n.get("energy_100g")) is not None: out["energy-kj"] = num(n.get("energy_100g"))
        if "salt" not in out and num(n.get("sodium_100g")) is not None: out["salt"] = num(n.get("sodium_100g")) * 2.5
        return out, False
    return None, False
def image(o):
    """Nom de l'image de face choisie : front_fr.12 (langue, révision)."""
    im = o.get("images")
    if not isinstance(im, dict): return None
    lg = o.get("lang") or "fr"
    f = (im.get("selected") or {}).get("front") if isinstance(im.get("selected"), dict) else None
    if isinstance(f, dict) and f:
        for l in ["fr", lg, "en"] + sorted(f):
            v = f.get(l)
            if isinstance(v, dict) and v.get("rev"): return f"front_{l}.{v['rev']}"
    for l in ["fr", lg, "en"]:
        v = im.get("front_" + l)
        if isinstance(v, dict) and v.get("rev"): return f"front_{l}.{v['rev']}"
    return None
def texte(v):
    return v.strip() if isinstance(v, str) and v.strip() else None
def tags(v):
    return [t for t in v if isinstance(t, str) and t] if isinstance(v, list) else []
sorties = {}
def sortie(code):
    k = code[:2] if code[:2].isdigit() else "xx"
    if k not in sorties: sorties[k] = gzip.open(os.path.join(RAW, f"p_{k}.jsonl.gz"), "wt", encoding="utf-8", compresslevel=6)
    return sorties[k]
lues = fr = gardes = illisibles = sans_cat = sans_energie = 0; vus = set(); dernier = 0
for ligne in sys.stdin.buffer:
    lues += 1
    try:
        o = charge(ligne)
    except Exception:
        illisibles += 1; continue
    if not isinstance(o, dict) or "en:france" not in tags(o.get("countries_tags")): continue
    fr += 1
    lm = num(o.get("last_modified_t"))
    if lm and lm > dernier: dernier = lm
    cats = tags(o.get("categories_tags"))
    if not cats: sans_cat += 1; continue
    nut, ml = nutrition(o)
    if not nut or ("energy-kcal" not in nut and "energy-kj" not in nut): sans_energie += 1; continue
    code = str(o.get("code") or "").strip()
    if not code.isdigit() or code in vus: continue
    vus.add(code)
    r = {"c": code, "n": texte(o.get("product_name_fr")) or texte(o.get("product_name")), "gn": texte(o.get("generic_name_fr")) or texte(o.get("generic_name")),
         "b": texte(o.get("brands")), "cat": cats, "lab": tags(o.get("labels_tags")), "nut": nut, "q": texte(o.get("quantity")), "ml": 1 if ml else None}
    ns = o.get("nutriscore_grade"); r["ns"] = ns if ns in ("a", "b", "c", "d", "e") else None
    nova = num(o.get("nova_group")); r["nova"] = int(nova) if nova and 1 <= nova <= 4 else None
    sc = num(o.get("unique_scans_n")); r["sc"] = int(sc) if sc and sc > 0 else None
    t = num(o.get("created_t")); r["t"] = int(t) if t else None
    r["lm"] = int(lm) if lm else None
    an = num(o.get("additives_n")); r["an"] = int(an) if an is not None else None           # zéro compris : liste d'ingrédients lue, aucun additif
    ing = num(o.get("ingredients_n")); r["in"] = int(ing) if ing else None
    r["ia"] = tags(o.get("ingredients_analysis_tags")); r["lg"] = texte(o.get("lang")); r["img"] = image(o)
    r["st"] = tags(o.get("stores_tags"))[:6]
    ans = [int(m) for p in tags(o.get("popularity_tags")) for m in re.findall(r"scans-(20\d\d)$", p)]; r["py"] = max(ans) if ans else None
    sortie(code).write(json.dumps({k: v for k, v in r.items() if v not in (None, [], {})}, ensure_ascii=False) + "\n"); gardes += 1
    if fr % 200000 == 0: print(f"{fr} fiches France, {gardes} gardées", flush=True)
for s in sorties.values(): s.close()
bilan = {"source": "openfoodfacts-products.jsonl.gz", "lignes_lues": lues, "france": fr, "gardes": gardes, "sans_categorie": sans_cat, "sans_energie": sans_energie, "illisibles": illisibles, "derniere_modification": int(dernier)}
json.dump(bilan, open(os.path.join(RAW, "export.json"), "w"))
print("FIN", json.dumps(bilan), flush=True)
