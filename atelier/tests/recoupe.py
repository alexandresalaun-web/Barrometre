"""Recoupement indépendant : recalcule quelques chiffres d'un rayon directement depuis la collecte brute, sans passer par prep.js."""
import gzip, json, glob, statistics, sys, collections
import os
RACINE = os.environ.get("BARRO_RACINE") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tags = sys.argv[1:] or ["en:crisps", "en:yogurts", "en:protein-bars"]
ix = json.load(open(RACINE + '/site/d/index.json')); R = ix['rayons']
prods = {t: [] for t in tags}
for f in glob.glob(RACINE + '/raw/p_*.jsonl.gz'):
    for l in gzip.open(f, 'rt', encoding='utf-8'):
        o = json.loads(l); cats = o.get('cat') or []
        for t in tags:
            if t in cats: prods[t].append(o)
def bon(o):
    n = o.get('nut', {}); k = n.get('energy-kcal')
    if k is None and n.get('energy-kj') is not None: k = n['energy-kj'] / 4.184
    f, c, p, fb = n.get('fat'), n.get('carbohydrates'), n.get('proteins'), n.get('fiber')
    m = [n.get(x) for x in ('fat', 'saturated-fat', 'carbohydrates', 'sugars', 'fiber', 'proteins')]
    if k is None or k < 0 or k > 905 or any(v is not None and (v < 0 or v > 100) for v in m) or (n.get('salt') is not None and not 0 <= n['salt'] <= 100) or (f or 0) + (c or 0) + (p or 0) > 105: return False
    if f is not None and c is not None and p is not None and 'en:alcoholic-beverages' not in (o.get('cat') or []):
        est = 9 * f + 4 * c + 4 * p + 2 * (fb or 0)
        if est > 1.6 * k + 25 or est < 0.5 * k - 25: return False
    return True
AN = ix['meta']['annee']; DEBUT = __import__('calendar').timegm((AN, 1, 1, 0, 0, 0))
ecarts = 0
for t in tags:
    i = next(i for i, r in enumerate(R) if r[0] == t); r = R[i]
    lot = json.load(open(f'{RACINE}/site/d/r/{r[4]:03d}.json'))
    for base, cle in (("toutes les fiches", "r"), ("références actives", "a")):
        L = [o for o in prods[t] if bon(o) and (cle == "r" or o.get('py') == AN or (o.get('t') or 0) >= DEBUT)]
        S = lot[cle][str(i)]
        su = sorted(o['nut']['sugars'] for o in L if o['nut'].get('sugars') is not None)
        se = sorted(o['nut']['salt'] for o in L if o['nut'].get('salt') is not None)
        ns = collections.Counter(o.get('ns') for o in L)
        marques = collections.Counter((o['b'][0] if isinstance(o.get('b'), list) else o.get('b') or '').split(',')[0].strip().lower() for o in L if o.get('b'))
        ok = len(L) == S['n'] == (r[2] if cle == "r" else r[6]) and abs(statistics.median(su) - S['q']['s'][10]) < 0.06 and abs(statistics.median(se) - S['q']['se'][10]) < 0.006 and [ns.get(x, 0) for x in 'abcde'] == S['ns'][:5] and sum(o.get('sc', 0) or 0 for o in L) == S['sc']
        ecarts += 0 if ok else 1
        print(f"{r[1]}, {base} : brut {len(prods[t])}, retenus {len(L)} | outil n={S['n']}  {'CONCORDE' if ok else 'ÉCART'}")
        print(f"  sucres médians {statistics.median(su):.2f} | outil {S['q']['s'][10]}   · sel médian {statistics.median(se):.3f} | outil {S['q']['se'][10]}")
        print(f"  Nutri-Score a..e {[ns.get(x, 0) for x in 'abcde']} | outil {S['ns'][:5]}")
        print(f"  3 premières marques {marques.most_common(3)} | outil {[(m[0], m[1]) for m in S['mq'][:3]]}")
        print(f"  scans {sum(o.get('sc', 0) or 0 for o in L)} | outil {S['sc']}")
print("écarts", ecarts); sys.exit(1 if ecarts else 0)
