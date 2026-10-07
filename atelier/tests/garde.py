#!/usr/bin/env python3
"""Garde-fous avant publication : refuse un site dont les chiffres ou les fichiers ne sont pas plausibles.
Usage : garde.py [etat/derniere.json]   (le bilan de la publication précédente, pour comparer)
Sort en erreur au premier contrôle manqué : la tâche mensuelle ne publie alors rien et l'application en ligne reste inchangée."""
import base64, datetime, hashlib, json, os, re, sys
RACINE = os.environ.get("BARRO_RACINE") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(RACINE, "site")
rates = []
def verifie(cond, message):
    print(("  ok     " if cond else "  REFUS  ") + message)
    if not cond: rates.append(message)
ix = json.load(open(os.path.join(S, "d/index.json"), encoding="utf-8")); m = ix["meta"]; R = ix["rayons"]
print("Base au", m["date"], "·", m["gardes"], "fiches,", m["actives"], "actives,", m["rayons"], "rayons, année de scans", m["annee"])
# 1. Ordres de grandeur
verifie(350_000 <= m["gardes"] <= 900_000, f"nombre de fiches plausible ({m['gardes']})")
verifie(0.15 <= m["actives"] / m["gardes"] <= 0.65, f"part de références actives plausible ({m['actives'] / m['gardes']:.0%})")
verifie(1800 <= m["rayons"] <= 3600 and len(R) == m["rayons"], f"nombre de rayons plausible ({m['rayons']})")
verifie(sum(1 for r in R if r[8]) >= 1500, f"rayons avec assez de références actives ({sum(1 for r in R if r[8])})")
verifie(m["marques"] >= 20_000, f"nombre de marques plausible ({m['marques']})")
age = (datetime.date.today() - datetime.date.fromisoformat(m["date"])).days
verifie(-1 <= age <= int(os.environ.get("BARRO_AGE_MAX", "10")), f"export récent (base vieille de {age} jours)")
verifie(m["annee"] >= 2025 and m["annee"] <= datetime.date.today().year, f"année de scans de référence plausible ({m['annee']})")
# 2. Rayons repères : présents, fournis, et leurs valeurs tiennent debout
parTag = {r[0]: r for r in R}
for tag, mini, sucres in (("en:crisps", 800, (0, 6)), ("en:yogurts", 1500, (3, 16)), ("en:biscuits", 3000, (15, 40)), ("en:sodas", 600, (0, 12)), ("en:candy-chocolate-bars", 150, (30, 60)), ("en:breakfast-cereals", 1000, (5, 30))):
    r = parTag.get(tag)
    verifie(bool(r) and r[6] >= mini and r[8] is not None, f"rayon {tag} présent avec au moins {mini} références actives ({r[6] if r else 'absent'})")
    if r and r[8]: verifie(sucres[0] <= r[8][1] <= sucres[1], f"rayon {tag} : sucres médians {r[8][1]} g dans la plage attendue {sucres}")
# 3. Vedettes de l'accueil
v = ix["vedettes"]; verifie(len(v) == 24 and sum(1 for x in v if x[1]) >= 22, f"24 rayons en vue, avec photo ({sum(1 for x in v if x[1])} photos)")
# 4. Fichiers
lots = sorted(os.listdir(os.path.join(S, "d/r"))); codes = sorted(os.listdir(os.path.join(S, "d/c")))
verifie(len(lots) == m["lots"] and len(codes) == m["ncodes"], f"fichiers de données au complet ({len(lots)} rayons, {len(codes)} codes)")
total = 0; gros = 0; illisibles = 0; nprod = 0
for d, _, fs in os.walk(S):
    for f in fs:
        p = os.path.join(d, f); t = os.path.getsize(p); total += t; gros = max(gros, t)
        if f.endswith(".json"):
            try:
                o = json.load(open(p, encoding="utf-8"))
                if "/d/c/" in p.replace(os.sep, "/"): nprod += len(o)
            except Exception: illisibles += 1
verifie(illisibles == 0, f"tous les fichiers de données sont lisibles ({illisibles} illisibles)")
verifie(gros < 20 * 2**20 and total < 700 * 2**20, f"tailles dans les limites de GitHub Pages (total {total / 2**20:.0f} Mo, plus gros fichier {gros / 2**20:.1f} Mo)")
verifie(nprod == m["codes"], f"produits consultables par code-barres au complet ({nprod})")
# 5. La page : politique de sécurité présente, et ses empreintes correspondent aux scripts
html = open(os.path.join(S, "index.html"), encoding="utf-8").read()
csp = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', html)
empreintes = ["'sha256-" + base64.b64encode(hashlib.sha256(x.encode("utf-8")).digest()).decode() + "'" for x in re.findall(r"<script>(.*?)</script>", html, re.S)]
verifie(bool(csp) and len(empreintes) == 3 and all(e in csp.group(1) for e in empreintes), "politique de sécurité présente et à jour")
verifie(not re.search(r"[\w.+-]+@(gmail|outlook|hotmail|yahoo|icloud|orange|free|live|laposte)\.", html), "aucune adresse personnelle dans la page")
for f in ("sw.js", "manifest.webmanifest", "etude.html", "icone-192.png", "icone-512.png"): verifie(os.path.getsize(os.path.join(S, f)) > 200, f"{f} présent")
# 6. Comparaison avec la publication précédente
if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
    a = json.load(open(sys.argv[1], encoding="utf-8"))
    print("Publication précédente : base au", a["date"], "·", a["gardes"], "fiches,", a["actives"], "actives,", a["rayons"], "rayons")
    var = lambda k: abs(m[k] - a[k]) / a[k]
    verifie(var("gardes") <= 0.12, f"nombre de fiches proche du précédent ({var('gardes'):+.1%})".replace("+", ""))
    verifie(var("rayons") <= 0.12, f"nombre de rayons proche du précédent ({var('rayons'):.1%})")
    verifie(var("marques") <= 0.15, f"nombre de marques proche du précédent ({var('marques'):.1%})")
    if m["annee"] == a["annee"]: verifie(var("actives") <= 0.20, f"références actives proches du précédent ({var('actives'):.1%})")
    else: print(f"  note   l'année de scans de référence passe de {a['annee']} à {m['annee']} : le nombre de références actives n'est pas comparé")
    verifie(m["date"] >= a["date"], "la base n'est pas plus ancienne que la précédente")
else:
    print("  note   pas de publication précédente à comparer")
if rates:
    print(f"\nPUBLICATION REFUSÉE : {len(rates)} contrôle(s) manqué(s)."); sys.exit(1)
print("\nGarde-fous passés.")
json.dump({k: m[k] for k in ("date", "collecte", "v", "lus", "gardes", "actives", "annee", "rayons", "marques") if k in m}, open(os.path.join(RACINE, "work", "bilan.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
