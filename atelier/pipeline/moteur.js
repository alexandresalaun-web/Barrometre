/* Le Barromètre : moteur partagé entre la préparation des données (Node) et la page (navigateur).
   Repère les promesses nutritionnelles d'un pack (nom + labels Open Food Facts) et les compare
   aux seuils de l'annexe du règlement (CE) n° 1924/2006. */
(function (racine) {
  "use strict";
  const plat = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const norm = s => plat(s).replace(/[-_]/g, " ");
  const nb = (v, d) => v == null ? "" : Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: 0 });
  const f1 = v => nb(v, 1);

  const SEUIL = 12, RICHE = 20;
  // Ordre fixe : le rang dans ce tableau est le bit du masque stocké dans les données.
  const PROMESSES = [
    { cle: "prot20", nom: "Riche en protéines", fam: "prot" },
    { cle: "prot12", nom: "Source de protéines", fam: "prot" },
    { cle: "protX", nom: "Protéines mises en avant", fam: "prot" },
    { cle: "fib6", nom: "Riche en fibres", fam: "fib" },
    { cle: "fib3", nom: "Source de fibres", fam: "fib" },
    { cle: "gras0", nom: "Sans matières grasses", fam: "gras" },
    { cle: "gras3", nom: "Faible teneur en matières grasses", fam: "gras" },
    { cle: "sucresAj", nom: "Sans sucres ajoutés", fam: "sucresAj" },
    { cle: "sucres0", nom: "Sans sucres", fam: "sucres" },
    { cle: "sucres5", nom: "Faible teneur en sucres", fam: "sucres" },
    { cle: "selAj", nom: "Sans sel ajouté", fam: "selAj" },
    { cle: "sel", nom: "Pauvre en sel", fam: "sel" },
    { cle: "allege", nom: "Allégé ou à teneur réduite", fam: "allege" }
  ];
  const BIT = {}; PROMESSES.forEach((p, i) => BIT[p.cle] = 1 << i);
  const MASQUE_PROT = BIT.prot20 | BIT.prot12 | BIT.protX;

  // Arguments de positionnement lus dans les labels (bit = rang).
  const ARGUMENTS = [
    { cle: "bio", nom: "Bio", re: /^(en:organic|en:eu-organic|fr:ab-agriculture-biologique|en:[a-z]{2}-bio-\d+)$/ },
    { cle: "vegan", nom: "Végan", re: /^(en:vegan|en:european-vegetarian-union-vegan|en:the-vegan-society|en:eve-vegan)$/ },
    { cle: "vege", nom: "Végétarien", re: /^(en:vegetarian|en:european-vegetarian-union|en:european-vegetarian-union-vegetarian)$/ },
    { cle: "gluten", nom: "Sans gluten", re: /^(en:no-gluten|en:crossed-grain-symbol|fr:afdiag)$/ },
    { cle: "lactose", nom: "Sans lactose", re: /^(en:no-lactose|en:sans-lactose)$/ },
    { cle: "palme", nom: "Sans huile de palme", re: /^(en:no-palm-oil|en:palm-oil-free)$/ },
    { cle: "sansadd", nom: "Sans conservateurs, colorants ou additifs", re: /^en:(no-preservatives|no-colorings|no-additives|no-artificial-flavors|no-artificial-colors|no-artificial-colours|no-dyes-or-preservatives|no-flavors|no-artificial-preservatives|no-flavour-enhancer|no-artificial-colours-or-flavours|no-artificial-colors-or-flavors|no-nitrite-added|no-artificial-sweeteners|no-sweeteners)$/ },
    { cle: "france", nom: "Origine France", re: /^(en:made-in-france|en:french-(meat|milk|pork|poultry|beef|eggs|wheat|chicken|fruits|vegetables|potatoes|duck|turkey|lamb|veal|agriculture|flour|cereals)|fr:(viande-francaise|origine-france-garantie|volaille-francaise|le-porc-francais|lait-collecte-et-conditionne-en-france|fruits-et-legumes-de-france|oeufs-de-france|ble-francais|viande-bovine-francaise|viande-de-porc-francaise|fabrique-en-france|cuisine-en-france|elabore-en-france|produit-en-france|pommes-de-terre-de-france|lait-francais)|en:produced-in-france|en:cooked-in-france)$/ },
    { cle: "signe", nom: "Label Rouge, AOP ou IGP", re: /^(fr:label-rouge|en:pdo|en:pgi|en:tsg|fr:aoc|en:aoc)$/ },
    { cle: "equitable", nom: "Commerce équitable", re: /^(en:fair-trade|en:fairtrade-international|en:max-havelaar|en:fair-for-life|en:fair-trade-organic|fr:bio-equitable-en-france|en:world-fair-trade-organization|fr:agri-ethique-france|fr:c-est-qui-le-patron)$/ },
    { cle: "nsaff", nom: "Nutri-Score affiché sur le pack", re: /^en:nutriscore(-grade-[a-e])?$/ }
  ];
  function arguments_(labels) {
    let m = 0; if (!labels) return 0;
    for (const l of labels) for (let i = 0; i < ARGUMENTS.length; i++) if (!(m & (1 << i)) && ARGUMENTS[i].re.test(l)) m |= 1 << i;
    return m;
  }

  /* Repérage des promesses : rend un masque de bits. */
  function detecter(nom, labels) {
    // Open Food Facts ajoute à chaque label ses parents : « allégé en matière grasse » (reduced-fat) entraîne « peu de matière grasse » (low-fat).
    // Ces labels hérités ne sont pas des promesses du pack : on les écarte.
    const L = labels || [], herites = new Set();
    for (const l of L) { const m = /^en:reduced-(.+)$/.exec(l); if (m) herites.add("en:low-" + m[1]); }
    const t = norm((nom || "") + " | " + L.filter(l => !/low-or-no|reduced-or-no/.test(l) && !herites.has(l)).join(" | "));
    let m = 0;
    if (/riche en proteine|high protein|haute teneur en proteine|rich in protein/.test(t)) m |= BIT.prot20;
    else if (/source (de|of) protein|proteins? source/.test(t)) m |= BIT.prot12;
    else if (/protein|\bhipro\b|\bpro ?\+/.test(t)) m |= BIT.protX;
    if (/riche en fibre|high fib|haute teneur en fibre|rich in fib/.test(t)) m |= BIT.fib6;
    else if (/source (de|of) fib/.test(t)) m |= BIT.fib3;
    if (/sans matieres? grasses?\b|fat free|\bno fat\b|\b0 ?% (de )?(mg|m\.g\.?|matieres? grasses?)(?![a-z])/.test(t)) m |= BIT.gras0;
    else if (/(faible teneur|pauvre) en matieres? grasses?\b|low fat/.test(t)) m |= BIT.gras3;
    if (/sans sucres? ajoute|no added sugar|no sugar added|without added sugar/.test(t)) m |= BIT.sucresAj;
    if (/sans sucres?\b(?! ajoute)|sugar free|\bno sugars?\b(?! added)|zero sucres?\b|\b0 ?% (de )?sucres?\b(?! ajoute)/.test(t)) m |= BIT.sucres0;
    else if (/(faible teneur|pauvre) en sucres?\b|low sugar/.test(t)) m |= BIT.sucres5;
    if (/sans sel ajoute|no salt added|no added salt/.test(t)) m |= BIT.selAj;
    else if (/(pauvre|faible teneur) en (sel|sodium)\b|low (salt|sodium)/.test(t)) m |= BIT.sel;
    if (/\ballege|\blight\b|reduit en|teneur reduite|\breduced\b|\bmoins de (sucres?|sel|matieres? grasses?)\b/.test(t)) m |= BIT.allege;
    return m;
  }

  const part = x => (x.p != null && x.k != null && x.k >= 20 && x.p >= 0) ? Math.min(100, x.p * 4 / x.k * 100) : null;

  /* Vérification d'une promesse. x = { k, p, s, f, fb, se, liq } pour 100 g ou 100 ml.
     Écart de moins de 10 % avec le seuil : « limite », les valeurs d'étiquette étant arrondies. */
  function etat(cle, x) {
    const res = (ok, v, s) => ok ? "tenue" : (s && Math.abs(v - s) / s <= .1 ? "limite" : "non");
    switch (cle) {
      case "prot20": case "prot12": case "protX": { const pp = part(x); if (pp == null) return "nd"; const s = cle === "prot20" ? RICHE : SEUIL; return res(pp >= s, pp, s); }
      case "fib6": case "fib3": { if (x.fb == null) return "nd"; const s = cle === "fib6" ? 6 : 3, pk = x.k ? x.fb / x.k * 100 : null; return res(x.fb >= s || (pk != null && pk >= s / 2), x.fb, s); }
      case "gras0": case "gras3": { if (x.f == null) return "nd"; const s = cle === "gras0" ? .5 : (x.liq ? 1.5 : 3); return res(x.f <= s, x.f, s); }
      case "sucres0": case "sucres5": { if (x.s == null) return "nd"; const s = cle === "sucres0" ? .5 : (x.liq ? 2.5 : 5); return res(x.s <= s, x.s, s); }
      case "sel": { if (x.se == null) return "nd"; return res(x.se <= .3, x.se, .3); }
      default: return "inv";
    }
  }
  function detail(cle, x) {
    const u = x.liq ? "100 ml" : "100 g", e = etat(cle, x);
    const manque = quoi => `La fiche ne donne pas ${quoi} : impossible de vérifier.`;
    const flou = e === "limite" ? " L'écart est trop faible pour conclure : les valeurs d'étiquette sont arrondies." : "";
    switch (cle) {
      case "prot20": case "prot12": case "protX": { const pp = part(x); if (pp == null) return manque("les protéines ou les calories"); const s = cle === "prot20" ? RICHE : SEUIL;
        return `${nb(pp)} % des calories viennent des protéines. Il en faut ${s}.` + flou; }
      case "fib6": case "fib3": { if (x.fb == null) return manque("les fibres"); const s = cle === "fib6" ? 6 : 3;
        return `${f1(x.fb)} g de fibres pour ${u}. Il en faut ${s}, ou ${f1(s / 2)} g pour 100 kcal.` + flou; }
      case "gras0": case "gras3": { if (x.f == null) return manque("les matières grasses"); const s = cle === "gras0" ? .5 : (x.liq ? 1.5 : 3);
        return `${f1(x.f)} g de matières grasses pour ${u}. Le plafond est de ${f1(s)} g.` + flou; }
      case "sucres0": case "sucres5": { if (x.s == null) return manque("les sucres"); const s = cle === "sucres0" ? .5 : (x.liq ? 2.5 : 5);
        return `${f1(x.s)} g de sucres pour ${u}. Le plafond est de ${f1(s)} g.` + flou; }
      case "sel": { if (x.se == null) return manque("le sel"); return `${nb(x.se, 2)} g de sel pour ${u}. Le plafond est de 0,3 g.` + flou; }
      case "sucresAj": return `Cette promesse porte sur la recette, pas sur le tableau nutritionnel : le calcul ne peut pas la vérifier.${x.s != null ? ` Le produit contient ${f1(x.s)} g de sucres pour ${u}, ajoutés ou non.` : ""}`;
      case "selAj": return "Cette promesse porte sur la recette, pas sur le tableau nutritionnel : le calcul ne peut pas la vérifier.";
      default: return "Allégé veut dire au moins 30 % de moins qu'un produit comparable. Sans ce produit de référence, le calcul est impossible.";
    }
  }
  /* Promesses faites par un produit, à partir de son masque. */
  function promesses(x, masque) {
    const L = [];
    PROMESSES.forEach((p, i) => { if (masque & (1 << i)) L.push({ cle: p.cle, nom: p.nom, fam: p.fam, etat: etat(p.cle, x), detail: detail(p.cle, x) }); });
    return L;
  }
  /* Seuils atteints sans que le pack le dise : clés des mentions auxquelles le produit aurait droit. */
  function droits(x, masque) {
    const D = [], pp = part(x), u = x.liq ? "100 ml" : "100 g";
    if (!(masque & MASQUE_PROT) && pp != null && pp >= SEUIL) D.push({ cle: pp >= RICHE ? "prot20" : "prot12", nom: pp >= RICHE ? "Riche en protéines" : "Source de protéines", preuve: `${nb(pp)} % des calories` });
    if (!(masque & (BIT.fib6 | BIT.fib3)) && x.fb != null) { const pk = x.k ? x.fb / x.k * 100 : 0;
      if (x.fb >= 6 || pk >= 3) D.push({ cle: "fib6", nom: "Riche en fibres", preuve: `${f1(x.fb)} g pour ${u}` });
      else if (x.fb >= 3 || pk >= 1.5) D.push({ cle: "fib3", nom: "Source de fibres", preuve: `${f1(x.fb)} g pour ${u}` }); }
    if (!(masque & (BIT.sucres0 | BIT.sucres5)) && x.s != null) {
      if (x.s <= .5) D.push({ cle: "sucres0", nom: "Sans sucres", preuve: `${f1(x.s)} g pour ${u}` });
      else if (x.s <= (x.liq ? 2.5 : 5)) D.push({ cle: "sucres5", nom: "Faible teneur en sucres", preuve: `${f1(x.s)} g pour ${u}` }); }
    if (!(masque & (BIT.gras0 | BIT.gras3)) && x.f != null) {
      if (x.f <= .5) D.push({ cle: "gras0", nom: "Sans matières grasses", preuve: `${f1(x.f)} g pour ${u}` });
      else if (x.f <= (x.liq ? 1.5 : 3)) D.push({ cle: "gras3", nom: "Faible teneur en matières grasses", preuve: `${f1(x.f)} g pour ${u}` }); }
    if (!(masque & BIT.sel) && x.se != null && x.se <= .3) D.push({ cle: "sel", nom: "Pauvre en sel", preuve: `${nb(x.se, 2)} g pour ${u}` });
    return D;
  }
  /* Positionnements : promesses et arguments regroupés, pour la grille des créneaux du rayon (bit = rang). */
  const A = {}; ARGUMENTS.forEach((a, i) => A[a.cle] = 1 << i);
  const POSITIONS = [
    { cle: "bio", nom: "Bio", court: "Bio", ar: A.bio },
    { cle: "vegetal", nom: "Végétarien ou végan", court: "Végétal", ar: A.vegan | A.vege },
    { cle: "gluten", nom: "Sans gluten", court: "Sans gluten", ar: A.gluten },
    { cle: "lactose", nom: "Sans lactose", court: "Sans lactose", ar: A.lactose },
    { cle: "proteine", nom: "Protéines mises en avant", court: "Protéiné", cl: MASQUE_PROT },
    { cle: "sucres", nom: "Sans sucres ou sans sucres ajoutés", court: "Moins de sucres", cl: BIT.sucresAj | BIT.sucres0 | BIT.sucres5 },
    { cle: "fibres", nom: "Fibres mises en avant", court: "Fibres", cl: BIT.fib6 | BIT.fib3 },
    { cle: "allege", nom: "Allégé ou pauvre en matières grasses", court: "Allégé", cl: BIT.allege | BIT.gras0 | BIT.gras3 },
    { cle: "sansadd", nom: "Sans conservateurs, colorants ou additifs", court: "Sans additifs", ar: A.sansadd },
    { cle: "palme", nom: "Sans huile de palme", court: "Sans palme", ar: A.palme },
    { cle: "france", nom: "Origine France", court: "France", ar: A.france },
    { cle: "signe", nom: "Label Rouge, AOP ou IGP", court: "Label Rouge, AOP, IGP", ar: A.signe },
    { cle: "equitable", nom: "Commerce équitable", court: "Équitable", ar: A.equitable }
  ];
  function positions(cl, ar) {
    let m = 0;
    for (let i = 0; i < POSITIONS.length; i++) { const p = POSITIONS[i]; if ((p.cl && (cl & p.cl)) || (p.ar && (ar & p.ar))) m |= 1 << i; }
    return m;
  }

  const ETATS = { tenue: "Tenue", non: "Non tenue", limite: "À la limite", inv: "Invérifiable", nd: "Donnée manquante" };

  const M = { plat, norm, nb, f1, SEUIL, RICHE, PROMESSES, BIT, MASQUE_PROT, ARGUMENTS, arguments: arguments_, POSITIONS, positions, detecter, part, etat, detail, promesses, droits, ETATS };
  if (typeof module !== "undefined" && module.exports) module.exports = M; else racine.Moteur = M;
})(typeof globalThis !== "undefined" ? globalThis : this);
