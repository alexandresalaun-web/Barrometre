#!/usr/bin/env bash
# Le Barromètre : fabrication complète du site à partir de l'export du jour d'Open Food Facts, puis contrôles.
# Usage : bash atelier/fabrique.sh [bilan de la publication précédente, par exemple etat/derniere.json]
# Le site fabriqué est dans atelier/site. Le script s'arrête en erreur au premier contrôle manqué : rien ne doit alors être publié.
set -euo pipefail
PRECEDENT=""; if [ -n "${1:-}" ] && [ -f "$1" ]; then PRECEDENT="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; fi
cd "$(dirname "$0")"
export BARRO_RACINE="$PWD"
UA="LeBarrometre/1.0 (+https://github.com/alexandresalaun-web/Barrometre)"
EXPORT="${BARRO_EXPORT:-https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz}"
TAXO="${BARRO_TAXO:-https://static.openfoodfacts.org/data/taxonomies/categories.json}"
MEMOIRE="${BARRO_MEMOIRE_NODE:-6000}"
etape() { echo; echo "=== $1 ($(date -u +%H:%M:%S) UTC) ==="; }
mkdir -p raw work/photos site/d

etape "1. Taxonomie des catégories"
curl -fsSL --retry 5 --retry-delay 15 -A "$UA" "$TAXO" -o raw/categories.json
python3 -c "import json,sys; t=json.load(open('raw/categories.json',encoding='utf-8')); print(len(t),'catégories'); sys.exit(0 if len(t)>5000 else 1)"

etape "2. Export complet, lu en flux (rien n'est gardé sur le disque que les fiches utiles)"
lire() { if [ -f "$EXPORT" ]; then cat "$EXPORT"; else curl -fsSL -A "$UA" "$EXPORT"; fi; }
for essai in 1 2 3; do
  rm -f raw/p_*.jsonl.gz raw/export.json
  if lire | gzip -dc | LC_ALL=C grep -F '"en:france"' | python3 pipeline/export.py raw; then break; fi
  if [ "$essai" = 3 ]; then echo "L'export n'a pas pu être lu en entier après trois essais."; exit 1; fi
  echo "Lecture interrompue, nouvel essai dans une minute."; sleep 60
done

etape "3. Préparation des rayons"
node --max-old-space-size="$MEMOIRE" pipeline/prep.js raw work site/d
etape "4. Vignettes des produits mis en avant"
python3 pipeline/photos.py work --elaguer
rm -f work/photos_absentes.json
etape "5. Préparation, avec les vignettes"
node --max-old-space-size="$MEMOIRE" pipeline/prep.js raw work site/d
etape "6. Assemblage de l'application"
python3 pipeline/build.py

etape "7. Contrôles : seuils réglementaires"
node tests/moteur.test.js
etape "8. Contrôles : recomptage indépendant de six rayons, sur les deux bases"
python3 tests/recoupe.py en:crisps en:yogurts en:candy-chocolate-bars en:sodas en:biscuits en:breakfast-cereals | grep -E "CONCORDE|ÉCART|écarts"
etape "9. Contrôles : garde-fous chiffrés"
python3 tests/garde.py $PRECEDENT
etape "10. Contrôles : l'application dans un navigateur"
PORT="${BARRO_PORT:-8791}"
python3 -m http.server "$PORT" --directory site > /dev/null 2>&1 & SERVEUR=$!
trap 'kill $SERVEUR 2>/dev/null || true' EXIT
sleep 2
node tests/navigateur.js "http://localhost:$PORT/index.html"
node tests/injection.js "http://localhost:$PORT/index.html"
echo; echo "Fabrication et contrôles réussis : le site est prêt dans atelier/site."
