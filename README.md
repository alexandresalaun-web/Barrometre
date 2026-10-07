# Le Barromètre

Le relevé de rayon instantané, pour les professionnels de la grande consommation.

**Ouvrir l'application : https://alexandresalaun-web.github.io/Barrometre/**

Elle s'installe sur un téléphone depuis le navigateur (iPhone : Safari, Partager, Sur l'écran d'accueil ; Android : bouton Installer).

## Ce qu'elle fait

- **Lire un rayon** : qui l'occupe (marques, fabricants, marques de distributeur), ce que contiennent ses produits (médianes et répartitions, Nutri-Score, NOVA), ce que promettent les packs, les créneaux peu occupés, les nouveaux entrants. 2 475 rayons alimentaires vendus en France.
- **Situer un produit** : scanner un code-barres en magasin, ou chercher un produit, pour voir sa position face à son rayon et ses voisins les plus proches.
- **Relever** : comparer plusieurs produits côte à côte et exporter le tableau.

Les promesses nutritionnelles des packs (source de protéines, riche en fibres, sans sucres…) sont comparées aux seuils de l'annexe du règlement (CE) n° 1924/2006, d'après la fiche du produit.

## Les données

Toutes les données viennent d'[Open Food Facts](https://fr.openfoodfacts.org), base ouverte et collaborative, sous licence [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Aucune autre source n'est utilisée.

L'outil compte des références, pas des ventes : ni prix, ni volumes, ni distribution. Il ne remplace pas un panel, il donne une première lecture de l'offre. Les fiches sont saisies par des bénévoles et par certains fabricants : une valeur peut être fausse ou datée.

Par défaut, les repères portent sur les **références actives** (produits scannés pendant la dernière année de scans publiée, ou fiches créées depuis). Un interrupteur donne accès à toutes les fiches.

## Mise à jour

Les données sont refabriquées **chaque mois**, automatiquement, à partir de l'export complet d'Open Food Facts (`.github/workflows/mise-a-jour.yml`). Avant de publier, la tâche vérifie le résultat : ordres de grandeur, comparaison avec le mois précédent, recomptage indépendant de plusieurs rayons, ouverture de l'application dans un navigateur. Si un contrôle échoue, rien n'est publié. Le journal des publications est dans [`etat/journal.md`](etat/journal.md).

## Dans ce dépôt

- `atelier/` : la chaîne de fabrication. `fabrique.sh` enchaîne tout : lecture de l'export (`pipeline/export.py`), préparation des rayons (`pipeline/prep.js`), vignettes (`pipeline/photos.py`), assemblage de l'application (`pipeline/build.py`), contrôles (`tests/`). `gabarit/` contient la page, son style et son code ; `pipeline/moteur.js` les règles sur les promesses nutritionnelles.
- `etat/` : le bilan de la dernière publication et le journal.
- À la racine (`index.html`, `d/`…) : la version du 7 octobre 2026, gardée comme version de secours.

Pour refabriquer le site sur sa machine : `bash atelier/fabrique.sh` (Python 3 avec Pillow, Node 18 ou plus, Playwright pour les contrôles ; compter 6 Go de mémoire et une demi-heure).

## Crédits

Données : Open Food Facts et ses contributeurs (ODbL), photos des produits sous licence CC BY-SA. Lecture des codes-barres : [Quagga2](https://github.com/ericblade/quagga2) (MIT). Polices : IBM Plex Sans, Source Serif 4, Libre Franklin (SIL Open Font License).

Projet personnel d'Alexandre Salaun.
