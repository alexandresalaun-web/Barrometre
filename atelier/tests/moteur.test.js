// Vérifie le repérage des promesses et les seuils du règlement (CE) n° 1924/2006.
const M = require('../pipeline/moteur.js'); let ok = 0, ko = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { ko++; console.log('ÉCHEC', m, '→', JSON.stringify(a), 'attendu', JSON.stringify(b)); } };
const cles = (nom, labels) => { const m = M.detecter(nom, labels); return M.PROMESSES.filter((p, i) => m & (1 << i)).map(p => p.cle); };
// Repérage
eq(cles("Barre protéinée chocolat", []), ["protX"], "nom protéiné");
eq(cles("Skyr nature", ["en:high-proteins"]), ["prot20"], "label riche en protéines");
eq(cles("Yaourt", ["en:source-of-proteins"]), ["prot12"], "label source de protéines");
eq(cles("HiPRO vanille", []), ["protX"], "HiPRO");
eq(cles("Compote sans sucres ajoutés", []), ["sucresAj"], "sans sucres ajoutés seul");
eq(cles("Soda zéro sucres", []), ["sucres0"], "zéro sucres");
eq(cles("Boisson sans sucre", ["en:no-added-sugar"]), ["sucresAj", "sucres0"], "les deux");
eq(cles("Fromage blanc 0% de matières grasses", []), ["gras0"], "0 % MG");
eq(cles("Fromage blanc 0% MG", []), ["gras0"], "0 % MG abrégé");
eq(cles("Chips allégées en matières grasses", []), ["allege"], "allégé");
eq(cles("Muesli riche en fibres", ["en:source-of-fibre"]), ["fib6"], "riche en fibres prime");
eq(cles("Pain complet", ["en:source-of-fibre"]), ["fib3"], "source de fibres");
eq(cles("Haricots verts", ["en:no-salt-added"]), ["selAj"], "sans sel ajouté");
eq(cles("Biscuit", ["en:low-or-no-sugar", "en:reduced-or-no-salt"]), [], "labels génériques ignorés");
eq(cles("Lighthouse cookies", []), [], "pas de faux allégé");
eq(cles("Chips", ["en:low-or-no-fat", "en:low-fat", "en:reduced-fat"]), ["allege"], "allégé : le label parent low-fat est hérité, pas promis");
eq(cles("Chips", ["en:low-or-no-fat", "en:low-fat"]), ["gras3"], "low-fat seul : promesse");
eq(cles("Jambon", ["en:low-or-no-salt", "en:low-salt", "en:reduced-salt"]), ["allege"], "sel réduit");
eq(cles("Confiture", ["en:low-or-no-sugar", "en:low-sugar", "en:reduced-sugar"]), ["allege"], "sucre réduit");
eq(cles("Jambon blanc", ["en:organic", "en:no-gluten"]), [], "arguments hors promesses");
// Seuils
const e = (cle, x) => M.etat(cle, x);
eq(e("prot12", { k: 400, p: 12 }), "tenue", "12 g / 400 kcal = 12 %");
eq(e("prot12", { k: 400, p: 11.5 }), "limite", "11,5 % : limite");
eq(e("prot12", { k: 400, p: 8 }), "non", "8 % : non");
eq(e("prot20", { k: 60, p: 10 }), "tenue", "skyr");
eq(e("prot20", { k: 500, p: 20 }), "non", "16 % : non");
eq(e("protX", { k: null, p: 10 }), "nd", "sans calories");
eq(e("fib6", { k: 350, fb: 6 }), "tenue", "6 g");
eq(e("fib3", { k: 40, fb: .7 }), "tenue", "1,75 g pour 100 kcal");
eq(e("fib3", { k: 400, fb: 2 }), "non", "2 g");
eq(e("sucres0", { s: .4 }), "tenue", "0,4 g");
eq(e("sucres0", { s: 4.5 }), "non", "yaourt nature « sans sucre »");
eq(e("sucres5", { s: 4, liq: false }), "tenue", "solide 4 g");
eq(e("sucres5", { s: 4, liq: true }), "non", "liquide 4 g");
eq(e("gras3", { f: 3.2 }), "limite", "3,2 g");
eq(e("gras0", { f: .1 }), "tenue", "0,1 g");
eq(e("sel", { se: .25 }), "tenue", "sel");
eq(e("sucresAj", { s: 12 }), "inv", "invérifiable");
// Droits
eq(M.droits({ k: 60, p: 10, s: 3.5, f: .2, se: .1, fb: null, liq: false }, 0).map(d => d.cle), ["prot20", "sucres5", "gras0", "sel"], "droits du skyr");
eq(M.droits({ k: 60, p: 10, s: 3.5, f: .2, se: .1 }, M.BIT.prot20).map(d => d.cle), ["sucres5", "gras0", "sel"], "protéine déjà revendiquée");
// Arguments et positionnements
eq(M.ARGUMENTS.filter((a, i) => M.arguments(["en:organic", "en:vegan", "fr:label-rouge", "en:nutriscore-grade-a"]) & (1 << i)).map(a => a.cle), ["bio", "vegan", "signe", "nsaff"], "arguments");
eq(M.POSITIONS.filter((p, i) => M.positions(M.BIT.protX | M.BIT.sucresAj, M.arguments(["en:organic"])) & (1 << i)).map(p => p.cle), ["bio", "proteine", "sucres"], "positionnements");
console.log(ok, 'tests réussis,', ko, 'échecs'); process.exit(ko ? 1 : 0);
