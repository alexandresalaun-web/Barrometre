#!/usr/bin/env node
/* Le Barromètre : préparation des données.
   Lit les produits Open Food Facts (raw/p_*.jsonl.gz, produits par export.py depuis l'export complet, ou par sweep.py), nettoie, définit les rayons, calcule les repères,
   et écrit dans SORTIE : index.json (liste des rayons), r/NNN.json (fiches de rayon), c/NNN.json (produits par code-barres),
   recherche.json (produits les plus scannés). Usage : node prep.js RAW TRAVAIL SORTIE */
"use strict";
const fs = require("fs"), zlib = require("zlib"), path = require("path");
const M = require("./moteur.js"), MQ = require("./marques.js");
const [RAW, TRAVAIL, SORTIE] = process.argv.slice(2);

const MIN = 60;                       // nombre minimal de fiches pour qu'une catégorie devienne un rayon
const MIN_ACT = 30;                   // nombre minimal de références actives pour calculer les repères « actifs » d'un rayon
const TOPN = 120;                     // références détaillées par rayon
const NCODES = 100;                   // fichiers de produits par code-barres
const NLOTS = 96;                     // fichiers de rayons, au plus
const NPHOTOS = 12;                   // photos intégrées par rayon (rayons de 80 références et plus)
let RELEVE = 0, UN_AN = 0;         // date de la fiche la plus récente : état de la base
const QUANT = Array.from({ length: 21 }, (_, i) => i * 5);

// ---------- Noms de rayons ----------
const NOMS = {
  "en:bars-covered-with-chocolate": "Barres enrobées de chocolat", "en:candy-chocolate-bars": "Barres chocolatées", "en:crackers": "Crackers",
  "en:fruits-based-foods": "Aliments à base de fruits", "en:groceries": "Épicerie", "en:squeezed-juices": "Jus pressés", "en:salads": "Salades",
  "en:labeled-cheeses": "Fromages labellisés", "en:aoc-cheeses": "Fromages AOC", "en:crepes-and-galettes": "Crêpes et galettes", "en:ravioli": "Raviolis",
  "en:raw-cured-ham": "Jambons crus", "en:chewing-gum": "Chewing-gums", "en:gherkins": "Cornichons", "en:drinkable-yogurts": "Yaourts à boire",
  "en:chorizo": "Chorizos", "en:chocolate-powders": "Chocolats en poudre", "en:lemonade": "Limonades", "fr:jambons-cuits-a-l-ancienne": "Jambons cuits à l'ancienne",
  "en:tofu": "Tofu", "en:fries": "Frites", "en:frozen-fries": "Frites surgelées", "en:processed-cheese": "Fromages fondus", "fr:cremes-fraiches": "Crèmes fraîches",
  "en:tuna-in-brine": "Thon au naturel", "en:easter-food": "Produits de Pâques", "en:king-cakes": "Galettes des rois", "en:ice-cream-log": "Bûches glacées",
  "en:galettes": "Galettes", "en:dried-mixed-fruits": "Mélanges de fruits secs", "en:spirulina": "Spiruline", "en:faiselles": "Faisselles",
  "en:preparations-made-from-fish-meat": "Préparations à base de poisson", "en:melted-cheese": "Fromages à fondre", "en:cooked-pressed-cheeses": "Fromages à pâte pressée cuite",
  "en:shortbread-cookies-from-brittany": "Galettes et palets bretons", "en:open-pies": "Tartes", "en:chocolate-rabbits": "Lapins en chocolat", "en:cane-sugar": "Sucres de canne",
  "en:spice-mix": "Mélanges d'épices", "en:pineapple": "Ananas", "en:garlic": "Ail", "en:almond-meal": "Poudres d'amandes", "fr:crepes-de-froment": "Crêpes de froment",
  "en:two-crust-pies": "Tourtes", "en:grilled-almonds": "Amandes grillées", "fr:poulets-fermiers": "Poulets fermiers", "fr:palets": "Palets", "en:bilberries-jams": "Confitures de myrtilles",
  "en:sweet-pastries-and-pies": "Pâtisseries et tartes sucrées", "en:rillettes": "Rillettes", "en:chipolatas": "Chipolatas", "en:ketchup": "Ketchups", "en:common-beans": "Haricots",
  "en:meal-sauces": "Sauces pour plats", "en:croissants": "Croissants", "en:penne": "Penne", "en:chutneys": "Chutneys", "en:skyrs": "Skyrs", "en:penne-rigate": "Penne rigate",
  "en:meat-lasagnas": "Lasagnes à la viande", "en:baking-mixes": "Préparations pour pâtisserie", "en:carrot-salads": "Carottes râpées", "en:salads-with-fish": "Salades au poisson",
  "en:lagers": "Bières blondes", "en:guacamoles": "Guacamoles", "en:combination-meals": "Plats complets", "en:country-specific-beers": "Bières par pays",
  "en:white-wheat-flours": "Farines de blé blanches", "en:shortbread": "Sablés", "en:vegetable-jams": "Confitures de légumes", "en:whole-wheat-flours": "Farines de blé complètes",
  "en:white-kidney-beans": "Haricots blancs", "en:instant-coffee-substitutes": "Substituts de café instantanés", "en:bread-coverings": "Garnitures pour pain", "en:italian-pasta": "Pâtes italiennes",
  "en:mixed-drinks": "Boissons mélangées", "en:ales": "Bières ales",
  "en:pancake-mixes": "Préparations pour pancakes", "en:flavoured-almonds": "Amandes aromatisées", "en:coffee-milks": "Laits au café",
  "en:plant-based-foods-and-beverages": "Aliments et boissons d'origine végétale", "en:plant-based-foods": "Aliments d'origine végétale", "en:sweet-snacks": "Snacks sucrés", "en:salty-snacks": "Snacks salés",
  "en:snacks": "Snacking", "en:dairies": "Produits laitiers", "en:meals": "Plats préparés", "en:beverages": "Boissons", "en:biscuits": "Biscuits", "en:cakes": "Gâteaux", "en:pastas": "Pâtes",
  "en:ice-creams": "Glaces", "en:mueslis": "Mueslis", "en:brioches": "Brioches", "en:protein-bars": "Barres protéinées", "en:cereal-bars": "Barres de céréales",
  "en:bodybuilding-supplements": "Compléments pour la musculation", "en:meats-and-their-products": "Viandes et charcuteries", "en:prepared-meats": "Charcuteries",
  "en:biscuits-and-cakes": "Biscuits et gâteaux", "en:breakfast-cereals": "Céréales du petit-déjeuner", "en:plant-based-milk-alternatives": "Boissons végétales",
  "en:cocoa-and-hazelnuts-spreads": "Pâtes à tartiner cacao noisettes", "en:white-hams": "Jambons blancs", "en:crisps": "Chips", "en:appetizers": "Apéritif salé"
};
// Catégories transversales : jamais proposées en premier comme rayon d'un produit.
const TRANSVERSE = /^(en:(groceries|frozen-foods|canned-foods|fresh-foods|refrigerated-foods|dried-products|festive-foods|easter-food|christmas.*|labeled-.*|aoc-.*|artisan-products|mountain-products|specific-products|products-for-specific-diets|vegan-products|vegetarian-products|organic.*|fair-trade.*|variety-packs|fermented-foods|breakfasts|cooking-helpers|plant-based-foods-and-beverages|plant-based-foods|sweeteners|.*-specific-.*|products-without-gluten|gluten-free-.*|unpasteurised.*|farming-products|french-.*|italian-.*|foods-from-.*|meal-kits|microwave-meals|bread-coverings|spreads|salted-spreads|sweet-spreads|plant-based-spreads|desserts|open-.*|flavoured.*|sweetened-beverages|unsweetened-beverages|artificially-sweetened-beverages|pdo-.*|pgi-.*|label-rouge.*)|fr:.*labellis.*)$/;

const VEDETTES = [
  ["en:candy-chocolate-bars", "Barres chocolatées"], ["en:yogurts", "Yaourts"], ["en:breakfast-cereals", "Céréales du petit-déjeuner"], ["en:biscuits", "Biscuits"],
  ["en:crisps", "Chips"], ["en:sodas", "Sodas"], ["en:protein-bars", "Barres protéinées"], ["en:cereal-bars", "Barres de céréales"],
  ["en:white-hams", "Jambons blancs"], ["en:pizzas", "Pizzas"], ["en:ice-creams-and-sorbets", "Glaces et sorbets"], ["en:cocoa-and-hazelnuts-spreads", "Pâtes à tartiner"],
  ["en:compotes", "Compotes"], ["en:fruit-juices", "Jus de fruits"], ["en:plant-based-milk-alternatives", "Boissons végétales"], ["en:skyrs", "Skyrs"],
  ["en:dark-chocolates", "Chocolats noirs"], ["en:candies", "Bonbons"], ["en:sliced-breads", "Pains de mie"], ["en:sandwiches", "Sandwichs"],
  ["en:meat-analogues", "Substituts de viande"], ["en:energy-drinks", "Boissons énergisantes"], ["en:soups", "Soupes"], ["en:madeleines", "Madeleines"]
];

// ---------- Outils ----------
const arr = (v, d) => v == null ? null : +v.toFixed(d);
function quantiles(tri, d) {
  if (!tri.length) return null;
  return QUANT.map(q => { const pos = (tri.length - 1) * q / 100, i = Math.floor(pos), f = pos - i; return arr(tri[i] + (i + 1 < tri.length ? (tri[i + 1] - tri[i]) * f : 0), d); });
}
const mediane = tri => tri.length ? (tri.length % 2 ? tri[(tri.length - 1) / 2] : (tri[tri.length / 2 - 1] + tri[tri.length / 2]) / 2) : null;
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : null;
function nomPropre(s) {
  s = String(s || "").replace(/[\uFFFD\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g, " ").replace(/\s+/g, " ").trim();   // caractères abîmés ou invisibles de certaines fiches
  if (!s) return "";
  if (s.length > 4 && s === s.toUpperCase() && /[A-ZÀ-Ý]/.test(s)) s = s[0] + s.slice(1).toLowerCase();
  if (s.length > 72) s = s.slice(0, 70).replace(/\s+\S*$/, "") + "…";
  return s;
}
const NS = { a: 1, b: 2, c: 3, d: 4, e: 5 };

// ---------- 1. Lecture et nettoyage ----------
console.time("lecture");
const P = [], vus = new Set(), exclus = { "valeurs hors bornes": 0, "énergie incohérente avec les macronutriments": 0 };
const orthographes = new Map();   // clé de marque -> Map(orthographe -> effectif)
let lus = 0;
for (const f of fs.readdirSync(RAW).filter(f => /^p_.*\.jsonl\.gz$/.test(f)).sort()) {
  for (const l of zlib.gunzipSync(fs.readFileSync(path.join(RAW, f))).toString("utf8").split("\n")) {
    if (!l) continue; const o = JSON.parse(l); if (!o.c || vus.has(o.c)) continue; vus.add(o.c); lus++;
    const n = o.nut || {}, num = v => (typeof v === "number" && isFinite(v)) ? v : (typeof v === "string" && v !== "" && isFinite(+v) ? +v : null);
    let k = num(n["energy-kcal"]); if (k == null && num(n["energy-kj"]) != null) k = num(n["energy-kj"]) / 4.184;
    const x = { c: String(o.c), n: nomPropre(o.n || o.gn), q: nomPropre(o.q).slice(0, 28), k, f: num(n.fat), a: num(n["saturated-fat"]), cb: num(n.carbohydrates), s: num(n.sugars), fb: num(n.fiber), p: num(n.proteins), se: num(n.salt) };
    const cats = o.cat || [];
    // Plausibilité
    let bad = 0;
    const macros = [x.f, x.a, x.cb, x.s, x.fb, x.p];
    if (k == null || k < 0 || k > 905 || macros.some(v => v != null && (v < 0 || v > 100)) || (x.se != null && (x.se < 0 || x.se > 100)) || ((x.f || 0) + (x.cb || 0) + (x.p || 0) > 105)) bad = 1;
    else if (x.f != null && x.cb != null && x.p != null && !cats.includes("en:alcoholic-beverages")) {
      const est = 9 * x.f + 4 * x.cb + 4 * x.p + 2 * (x.fb || 0);
      if (est > 1.6 * k + 25 || est < 0.5 * k - 25) bad = 2;
    }
    if (bad) exclus[bad === 1 ? "valeurs hors bornes" : "énergie incohérente avec les macronutriments"]++;
    x.bad = bad;
    x.k = arr(x.k, 0); for (const c of ["f", "a", "cb", "s", "fb", "p"]) x[c] = arr(x[c], 1); x.se = arr(x.se, 2);
    x.pp = arr(M.part(x), 1);
    x.ns = NS[o.ns] || 0; x.nova = (o.nova >= 1 && o.nova <= 4) ? o.nova : 0;
    x.sc = o.sc > 0 ? o.sc : 0; x.t = o.t || 0;
    x.ing = (typeof o.in === "number") ? o.in : null;
    x.an = (typeof o.an === "number") ? o.an : (x.ing > 0 ? 0 : null);   // l'index omet le compteur d'additifs quand il vaut zéro
    const m = MQ.premiere(o.b);
    if (m) { x.mk = MQ.cle(m); if (!x.mk) x.mk = null; else { let mm = orthographes.get(x.mk); if (!mm) orthographes.set(x.mk, mm = new Map()); mm.set(m, (mm.get(m) || 0) + 1); } } else x.mk = null;
    const qte = o.q || "";
    x.liq = o.ml ? 1 : /\d\s?(ml|cl|l|litres?)\b/i.test(qte) ? 1 : (/\d\s?(g|kg)\b/i.test(qte) ? 0 : (cats.includes("en:beverages") && !cats.includes("en:dehydrated-beverages") ? 1 : 0));
    x.cl = M.detecter(x.n, o.lab); x.ar = M.arguments(o.lab); x.pos = M.positions(x.cl, x.ar);
    x.cats = cats; x.img = o.img || null; x.py = o.py || 0;
    P.push(x);
  }
}
for (const x of P) if (x.t > RELEVE) RELEVE = x.t;
UN_AN = RELEVE - 365 * 86400;
// Référence active : scannée pendant la dernière année de scans connue, ou fiche créée depuis le début de cette année-là.
// Sans année de scan dans la source (ancienne collecte), toutes les fiches comptent comme actives.
// Une année ne devient la référence que lorsqu'elle est publiée en entier : au moins la moitié des fiches scannées depuis l'année précédente
// doivent la porter. Quelques fiches étiquetées en avance ne font donc pas basculer toute la base.
const parAnnee = new Map(); for (const x of P) if (x.py) parAnnee.set(x.py, (parAnnee.get(x.py) || 0) + 1);
let ANNEE = 0; for (const a of [...parAnnee.keys()].sort((p, q) => q - p)) { let depuis = 0; for (const [b, n] of parAnnee) if (b >= a - 1) depuis += n; if (parAnnee.get(a) >= depuis / 2) { ANNEE = a; break; } }
const DEBUT_ANNEE = ANNEE ? Date.UTC(ANNEE, 0, 1) / 1000 : 0;
for (const x of P) x.act = !ANNEE || x.py >= ANNEE || x.t >= DEBUT_ANNEE;
console.log("dernière année de scans", ANNEE, "· références actives", P.filter(x => x.act && !x.bad).length);
// État de la base : dernière modification vue dans l'export, quand export.py l'a notée ; sinon la fiche la plus récente.
let ETAT = RELEVE;
try { const b = JSON.parse(fs.readFileSync(path.join(RAW, "export.json"), "utf8")); if (b.derniere_modification > ETAT) ETAT = b.derniere_modification; } catch (e) { /* collecte par sweep.py : pas de bilan */ }
console.timeEnd("lecture");
console.log("état de la base", new Date(RELEVE * 1000).toISOString());
console.log("fiches lues", lus, "exclues", exclus);

// Marques : orthographe la plus fréquente, groupe, MDD
const MARQUES = new Map();
for (const [k, mm] of orthographes) {
  let best = null, bn = -1; for (const [o, n] of mm) if (n > bn || (n === bn && o < best)) { best = o; bn = n; }
  const g = MQ.groupe(k);
  MARQUES.set(k, { nom: best, g, mdd: g >= 0 && MQ.GROUPES[g].type === "mdd" ? 1 : 0 });
}
for (const x of P) { const mi = x.mk ? MARQUES.get(x.mk) : null; x.m = mi ? mi.nom : ""; x.g = mi ? mi.g : -1; x.mdd = mi ? mi.mdd : 0; }
const OK = P.filter(x => !x.bad);
console.log("fiches retenues", OK.length, "marques", MARQUES.size);

// ---------- 2. Rayons ----------
const taxo = JSON.parse(fs.readFileSync(path.join(RAW, "categories.json"), "utf8"));
const effectif = new Map();
for (const x of OK) for (const c of new Set(x.cats)) effectif.set(c, (effectif.get(c) || 0) + 1);
function nomRayon(tag) {
  if (NOMS[tag]) return NOMS[tag];
  const t = taxo[tag]; if (!t || !t.name) return null;
  let s = t.name.fr || t.name.en; if (!s) return null;
  s = s.replace(/\s+/g, " ").trim(); return s[0].toUpperCase() + s.slice(1);
}
let R = [];
for (const [tag, n] of effectif) { if (n < MIN) continue; const nom = nomRayon(tag); if (!nom) continue; R.push({ tag, nom, n, prods: [], tr: TRANSVERSE.test(tag) ? 1 : 0 }); }
R.sort((a, b) => b.n - a.n || (a.tag < b.tag ? -1 : 1));
// Deux catégories de même nom : on garde la plus fournie, l'autre prend son étiquette anglaise pour rester distincte.
{ const noms = new Map(); for (const r of R) { const k = M.plat(r.nom); if (noms.has(k)) r.doublon = 1; else noms.set(k, r); } R = R.filter(r => !r.doublon); }
const idx = new Map(); R.forEach((r, i) => { r.i = i; idx.set(r.tag, i); });
console.log("rayons", R.length);
// Appartenance et cooccurrences
const co = R.map(() => new Map());
for (let pi = 0; pi < OK.length; pi++) {
  const x = OK[pi], rs = []; for (const c of new Set(x.cats)) { const i = idx.get(c); if (i != null) rs.push(i); }
  x.rs = rs;
  for (const i of rs) { R[i].prods.push(pi); const m = co[i]; for (const j of rs) if (j !== i) m.set(j, (m.get(j) || 0) + 1); }
}
for (const r of R) r.n = r.prods.length;
// Parent : la plus petite catégorie plus grande qui contient au moins 90 % des produits
for (const r of R) {
  let best = -1;
  for (const [j, c] of co[r.i]) { const u = R[j]; if (c >= .9 * r.n && (u.n > r.n || (u.n === r.n && j < r.i)) && (best < 0 || u.n < R[best].n)) best = j; }
  r.par = best;
}
for (const r of R) { const s = new Set(); let u = r.par, garde = 0; while (u >= 0 && garde++ < 40) { s.add(u); u = R[u].par; } r.anc = s; r.prof = s.size; }
// Rayons d'un produit : la frontière (ceux qui ne sont l'ancêtre d'aucun autre), le plus précis d'abord
function frontiere(rs) {
  const anc = new Set(); for (const i of rs) for (const a of R[i].anc) anc.add(a);
  return rs.filter(i => !anc.has(i)).sort((a, b) => R[a].tr - R[b].tr || R[a].n - R[b].n);
}
for (const x of OK) x.fr = frontiere(x.rs);
// Les fiches écartées gardent un rayon pour pouvoir être situées quand on les scanne
for (const x of P) if (x.bad) { const rs = []; for (const c of new Set(x.cats)) { const i = idx.get(c); if (i != null) rs.push(i); } x.fr = frontiere(rs); }

// ---------- 3. Repères par rayon ----------
const DROITS = ["prot12", "prot20", "fib3", "fib6", "sucres5", "sucres0", "gras3", "gras0", "sel"];
const ETATI = { tenue: 0, limite: 1, non: 2, nd: 3, inv: 4 };
for (const x of OK) {
  x.et = []; M.PROMESSES.forEach((p, i) => { if (x.cl & (1 << i)) x.et.push([i, ETATI[M.etat(p.cle, x)]]); });
  x.dr = M.droits(x, x.cl).map(d => DROITS.indexOf(d.cle));
}
const LIGNES = new Map();
function ligne(x) {
  let l = LIGNES.get(x);
  if (!l) { const d = new Date(x.t * 1000); l = [x.c, x.n, x.m, x.q, x.k, x.f, x.a, x.s, x.fb, x.p, x.se, x.ns, x.nova, x.cl, x.ar, x.sc, x.t ? (d.getUTCFullYear() % 100) * 100 + d.getUTCMonth() + 1 : 0, (x.liq ? 1 : 0) | (x.mdd ? 2 : 0) | (x.bad ? 4 : 0) | (x.act ? 8 : 0), x.g, x.fr.slice(0, 4)]; LIGNES.set(x, l); }
  return l;
}
const NP = M.POSITIONS.length;
const photosVoulues = new Map();    // code -> nom de l'image de face (front_fr.12), quand la source le donne
console.time("repères");
function reperes(L, premier) {
  const n = L.length;
  const S = { n };
  // Composition
  S.q = {}; S.qn = {};
  for (const [c, d] of [["k", 0], ["s", 1], ["f", 1], ["a", 1], ["se", 2], ["p", 1], ["fb", 1], ["pp", 1]]) {
    const v = []; for (const x of L) if (x[c] != null) v.push(x[c]); v.sort((a, b) => a - b); S.q[c] = quantiles(v, d); S.qn[c] = v.length;
  }
  // Nutri-Score, NOVA
  S.ns = [0, 0, 0, 0, 0, 0]; S.nova = [0, 0, 0, 0, 0];
  for (const x of L) { S.ns[x.ns ? x.ns - 1 : 5]++; S.nova[x.nova ? x.nova - 1 : 4]++; }
  // Marques et fabricants
  const mq = new Map(), fab = new Map(); let nm = 0, scTot = 0, scM = 0, nMdd = 0, scMdd = 0; const ens = new Map();
  for (const x of L) {
    scTot += x.sc; if (!x.mk) continue; nm++; scM += x.sc;
    let b = mq.get(x.mk); if (!b) mq.set(x.mk, b = { n: 0, sc: 0, s: [], ab: 0, nsn: 0, pp: [], premier: Infinity });
    b.n++; b.sc += x.sc; if (x.s != null) b.s.push(x.s); if (x.pp != null) b.pp.push(x.pp); if (x.ns) { b.nsn++; if (x.ns <= 2) b.ab++; } if (x.t && x.t < b.premier) b.premier = x.t;
    const fk = x.g >= 0 ? "g" + x.g : "m" + x.mk; let ff = fab.get(fk); if (!ff) fab.set(fk, ff = { n: 0, sc: 0, g: x.g, mk: x.mk, mq: new Set() }); ff.n++; ff.sc += x.sc; ff.mq.add(x.mk);
    if (x.mdd) { nMdd++; scMdd += x.sc; ens.set(x.g, (ens.get(x.g) || 0) + 1); }
  }
  const tri = a => a.sort((p, q) => p - q);
  S.nm = nm; S.sc = scTot; S.scm = scM; S.nmq = mq.size;
  S.mq = [...mq].sort((a, b) => b[1].n - a[1].n || b[1].sc - a[1].sc).slice(0, 15).map(([k, b]) => { const mi = MARQUES.get(k); return [mi.nom, b.n, b.sc, mi.g, arr(mediane(tri(b.s)), 1), b.nsn >= 3 ? Math.round(b.ab / b.nsn * 100) : null, arr(mediane(tri(b.pp)), 1)]; });
  S.fab = [...fab.values()].sort((a, b) => b.n - a.n || b.sc - a.sc).slice(0, 10).map(f => [f.g >= 0 ? MQ.GROUPES[f.g].nom : MARQUES.get(f.mk).nom, f.n, f.sc, f.g >= 0 ? (MQ.GROUPES[f.g].type === "mdd" ? 2 : 1) : 0, f.mq.size]);
  S.mdd = [nMdd, scMdd, [...ens].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, c]) => [MQ.GROUPES[g].nom, c])];
  // Promesses
  const pr = M.PROMESSES.map(() => ({ e: [0, 0, 0, 0, 0], mq: new Map() })), dr = DROITS.map(() => 0);
  const pos = new Array(NP).fill(0), grille = Array.from({ length: NP }, () => [0, 0, 0, 0]), paires = new Array(NP * NP).fill(0), args = M.ARGUMENTS.map(() => 0);
  let nsAff = 0;
  for (const x of L) {
    for (const [i, e] of x.et) { pr[i].e[e]++; if (x.mk) pr[i].mq.set(x.mk, (pr[i].mq.get(x.mk) || 0) + 1); }
    for (const d of x.dr) dr[d]++;
    for (let i = 0; i < args.length; i++) if (x.ar & (1 << i)) args[i]++;
    if (x.pos) { const col = !x.ns ? 3 : x.ns <= 2 ? 0 : x.ns === 3 ? 1 : 2;
      for (let i = 0; i < NP; i++) if (x.pos & (1 << i)) { pos[i]++; grille[i][col]++; for (let j = i + 1; j < NP; j++) if (x.pos & (1 << j)) paires[i * NP + j]++; } }
  }
  S.pr = pr.map((p, i) => { const t = p.e.reduce((a, b) => a + b, 0); return t ? [i, t, ...p.e, [...p.mq].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, c]) => [MARQUES.get(k).nom, c])] : null; }).filter(Boolean);
  S.dr = dr; S.ar = args; S.pos = pos; S.gr = grille;
  S.px = []; for (let i = 0; i < NP; i++) for (let j = i + 1; j < NP; j++) if (paires[i * NP + j]) S.px.push([i, j, paires[i * NP + j]]);
  // Additifs et ingrédients
  { const a = [], g = []; let zero = 0; for (const x of L) { if (x.an != null) { a.push(x.an); if (!x.an) zero++; } if (x.ing != null && x.ing > 0) g.push(x.ing); }
    S.add = [arr(mediane(tri(a)), 1), a.length ? Math.round(zero / a.length * 100) : null, arr(mediane(tri(g)), 0), a.length]; }
  // Nouveaux entrants (fiche créée depuis moins de douze mois) et cohortes par année de création
  const neufs = L.filter(x => x.t >= UN_AN);
  const mqNeuves = [...mq].filter(([k, b]) => (premier.get(k) || 0) >= UN_AN).sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([k, b]) => [MARQUES.get(k).nom, b.n]);
  const an = new Map();
  for (const x of L) { if (!x.t) continue; const y = new Date(x.t * 1000).getUTCFullYear(); if (y < 2017) continue; let c = an.get(y); if (!c) an.set(y, c = [y, 0, 0, 0, 0, 0]); c[1]++; if (x.cl & M.MASQUE_PROT) c[2]++; if (x.ar & 1) c[3]++; if (x.pos & (1 << 5)) c[4]++; if (x.pos & (1 << 1)) c[5]++; }
  S.an = [...an.values()].sort((a, b) => a[0] - b[0]);
  // Références détaillées : les plus scannées, puis les plus récentes
  const nommes = L.filter(x => x.n);
  const top = nommes.slice().sort((a, b) => (b.act ? 1 : 0) - (a.act ? 1 : 0) || b.sc - a.sc || (b.mk ? 1 : 0) - (a.mk ? 1 : 0) || b.t - a.t).slice(0, TOPN);
  const derniers = neufs.filter(x => x.n && x.mk).sort((a, b) => b.t - a.t).slice(0, 8);
  S.nv = [neufs.length, [...mq].filter(([k, b]) => (premier.get(k) || 0) >= UN_AN).length, mqNeuves];
  if (n >= 80) for (const x of top.slice(0, NPHOTOS)) photosVoulues.set(x.c, x.img);
  // Chiffres de comparaison entre rayons (index)
  const med = c => S.q[c] ? S.q[c][10] : null, nsConnu = n - S.ns[5], novaConnu = n - S.nova[4];
  const protFait = pos[4], protE = [0, 1, 2].reduce((s, i) => { const p = pr[i].e; return [s[0] + p[0], s[1] + p[0] + p[1] + p[2]]; }, [0, 0]);
  const ix = [med("k"), med("s"), med("pp"), med("se"), med("f"), med("fb"), pct(S.ns[0] + S.ns[1], nsConnu), pct(S.nova[3], novaConnu), pct(nMdd, nm), pct(protFait, n), protE[1] >= 5 ? pct(protE[0], protE[1]) : null, pct(args[0], n), pct(neufs.length, n), mq.size, S.mq[0] ? S.mq[0][0] : "", S.mq[0] ? pct(S.mq[0][1], nm) : null];
  return { S, top, derniers, ix };
}
for (const r of R) {
  const L = r.prods.map(i => OK[i]), premier = new Map();      // première apparition de chaque marque dans le rayon, toutes fiches confondues
  for (const x of L) if (x.mk && x.t && !(premier.get(x.mk) <= x.t)) premier.set(x.mk, x.t);
  r.tout = reperes(L, premier);
  const A = L.filter(x => x.act); r.nAct = A.length;
  r.act = A.length >= MIN_ACT ? reperes(A, premier) : null;
}
console.timeEnd("repères");

// ---------- 4. Fichiers ----------
fs.mkdirSync(path.join(SORTIE, "r"), { recursive: true }); fs.mkdirSync(path.join(SORTIE, "c"), { recursive: true });
for (const d of ["r", "c"]) for (const f of fs.readdirSync(path.join(SORTIE, d))) fs.unlinkSync(path.join(SORTIE, d, f));
const dirPhotos = path.join(TRAVAIL, "photos");
const photo = c => { const f = path.join(dirPhotos, c + ".webp"); return fs.existsSync(f) ? "data:image/webp;base64," + fs.readFileSync(f).toString("base64") : null; };
// Vedettes : une photo par rayon mis en avant
const vedettes = [];
for (const [tag, nom] of VEDETTES) { const i = idx.get(tag); if (i == null) { console.log("vedette absente", tag); continue; } R[i].nom = nom;
  // L'enseigne du rayon : le produit le plus scanné parmi ses trois premières marques. Une fiche mal rangée par un contributeur ne sert ainsi pas de vitrine.
  const Sv = R[i].act || R[i].tout, tetes = new Set(Sv.S.mq.slice(0, 3).map(m => m[0])), chez = Sv.top.filter(x => x.mk && tetes.has(MARQUES.get(x.mk).nom));
  const t = (chez.length ? chez : Sv.top).slice(0, 3); t.forEach(x => photosVoulues.set(x.c, x.img)); vedettes.push([i, t.map(x => x.c)]); }
fs.writeFileSync(path.join(TRAVAIL, "photos_voulues.json"), JSON.stringify([...photosVoulues]));
// Ordre de parcours : en profondeur, pour regrouper les rayons voisins dans un même fichier
const enfants = R.map(() => []); for (const r of R) if (r.par >= 0) enfants[r.par].push(r.i);
const ordre = []; (function visite(L) { for (const i of L.sort((a, b) => R[b].n - R[a].n)) { ordre.push(i); visite(enfants[i]); } })(R.filter(r => r.par < 0).map(r => r.i));
let lot = null, nLots = 0, octets = 0, nPhotos = 0;
function ferme() {
  if (!lot) return;
  const s = JSON.stringify({ p: lot.p, r: lot.r, a: lot.a, ph: lot.ph }); octets += s.length;
  fs.writeFileSync(path.join(SORTIE, "r", String(nLots).padStart(3, "0") + ".json"), s); nLots++; lot = null;
}
for (const i of ordre) {
  const r = R[i];
  if (!lot) lot = { p: [], r: {}, a: {}, ph: {}, pos: new Map() };
  const place = x => { let k = lot.pos.get(x); if (k == null) { k = lot.p.length; lot.pos.set(x, k); lot.p.push(ligne(x)); } return k; };
  for (const [cle, base] of [["r", r.tout], ["a", r.act]]) {       // r : toutes les fiches ; a : références actives
    if (!base) continue;
    const S = base.S; S.top = base.top.map(place); S.nvp = base.derniers.map(place);
    if (S.n >= 80) for (const x of base.top.slice(0, NPHOTOS)) if (!lot.ph[x.c]) { const d = photo(x.c); if (d) { lot.ph[x.c] = d; nPhotos++; } }
    lot[cle][i] = S;
  }
  r.lot = nLots;
  if (Object.keys(lot.r).length >= Math.ceil(R.length / NLOTS)) ferme();
}
ferme();
console.log("fichiers de rayons", nLots, (octets / 1e6).toFixed(1), "Mo, photos intégrées", nPhotos);

// Produits par code-barres (toutes les fiches nommées, écartées comprises)
const paquets = Array.from({ length: NCODES }, () => []);
const fragment = c => Number(c.slice(-4)) % NCODES;
let nCodes = 0;
for (const x of P) { if (!x.n && !x.m) continue; paquets[fragment(x.c) || 0].push(ligne(x)); nCodes++; }
let oc = 0;
paquets.forEach((pq, i) => { const s = JSON.stringify(pq); oc += s.length; fs.writeFileSync(path.join(SORTIE, "c", String(i).padStart(3, "0") + ".json"), s); });
console.log("produits par code", nCodes, (oc / 1e6).toFixed(1), "Mo");

// Recherche par nom : les produits les plus scannés
const rech = OK.filter(x => x.n && x.sc > 0 && x.fr.length).sort((a, b) => (b.act ? 1 : 0) - (a.act ? 1 : 0) || b.sc - a.sc).slice(0, 24000).map(x => [x.c, x.n, x.m, x.fr[0]]);
fs.writeFileSync(path.join(SORTIE, "recherche.json"), JSON.stringify(rech));

// Index
const nMddG = OK.filter(x => x.mdd).length, nMarque = OK.filter(x => x.mk).length;
const index = {
  meta: { date: new Date(ETAT * 1000).toISOString().slice(0, 10), collecte: process.env.BARRO_COLLECTE || new Date().toISOString().slice(0, 10), v: new Date(ETAT * 1000).toISOString().slice(0, 10).replace(/-/g, "") + "-" + OK.length.toString(36), lus, gardes: OK.length, actives: OK.filter(x => x.act).length, annee: ANNEE, minAct: MIN_ACT, exclus, rayons: R.length, marques: MARQUES.size, mdd: pct(nMddG, nMarque), min: MIN, topn: TOPN, ncodes: NCODES, lots: nLots, codes: nCodes, scans: OK.reduce((s, x) => s + x.sc, 0), scannes: OK.filter(x => x.sc > 0).length },
  rayons: R.map(r => [r.tag, r.nom, r.n, r.par, r.lot, r.tr, r.nAct, r.tout.ix, r.act ? r.act.ix : null]),
  groupes: MQ.GROUPES.map(g => [g.nom, g.type === "mdd" ? 2 : 1]),
  vedettes: vedettes.map(([i, cs]) => { const c = cs.find(c => photo(c)); return [i, c ? photo(c) : null]; })
};
fs.writeFileSync(path.join(SORTIE, "index.json"), JSON.stringify(index));
console.log("index", (fs.statSync(path.join(SORTIE, "index.json")).size / 1e3).toFixed(0), "ko ; recherche", (fs.statSync(path.join(SORTIE, "recherche.json")).size / 1e3).toFixed(0), "ko ; photos voulues", photosVoulues.size);
