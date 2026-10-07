/* ============================================================
   Fiche de positionnement d'un produit
   ============================================================ */
const API = "https://world.openfoodfacts.org/api/v2/product/";
const CHAMPS = "code,product_name,product_name_fr,generic_name_fr,brands,quantity,categories_tags,labels_tags,nutriments,nutriscore_grade,nova_group,unique_scans_n,created_t,image_front_small_url";
const eanValide = c => { if (!/^\d{8}$|^\d{12,14}$/.test(c)) return false; const d = c.split("").map(Number), cle = d.pop(); let s = 0; d.reverse().forEach((v, i) => s += v * (i % 2 ? 1 : 3)); return (10 - s % 10) % 10 === cle; };
const estCode = s => /^\d{6,14}$/.test(s.replace(/\s/g, ""));

function depuisOFF(p) {
  const n = p.nutriments || {}, num = v => { if (v == null || v === "") return null; v = Number(v); return isFinite(v) ? v : null; };
  let k = num(n["energy-kcal_100g"]); if (k == null && num(n["energy-kj_100g"]) != null) k = num(n["energy-kj_100g"]) / 4.184; if (k == null && num(n["energy_100g"]) != null) k = num(n["energy_100g"]) / 4.184;
  const nom = String(p.product_name_fr || p.product_name || p.generic_name_fr || "").trim(), marque = String(p.brands || "").split(",")[0].trim();
  const cats = p.categories_tags || [], labels = p.labels_tags || [], qte = p.quantity || "";
  const liq = /\d\s?(ml|cl|l|litres?)\b/i.test(qte) ? 1 : (/\d\s?(g|kg)\b/i.test(qte) ? 0 : (cats.includes("en:beverages") ? 1 : 0));
  const ns = "abcde".indexOf(p.nutriscore_grade || "?") + 1, d = p.created_t ? new Date(p.created_t * 1000) : null;
  const sel = num(n.salt_100g) != null ? num(n.salt_100g) : (num(n.sodium_100g) != null ? num(n.sodium_100g) * 2.5 : null);
  const r1 = v => v == null ? null : +v.toFixed(1);
  const x = P([String(p.code || ""), nom, marque, qte, k == null ? null : Math.round(k), r1(num(n.fat_100g)), r1(num(n["saturated-fat_100g"])), r1(num(n.sugars_100g)), r1(num(n.fiber_100g)), r1(num(n.proteins_100g)), sel == null ? null : +sel.toFixed(2),
    ns, p.nova_group >= 1 && p.nova_group <= 4 ? p.nova_group : 0, M.detecter(nom, labels), M.arguments(labels), p.unique_scans_n || 0, d ? (d.getUTCFullYear() % 100) * 100 + d.getUTCMonth() + 1 : 0, liq, -1, frontiere(cats).slice(0, 5)]);
  x.img = /^https:\/\/([a-z0-9-]+\.)*openfoodfacts\.org\//.test(p.image_front_small_url || "") ? p.image_front_small_url : null; x.direct = true; x.horsBase = true; return x;
}
async function dansLaBase(essais) {
  for (const c of essais) { try { const pq = await chargeCodes(c), l = pq.find(l => l[0] === c); if (l) return P(l); } catch (e) { /* fichier illisible : on tente la suite */ } }
  return null;
}
async function enDirect(code) {
  const arret = new AbortController(), minuteur = setTimeout(() => arret.abort(), 6000);
  try { const rep = await fetch(API + encodeURIComponent(code) + ".json?fields=" + CHAMPS, { signal: arret.signal }), j = await rep.json(); return j && j.status !== 0 && j.product ? depuisOFF(Object.assign({ code }, j.product)) : null; }
  finally { clearTimeout(minuteur); }
}
/* Un produit par son code-barres. Sur le site web, la fiche du jour est lue en direct sur Open Food Facts ;
   la base embarquée sert de repli, et fournit le groupe de la marque. */
async function trouverCode(code) {
  code = String(code).replace(/\s/g, "");
  const essais = [code, code.replace(/^0+/, ""), code.padStart(13, "0")].filter((c, i, a) => c && a.indexOf(c) === i);
  for (const c of essais) if (connus.has(c)) return connus.get(c);
  if (!EN_LIGNE) { const x = await dansLaBase(essais); return x ? retenir(x) : null; }
  const [local, direct] = await Promise.allSettled([dansLaBase(essais), enDirect(code)]);
  const b = local.status === "fulfilled" ? local.value : null, d = direct.status === "fulfilled" ? direct.value : null;
  // Marque, groupe et rayons restent ceux de la base : les repères de rayon ont été calculés avec eux.
  if (d && b) { const l = d.l.slice(); l[0] = b.c; if (b.m) l[2] = b.m; l[18] = b.l[18]; l[17] = (l[17] & 1) | (b.l[17] & 10); if (b.l[19] && b.l[19].length) l[19] = b.l[19]; const x = P(l); x.img = d.img; x.direct = true; return retenir(x); }
  if (d) return retenir(d);
  if (b) return retenir(b);
  if (direct.status === "rejected") throw direct.reason;
  return null;
}

/* ---------- Recherche d'un produit (accueil et vue Produit) ---------- */
let rech = null;
function zoneRecherche(id) {
  return `<div class="champ"><label class="sr" for="${id}">Nom, marque ou code-barres</label><input type="search" id="${id}" class="q-produit" placeholder="Nom, marque ou code-barres" autocomplete="off" enterkeyhint="search"><button type="button" class="b-produit">Chercher</button></div>
    <div class="suggestions s-produit"></div><p class="etat e-produit" role="status"></p>
    <div class="actions"><button type="button" class="bouton plein" data-scan><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M2 5v14M5 5v14M8 5v14M11 5v14M15 5v14M18 5v14M22 5v14" stroke="currentColor" stroke-width="2" fill="none"/></svg>Scanner un code-barres</button></div>`;
}
function majSuggProduits(zone) {
  const q = $(".q-produit", zone).value.trim(), el = $(".s-produit", zone), et = $(".e-produit", zone);
  et.classList.remove("alerte");
  if (!q) { el.innerHTML = ""; et.textContent = ""; return; }
  if (estCode(q)) { el.innerHTML = ""; et.textContent = "Code-barres reconnu. Appuyez sur Chercher."; return; }
  if (!rech) { et.textContent = "Chargement de la liste des produits…"; chargeRecherche().then(L => { rech = L; majSuggProduits(zone); }).catch(() => { et.textContent = "La liste des produits ne se charge pas. Essayez avec le code-barres."; et.classList.add("alerte"); }); return; }
  const mots = plat(q).split(/\s+/).filter(Boolean), L = [];
  for (const x of rech) { if (mots.every(m => x.t.includes(m))) { L.push(x); if (L.length >= 7) break; } }
  el.innerHTML = L.map(x => `<button type="button" class="sugg" data-code="${esc(x[0])}"><b>${esc(x[1])}<small>${esc(x[2] || "Marque non renseignée")} · ${esc(R[x[3]].nom)}</small></b></button>`).join("");
  et.textContent = L.length ? "" : `Aucun produit de ce nom parmi les ${nb(rech.length)} plus scannés. Essayez avec le code-barres du pack.`;
}
function lancerRecherche(zone) {
  const q = $(".q-produit", zone).value.trim(), et = $(".e-produit", zone);
  if (!q) { et.textContent = "Tapez un nom, une marque ou un code-barres."; et.classList.add("alerte"); return; }
  if (estCode(q)) return ouvrirCode(q.replace(/\s/g, ""), null, et);
  const premier = $(".s-produit .sugg", zone); if (premier) ouvrirCode(premier.dataset.code, null, et); else majSuggProduits(zone);
}
async function ouvrirCode(code, rayon, et) {
  if (et) { et.classList.remove("alerte"); et.textContent = "Recherche du produit…"; }
  let x = null, erreur = false;
  try { x = await trouverCode(code); } catch (e) { erreur = true; }
  if (!x) {
    const msg = erreur ? `Le code-barres ${code} n'est pas dans la base embarquée, et Open Food Facts ne répond pas. Vérifiez la connexion.`
      : EN_LIGNE ? `Le code-barres ${code} est inconnu d'Open Food Facts. Vérifiez les chiffres, ou cherchez le produit par son nom.`
      : `Le code-barres ${code} n'est pas dans la base embarquée (état au ${DATE}). Sur la version en ligne de l'outil, il est lu en direct sur Open Food Facts.`;
    if (et) { et.textContent = msg; et.classList.add("alerte"); } else { aller({ vue: "produit" }); const e2 = $("#v-produit .e-produit"); if (e2) { e2.textContent = msg; e2.classList.add("alerte"); } }
    return;
  }
  if (et) et.textContent = "";
  aller({ vue: "produit", code: x.c, r: rayon != null ? rayon : rayonParDefaut(x.fr) });
}

/* ---------- Produits récents et relevé (gardés dans le navigateur) ---------- */
const lire = (cle, def) => { try { const v = JSON.parse(localStorage.getItem(cle)); return v == null ? def : v; } catch (e) { return def; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage indisponible : on garde en mémoire */ } };
let recents = lire("barometre.recents", []).filter(l => Array.isArray(l)), releve = lire("barometre.releve", []).filter(e => e && Array.isArray(e.l));
recents.forEach(l => retenir(P(l))); releve.forEach(e => retenir(P(e.l)));
function noterRecent(x) { recents = [x.l].concat(recents.filter(l => l[0] !== x.c)).slice(0, 8); ecrire("barometre.recents", recents); }
function majPastille() { $$("[data-nb-releve]").forEach(p => { p.textContent = releve.length; p.hidden = !releve.length; }); }
const dansReleve = c => releve.some(e => e.l[0] === c);
function basculerReleve(x, r) { if (dansReleve(x.c)) releve = releve.filter(e => e.l[0] !== x.c); else releve.push({ l: x.l, r: r == null ? null : r }); ecrire("barometre.releve", releve); majPastille(); }

/* ---------- Vue Produit ---------- */
let courant = null;   // produit affiché et rayon de comparaison
let ongletProduit = "position";
function voisins(x, prods, S) {
  const C = ["s", "f", "p", "k"], ei = c => { const q = S.q[c]; return q ? (q[15] - q[5]) || (q[18] - q[2]) || 1 : 1; };
  const dist = y => { let d = 0, n = 0; for (const c of C) if (x[c] != null && y[c] != null) { d += Math.pow((x[c] - y[c]) / ei(c), 2); n++; } return n >= 2 ? d / n : Infinity; };
  const autres = prods.filter(y => y.c !== x.c);
  const proches = autres.map(y => [dist(y), y]).filter(a => isFinite(a[0])).sort((a, b) => a[0] - b[0]).slice(0, 4).map(a => a[1]);
  let mieux;
  if (x.ns) mieux = autres.filter(y => y.ns && y.ns < x.ns);
  else mieux = autres.filter(y => x.s != null && y.s != null && y.s < x.s * .8 && y.ns && y.ns <= 3);
  return { proches, mieux: mieux.sort((a, b) => a.ns - b.ns || b.sc - a.sc).slice(0, 3) };
}
async function voirProduit() {
  montrer("produit"); const el = $("#v-produit");
  if (!etat.code) {
    el.innerHTML = `<div class="tete"><p class="surtitre">Fiche de positionnement</p><h1 tabindex="-1">Situer un produit</h1>
      <p class="sous">Scannez le code-barres d'un produit en magasin, ou cherchez-le par son nom. La fiche le place face à son rayon : composition, Nutri-Score, promesses du pack, voisins les plus proches.</p></div>
      <div class="entree rp" style="margin-top:12px">${zoneRecherche("q-produit-2")}</div>
      ${recents.length ? `<section><h2>Derniers produits consultés</h2><div class="lignes">${recents.map(l => ligneProduit(retenir(P(l)))).join("")}</div></section>` : ""}`;
    return;
  }
  el.innerHTML = `<p class="attente" role="status">Lecture de la fiche…</p>`;
  const code = etat.code; let x = null;
  try { x = await trouverCode(code); } catch (e) { x = null; }
  if (etat.vue !== "produit" || etat.code !== code) return;
  if (!x) { el.innerHTML = `<div class="tete"><p class="surtitre">Fiche de positionnement</p><h1 tabindex="-1">Produit introuvable</h1></div><p class="vide">Le code-barres ${esc(code)} n'est pas dans la base embarquée${EN_LIGNE ? ", et Open Food Facts ne le connaît pas ou ne répond pas" : ""}.</p><div class="entree rp" style="margin-top:12px">${zoneRecherche("q-produit-2")}</div>`; return; }
  noterRecent(x); courant = { x, r: null };
  let rI = etat.r != null && R[etat.r] ? etat.r : rayonParDefaut(x.fr);
  const r = rI != null ? R[rI] : null;
  // Rayons proposés : ceux du produit, puis la lignée du rayon choisi
  const choix = []; if (r) choix.push(r.i); x.fr.slice(0, 4).forEach(i => { if (!choix.includes(i)) choix.push(i); });
  const defaut = rayonParDefaut(x.fr); if (defaut != null && !choix.includes(defaut)) choix.push(defaut);
  if (r) lignee(r).reverse().slice(0, 3).forEach(a => { if (!choix.includes(a.i)) choix.push(a.i); });
  choix.sort((a, b) => R[a].n - R[b].n);
  const fabriqueTete = () => `<div class="tete">${r ? filAriane(r, true) : `<nav class="fil"><button type="button" data-vue="accueil">Rayons</button></nav>`}
    <p class="surtitre">Fiche de positionnement</p>
    <div class="produit">${vignette(x, true)}<div class="produit-nom">${x.m && plat(x.m) !== plat(x.titre) ? `<b>${esc(x.m)}${x.g >= 0 && B.groupes[x.g][0] !== x.m ? `<span class="discret" style="font-weight:400"> · ${esc(B.groupes[x.g][0])}</span>` : ""}${x.mdd ? `<span class="etiq mdd">MDD</span>` : ""}</b>` : ""}<h1 tabindex="-1">${esc(x.titre)}</h1><span>${x.q ? esc(x.q) + " · " : ""}Code-barres ${esc(x.c)}${x.direct ? " · fiche lue en direct" : ""}</span></div></div>
    <div class="actions"><button type="button" class="bouton jaune" id="p-releve" aria-pressed="${dansReleve(x.c)}">${dansReleve(x.c) ? "Retirer du relevé" : "Ajouter au relevé"}</button><button type="button" class="bouton" data-scan>Scanner un autre</button><a class="bouton" href="https://fr.openfoodfacts.org/produit/${encodeURIComponent(x.c)}" target="_blank" rel="noopener">Fiche source</a></div></div>
    ${!x.act && !x.horsBase ? `<p class="alerte-fiche calme">Aucun scan en ${B.meta.annee} sur Open Food Facts : ce produit n'est peut-être plus en rayon. Il ne compte pas dans les références actives.</p>` : ""}
    ${x.bad ? `<p class="alerte-fiche">Fiche à vérifier : ses valeurs nutritionnelles ne sont pas cohérentes entre elles. Elle n'entre pas dans les repères du rayon, et les positions ci-dessous sont à prendre avec réserve.</p>` : ""}`;
  const pr = M.promesses(x, x.cl), dr = M.droits(x, x.cl), args = M.ARGUMENTS.filter((a, i) => x.ar & (1 << i));
  const blocPacks = `<section aria-labelledby="t-pp"><h2 id="t-pp">Ce que dit son pack</h2>
    ${args.length ? `<div class="puces">${args.map(a => `<span class="puce" style="cursor:default">${esc(a.nom)}</span>`).join("")}</div>` : ""}
    ${pr.length ? `<div style="margin-top:14px;max-width:760px">${pr.map(c => `<div class="promesse"><b>${esc(c.nom)}</b><span class="pastille-etat ${c.etat}">${M.ETATS[c.etat]}</span><p>${esc(c.detail)}</p></div>`).join("")}</div>` : `<p class="intro">${args.length ? "Aucune promesse nutritionnelle repérée" : "Ni promesse nutritionnelle ni argument repérés"} dans le nom ou les labels de la fiche.</p>`}
    ${dr.length ? `<h3 style="margin-top:22px">Ce que le pack aurait le droit d'écrire</h3><p class="intro">Seuils atteints d'après la fiche, sans que le nom ni les labels le disent.</p><ul class="droits" style="max-width:640px">${dr.map(d => `<li><b>${esc(d.nom)}</b><span>${esc(d.preuve)}</span></li>`).join("")}</ul>` : ""}
    <p class="note">Seuils de l'annexe du règlement (CE) n° 1924/2006. Le tableau nutritionnel du pack fait foi.</p></section>`;
  if (!r) { el.innerHTML = fabriqueTete() + `<p class="vide" style="margin-top:20px">Ce produit n'appartient à aucun rayon d'au moins ${B.meta.min} références : pas de repères pour le situer. Ses valeurs : ${["k", "s", "f", "se", "p"].map(c => MET[c].nom.toLowerCase() + " " + val(c, x[c])).join(", ")}.</p>` + blocPacks; return; }
  el.innerHTML = fabriqueTete() + `<p class="attente" role="status">Lecture du rayon ${esc(r.nom)}…</p>`;
  let lot; try { lot = await chargeLot(r.lot); } catch (e) { el.innerHTML = fabriqueTete() + `<p class="vide">Les repères du rayon ${esc(r.nom)} ne se chargent pas. Vérifiez la connexion.</p>` + blocPacks; return; }
  if (etat.vue !== "produit" || etat.code !== code) return;
  const repli = base === "act" && !statsDe(lot, r.i), S = statsDe(lot, r.i) || lot.r[r.i], prods = S.top.map(k => retenir(P(lot.p[k]))), par = r.par >= 0 ? R[r.par] : null;
  const nsConnu = S.n - S.ns[5], mieuxOuEgal = x.ns && nsConnu ? S.ns.slice(0, x.ns).reduce((a, b) => a + b, 0) / nsConnu * 100 : null;
  const rgMq = x.m ? S.mq.findIndex(b => plat(b[0]) === plat(x.m)) : -1, mq = rgMq >= 0 ? S.mq[rgMq] : null;
  const faits = `<dl class="faits">
    <div><dt>Nutri-Score</dt><dd>${badgeNS(x.ns, true)} <small>${mieuxOuEgal != null ? `${pc(mieuxOuEgal)} du rayon fait aussi bien ou mieux` : "non calculé sur la fiche"}</small></dd></div>
    <div><dt>Transformation (NOVA)</dt><dd>${x.nova || "?"} <small>${x.nova ? ["", "brut ou peu transformé", "ingrédient culinaire", "transformé", "ultra-transformé"][x.nova] : "non renseigné"}</small></dd></div>
    <div><dt>Sa marque dans le rayon</dt><dd>${mq ? `${rgMq + 1}<sup>${rgMq ? "e" : "re"}</sup> <small>${nb(mq[1])} références, ${pc(mq[1] / S.nm * 100, 1)}</small>` : `<small>${x.m ? "hors des quinze premières marques" : "marque non renseignée"}</small>`}</dd></div>
    <div><dt>Scans Open Food Facts</dt><dd>${nb(x.sc)} <small>${S.sc ? pc(x.sc / S.sc * 100, 1) + " des scans du rayon" : ""}</small></dd></div></dl>`;
  const v = voisins(x, prods, S);
  const P_ = (nom, html) => `<div class="panneau" data-panneau="${nom}">${html}</div>`;
  el.innerHTML = fabriqueTete()
    + `<section><h2>Comparé au rayon</h2><div class="puces" role="group" aria-label="Rayon de comparaison">${choix.map(i => `<button type="button" class="puce" data-rayon-produit="${i}" aria-pressed="${i === r.i}">${esc(R[i].nom)} <span>${nb(R[i].n)}</span></button>`).join("")}</div>
      <div class="zone-bascule">${bascule()}<p>${repli ? `Trop peu de références actives dans ce rayon (${nb(r.n)}) : repères calculés sur ses ${nb(S.n)} fiches.` : base === "act" ? `Repères calculés sur les références actives du rayon.` : "Repères calculés sur toutes les fiches du rayon."}</p></div></section>`
    + faits + segments([["position", "Position"], ["pack", "Pack"], ["voisins", "Voisins"]], ongletProduit, true)
    + P_("position", `<section aria-labelledby="t-pos"><h2 id="t-pos">Sa position dans le rayon ${esc(r.nom)}</h2>
      <p class="intro">Face aux ${base === "act" && !repli ? `${nb(S.n)} références actives` : `${nb(S.n)} fiches`} du rayon, valeurs pour ${x.liq ? "100 ml" : "100 g"}.</p>
      <div class="bandes">${ORDRE_BANDES.map(c => bande(c, S.q[c], S.qn[c], { moi: x[c] == null ? null : x[c] })).join("")}</div>${legendeBandes(null, true)}</section>
      <section><h2>Sur la carte du rayon</h2><div class="carte-zone" id="p-carte"></div>
      <ul class="legende"><li><i class="l-pt rouge"></i>Ce produit</li><li><i class="l-pt bleu"></i>Met la protéine en avant</li><li><i class="l-pt"></i>Les autres références les plus scannées</li></ul></section>`)
    + P_("pack", blocPacks)
    + P_("voisins", `<section aria-labelledby="t-vois"><h2 id="t-vois">Ses voisins de rayon</h2>
      <div class="duo"><div><h3>Les plus proches par la composition</h3>${v.proches.length ? `<div class="lignes">${v.proches.map(y => ligneProduit(y, r.i)).join("")}</div>` : `<p class="vide">Pas assez de valeurs sur la fiche pour chercher des voisins.</p>`}</div>
      <div><h3>${x.ns ? "Mieux notés au Nutri-Score" : "Moins sucrés et bien notés"}</h3>${v.mieux.length ? `<div class="lignes">${v.mieux.map(y => ligneProduit(y, r.i)).join("")}</div>` : `<p class="vide">${x.ns && x.ns <= 1 ? "Ce produit a déjà la meilleure note." : "Aucune des références les plus scannées du rayon ne fait mieux."}</p>`}</div></div>
      <p class="note">Voisins cherchés parmi les ${nb(prods.length)} références les plus scannées du rayon.</p>
      <div class="actions"><button type="button" class="bouton" data-rayon-fiche="${r.i}">Ouvrir la fiche du rayon ${esc(r.nom)}</button></div></section>`)
    + `<p class="note">${x.direct ? "Fiche lue en direct ; repères du rayon" : "Fiche et repères"} : Open Food Facts, état de la base au ${DATE}. Fiches saisies par des bénévoles, une valeur peut être fausse ou datée.</p>`;
  ongletProduit = choisirOnglet(el, ongletProduit, true);
  nuage($("#p-carte"), prods, "s", "pp", () => true, x);
  ctx = { r, S, lot, prods, par, Spar: null }; courant.r = r.i;
  const t = $("h1", el); if (t) t.focus({ preventScroll: true });
}

/* ---------- Relevé ---------- */
function voirReleve() {
  montrer("releve"); const el = $("#v-releve");
  const tete = corps => `<div class="tete"><p class="surtitre">Relevé de linéaire</p><h1 tabindex="-1">Mon relevé</h1>${corps}</div>`;
  if (!releve.length) { el.innerHTML = tete(`<p class="sous">Ajoutez des produits depuis leur fiche pour les comparer ici côte à côte, puis exportez le tableau. Pratique pour un tour de magasin : un scan, un ajout, et le relevé se remplit.</p><div class="actions"><button type="button" class="bouton jaune" data-scan>Scanner un premier produit</button><button type="button" class="bouton" data-vue="produit">Chercher un produit</button></div>`); return; }
  const L = releve.map(e => ({ x: retenir(P(e.l)), r: e.r != null && R[e.r] ? R[e.r] : null }));
  const lignes = L.map(({ x, r }) => `<tr><td><button type="button" class="lien" data-code="${esc(x.c)}"${r ? ` data-rayon="${r.i}"` : ""}>${esc(x.titre)}</button><span class="cellule-pos">${esc(x.m || "Marque non renseignée")}${x.q ? " · " + esc(x.q) : ""}</span></td>
    <td>${r ? esc(r.nom) : "<span class=\"discret\">Aucun</span>"}</td>
    ${["k", "s", "f", "se", "pp"].map(c => `<td class="n">${x[c] == null ? "n. d." : nb(x[c], MET[c].d)}${r ? `<span class="cellule-pos" data-pos="${esc(x.c)}|${r.i}|${c}"></span>` : ""}</td>`).join("")}
    <td>${badgeNS(x.ns)}</td><td>${M.promesses(x, x.cl).map(c => `<span class="pastille-etat ${c.etat}" title="${esc(c.nom)} : ${M.ETATS[c.etat]}">${esc(c.nom)}</span>`).join(" ") || `<span class="discret">Aucune</span>`}</td>
    <td><button type="button" class="retirer" data-retirer="${esc(x.c)}" aria-label="Retirer ${esc(x.titre)} du relevé">×</button></td></tr>`).join("");
  el.innerHTML = tete(`<p class="sous">${pluriel(L.length, "produit relevé", "produits relevés")}. Sous chaque valeur, la part de son rayon que le produit dépasse${base === "act" ? ", parmi les références actives" : ""}.</p>
    <div class="actions"><button type="button" class="bouton jaune" id="rl-csv">Exporter (CSV)</button><button type="button" class="bouton" data-scan>Scanner un produit</button><button type="button" class="bouton" id="rl-vider">Vider le relevé</button></div><div id="rl-retour" role="status"></div>`)
    + `<section><div class="table-zone" style="margin-top:0"><table class="releve-table"><thead><tr><th>Produit</th><th>Rayon</th><th class="n">kcal</th><th class="n">Sucres (g)</th><th class="n">Mat. grasses (g)</th><th class="n">Sel (g)</th><th class="n">Protéines / calories (%)</th><th>Nutri-Score</th><th>Promesses</th><th></th></tr></thead><tbody>${lignes}</tbody></table></div>
    <p class="note">Le relevé est gardé dans ce navigateur, sur cet appareil. Valeurs pour 100 g ou 100 ml.</p></section>`;
  // Positions dans le rayon, une fois les repères chargés
  new Set(L.filter(e => e.r).map(e => e.r.lot)).forEach(n => chargeLot(n).then(lot => {
    $$("[data-pos]", el).forEach(s => { const [c, ri, m] = s.dataset.pos.split("|"), S = statsDe(lot, ri) || lot.r[ri], x = connus.get(c); if (!S || !x || x[m] == null || !S.q[m]) return; s.textContent = "au-dessus de " + nb(rang(S.q[m], x[m])) + I + "%"; });
  }).catch(() => {}));
}

/* ---------- Enregistrer un fichier, copier un texte ---------- */
function montrerCopie(cible, texte, message) {
  cible.innerHTML = `<p class="etat">${esc(message)}</p><textarea class="copie" readonly aria-label="Texte à copier"></textarea>`;
  const t = $("textarea", cible); t.value = texte; t.focus(); t.select();
}
async function enregistrer(nom, texte, cible) {
  cible.innerHTML = "";
  if (window.claude && typeof window.claude.use === "function") {
    let ns = null; try { ns = await window.claude.use("downloads"); } catch (e) { ns = null; }
    if (!ns) return montrerCopie(cible, texte, "L'enregistrement de fichier n'est pas disponible dans cette vue. Le tableau est sélectionné ci-dessous : copiez-le dans un tableur.");
    try { await ns.save({ filename: nom, data: "﻿" + texte }); cible.innerHTML = `<p class="etat">Fichier remis à votre appareil : ${esc(nom)}.</p>`; }
    catch (e) { if (e && e.code === "declined") { cible.innerHTML = `<p class="etat">Enregistrement annulé.</p>`; return; } montrerCopie(cible, texte, "L'enregistrement n'a pas abouti. Le tableau est sélectionné ci-dessous : copiez-le dans un tableur."); }
    return;
  }
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + texte], { type: "text/csv;charset=utf-8" })); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); cible.innerHTML = `<p class="etat">Fichier téléchargé : ${esc(nom)}.</p>`; }
  catch (e) { montrerCopie(cible, texte, "Le téléchargement n'a pas abouti. Le tableau est sélectionné ci-dessous : copiez-le dans un tableur."); }
}
function copier(texte, cible) {
  const echec = () => montrerCopie(cible, texte, "La copie automatique est refusée ici. Le texte est sélectionné : copiez-le.");
  try { navigator.clipboard.writeText(texte).then(() => { cible.innerHTML = `<p class="etat">Synthèse copiée. Collez-la dans un message ou une diapositive.</p>`; }, echec); } catch (e) { echec(); }
}
const nomFichier = s => plat(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/* ---------- Scanner ---------- */
let flux = null, lecture = false, dernier = null;
function scanEtat(t) { $("#scan-etat").textContent = t; }
async function ouvrirScanner() {
  $("#scanner").hidden = false; dernier = null; $("#scan-photo").value = "";
  scanEtat("Autorisez l'appareil photo, puis placez le code-barres dans le cadre."); $("#scan-fermer").focus();
  const repli = "L'appareil photo en direct n'est pas disponible ici. Prenez le code-barres en photo avec le bouton ci-dessous, ou fermez et tapez ses chiffres.";
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return scanEtat(repli);
  try { flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); }
  catch (e) { return scanEtat(repli); }
  if ($("#scanner").hidden) { arreterFlux(); return; }
  const video = $("#video"); video.srcObject = flux; try { await video.play(); } catch (e) { /* lecture différée */ }
  lecture = true; scanEtat("Placez le code-barres dans le cadre.");
  const det = await detecteurNatif(); if (det) return boucleNative(det, video);
  boucleQuagga(video);
}
async function detecteurNatif() {
  if (!("BarcodeDetector" in window)) return null;
  try { const f = await BarcodeDetector.getSupportedFormats(), voulus = ["ean_13", "ean_8", "upc_a"].filter(x => f.includes(x)); return voulus.length ? new BarcodeDetector({ formats: voulus }) : null; } catch (e) { return null; }
}
function boucleNative(det, video) {
  const tour = async () => { if (!lecture) return; try { const r = await det.detect(video); if (r.length && eanValide(r[0].rawValue)) return trouve(r[0].rawValue); } catch (e) { /* image pas prête */ } setTimeout(tour, 180); };
  tour();
}
function quaggaImage(src, taille, grain) {
  return new Promise(res => { if (typeof Quagga === "undefined") return res(null);
    Quagga.decodeSingle({ src, numOfWorkers: 0, locate: true, locator: { patchSize: grain || "medium", halfSample: true }, inputStream: { size: taille }, decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader"] } }, r => res(r && r.codeResult && r.codeResult.code || null)); });
}
function boucleQuagga(video) {
  if (typeof Quagga === "undefined") return scanEtat("La lecture automatique n'est pas disponible sur ce navigateur. Prenez le code-barres en photo, ou tapez ses chiffres.");
  const toile = document.createElement("canvas"), c2 = toile.getContext("2d");
  const tour = async () => {
    if (!lecture) return; const w = video.videoWidth, h = video.videoHeight; if (!w || !h) return setTimeout(tour, 200);
    const k = Math.min(1, 960 / w); toile.width = Math.round(w * k); toile.height = Math.round(h * k); c2.drawImage(video, 0, 0, toile.width, toile.height);
    const code = await quaggaImage(toile.toDataURL("image/jpeg", .85), toile.width); if (!lecture) return;
    if (code && eanValide(code)) { if (code === dernier) return trouve(code); dernier = code; }
    setTimeout(tour, 120);
  };
  tour();
}
// Une photo de téléphone est grande et le code-barres y est petit : on essaie l'image entière, puis des recadrages.
async function lirePhoto(fichier) {
  if (!fichier) return; scanEtat("Lecture de la photo…");
  let code = null;
  try { const det = await detecteurNatif(); if (det) { const bmp = await createImageBitmap(fichier), r = await det.detect(bmp); if (r.length && eanValide(r[0].rawValue)) code = r[0].rawValue; } } catch (e) { code = null; }
  if (!code && typeof Quagga !== "undefined") {
    const url = URL.createObjectURL(fichier), img = new Image();
    try {
      img.src = url; await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight, toile = document.createElement("canvas"), c2 = toile.getContext("2d");
      const essais = [[0, 0, 1, 1, 1280, "medium"], [.2, .2, .6, .6, 1280, "medium"], [.3, .3, .4, .4, 1280, "medium"], [0, 0, 1, 1, 2400, "x-large"], [.2, .2, .6, .6, 1600, "large"]];
      for (const y of [0, .25, .5]) for (const x of [0, .25, .5]) essais.push([x, y, .5, .5, 1280, "medium"]);
      for (const [zx, zy, zw, zh, t, grain] of essais) {
        const k = Math.min(1, t / Math.max(W * zw, H * zh)); toile.width = Math.round(W * zw * k); toile.height = Math.round(H * zh * k);
        c2.drawImage(img, W * zx, H * zy, W * zw, H * zh, 0, 0, toile.width, toile.height);
        const c = await quaggaImage(toile.toDataURL("image/jpeg", .9), Math.max(toile.width, toile.height), grain);
        if (c && eanValide(c)) { code = c; break; }
      }
    } catch (e) { code = null; }
    URL.revokeObjectURL(url);
  }
  if (code) return trouve(code);
  scanEtat("Aucun code-barres lisible sur cette photo. Cadrez le code de près, bien à plat et net, ou tapez ses chiffres.");
}
function arreterFlux() { lecture = false; if (flux) { flux.getTracks().forEach(t => t.stop()); flux = null; } const v = $("#video"); if (v) v.srcObject = null; }
function fermerScanner() { arreterFlux(); $("#scanner").hidden = true; }
function trouve(code) { fermerScanner(); try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* sans vibreur */ } ouvrirCode(code, etat.vue === "rayon" ? etat.r : null, null); }

/* ---------- Méthode ---------- */
function rendreMethode() {
  const m = B.meta, ex = Object.values(m.exclus).reduce((a, b) => a + b, 0);
  $("#methode-corps").innerHTML = `
    <section><h2>L'application</h2><ul class="methode">
      <li>${EN_LIGNE ? "Cette version web s'installe sur un téléphone : une icône sur l'écran d'accueil, un affichage plein écran, et les rayons déjà ouverts restent consultables sans réseau." : "Cette version tourne dans Claude, avec toutes ses données embarquées. La version web, elle, s'installe sur un téléphone comme une application."}</li>
      <li>${EN_LIGNE ? "Le scan utilise l'appareil photo en direct, et le produit scanné est lu sur Open Food Facts à l'instant du scan." : "Ici, le scan passe par une photo du code-barres, et seuls les produits de la base embarquée sont reconnus."}</li></ul></section>
    <section><h2>La source</h2><ul class="methode">
      <li><strong>Open Food Facts</strong>, base ouverte et collaborative de produits alimentaires, sous licence ODbL. Seules des données ouvertes sont utilisées.</li>
      <li>Périmètre : les produits déclarés vendus en France, avec au moins une catégorie et une valeur énergétique. ${nb(m.lus)} fiches lues, ${nb(m.gardes)} retenues.</li>
      <li><strong>Références actives</strong> : ${nb(m.actives)} fiches, soit ${pc(m.actives / m.gardes * 100)} des fiches retenues. Une fiche est dite active si le produit a été scanné en ${m.annee} par les utilisateurs d'Open Food Facts, ou si elle a été créée depuis le 1<sup>er</sup> janvier ${m.annee}. Les autres sont, pour beaucoup, des produits arrêtés ou reformulés qui restent dans la base.</li>
      <li>Par défaut, les repères portent sur les références actives : c'est le rayon tel qu'il se vend aujourd'hui. L'interrupteur <strong>Toutes les fiches</strong> rend l'historique complet, utile pour les petits rayons et pour voir ce qui a disparu.</li>
      <li>Limite de ce filtre : un produit peu scanné mais toujours vendu peut sortir des références actives. Les petites marques et les produits de niche sont les premiers concernés.</li>
      <li><strong>État de la base : ${DATE}.</strong> Les repères viennent de l'export complet d'Open Food Facts, lu le ${dateFr(m.collecte)}. Un produit ajouté depuis n'y figure pas${EN_LIGNE ? " ; il est tout de même lu en direct quand on le scanne" : ""}.</li>
      <li>${nb(ex)} fiches écartées des repères : ${Object.entries(m.exclus).map(([k, v]) => `${nb(v)} pour ${k}`).join(", ")}. Elles restent consultables par leur code-barres, avec un avertissement.</li></ul></section>
    <section><h2>Les rayons</h2><ul class="methode">
      <li>Un rayon est une catégorie d'Open Food Facts qui réunit au moins ${m.min} fiches retenues : ${nb(m.rayons)} rayons. ${nb(R.filter(r => r.bases.act).length)} d'entre eux comptent au moins ${m.minAct} références actives, le minimum pour calculer leurs repères sur cette base.</li>
      <li>Un produit porte plusieurs catégories, de la plus large à la plus précise. Il compte dans chacune : les effectifs de deux rayons ne s'additionnent pas.</li>
      <li>Un rayon est rattaché au plus petit rayon plus large qui contient au moins 90 % de ses produits. C'est ce lien qui donne le fil d'Ariane et la comparaison au rayon parent.</li>
      <li>Un produit scanné est situé d'abord dans son rayon le plus précis. Les autres rayons auxquels il appartient sont proposés sur sa fiche.</li></ul></section>
    <section><h2>Les indicateurs</h2><ul class="methode">
      <li><strong>Composition</strong> : médianes et répartitions des valeurs pour 100 g ou 100 ml. La part des calories venant des protéines vaut protéines × 4, divisé par les calories.</li>
      <li><strong>Marques</strong> : première marque citée sur la fiche. Le rattachement à un groupe ou à une enseigne est indicatif (état d'octobre 2026) et ne couvre que les marques les plus répandues ; une marque non rattachée compte seule.</li>
      <li><strong>Part des références</strong> : nombre de fiches, pas nombre de ventes. Une marque avec beaucoup de formats pèse plus lourd.</li>
      <li><strong>Scans</strong> : compteur de scans uniques d'Open Food Facts, sur la dernière année où le produit a été scanné. Il reflète l'attention des utilisateurs de l'application, plus attentifs à la nutrition que la moyenne. Ce n'est pas une part de marché.</li>
      <li><strong>Arguments</strong> : bio, végétal, sans gluten, origine France et autres, lus dans les labels de la fiche.</li>
      <li><strong>Promesses nutritionnelles</strong> : repérées dans le nom et les labels, puis comparées aux seuils de l'annexe du règlement (CE) n° 1924/2006. Protéines : 12 % des calories (source) et 20 % (riche). Fibres : 3 g et 6 g pour 100 g, ou 1,5 g et 3 g pour 100 kcal. Sucres : 5 g (2,5 g pour 100 ml) et 0,5 g. Matières grasses : 3 g (1,5 g pour 100 ml) et 0,5 g. Sel : 0,3 g. « Sans sucres ajoutés », « sans sel ajouté » et « allégé » ne se vérifient pas par le calcul.</li>
      <li><strong>Nouveaux entrants</strong> : fiches créées dans les douze mois avant le ${DATE}. La date est celle de l'entrée dans la base, pas celle du lancement.</li></ul></section>
    <section><h2>Les limites</h2><ul class="methode">
      <li>Ni ventes, ni prix, ni promotions, ni distribution : ces données appartiennent aux panels et aux enseignes. L'outil ne les remplace pas, il donne une première lecture de l'offre.</li>
      <li>Les fiches sont saisies par des bénévoles et par certains fabricants. Une valeur peut être fausse, un produit retiré de la vente peut rester dans la base.</li>
      <li>Un argument écrit sur le pack mais absent de la fiche n'est pas compté : les parts d'arguments et de promesses sont des planchers.</li>
      <li>Les catégories sont posées par les contributeurs. Deux produits voisins peuvent être rangés dans deux rayons différents.</li></ul></section>`;
}

/* ============================================================
   Événements
   ============================================================ */
document.addEventListener("click", ev => {
  const t = ev.target, zone = t.closest(".rp, .entree");
  let e;
  if (t.closest("[data-scan]")) return ouvrirScanner();
  if (t.closest("#scan-fermer")) return fermerScanner();
  if ((e = t.closest("[data-base]"))) { if (e.dataset.base === base) return; base = e.dataset.base === "tout" ? "tout" : "act"; try { localStorage.setItem("barometre.base", base); } catch (err) { /* stockage indisponible */ }
    appliquerBase(); rendreAccueil(); rendre(); return; }
  if ((e = t.closest("[data-deplier]"))) { const r = R[+e.dataset.deplier], n = e.closest(".noeud"), ouvert = e.getAttribute("aria-expanded") === "true"; let c = $(":scope > .noeud-enfants", n);
    if (!c) { c = document.createElement("div"); c.className = "noeud-enfants"; c.innerHTML = r.enf.filter(x => x.n > 0).map(noeud).join(""); n.appendChild(c); }
    c.hidden = ouvert; e.setAttribute("aria-expanded", String(!ouvert)); e.textContent = ouvert ? "+" : "−"; return; }
  if ((e = t.closest("[data-onglet]"))) { const vue = e.closest(".vue"), nom = choisirOnglet(vue, e.dataset.onglet, true); if (vue.id === "v-rayon") ongletRayon = nom; else if (vue.id === "v-produit") ongletProduit = nom; return; }
  if ((e = t.closest("[data-rayon-produit]"))) return aller({ vue: "produit", code: etat.code, r: +e.dataset.rayonProduit });
  if ((e = t.closest("[data-rayon-fiche]"))) return aller({ vue: "rayon", r: +e.dataset.rayonFiche });
  if ((e = t.closest("[data-retirer]"))) { releve = releve.filter(x => x.l[0] !== e.dataset.retirer); ecrire("barometre.releve", releve); majPastille(); return voirReleve(); }
  if ((e = t.closest("[data-code]"))) { if (e.closest("svg")) fermerBulle(); return ouvrirCode(e.dataset.code, e.dataset.rayon != null ? +e.dataset.rayon : (e.closest("svg") && ctx ? ctx.r.i : null), zone ? $(".e-produit", zone) : null); }
  if ((e = t.closest("[data-vue]"))) return aller({ vue: e.dataset.vue });
  if (t.closest("#b-rayon")) { const s = $("#s-rayon .sugg"); if (s) return aller({ vue: "rayon", r: +s.dataset.rayonFiche }); return majSuggRayons(); }
  if (t.closest(".b-produit") && zone) return lancerRecherche(zone);
  if ((e = t.closest("[data-mesure]"))) { $$("[data-mesure]").forEach(b => b.setAttribute("aria-pressed", String(b === e))); $("#fabs").innerHTML = htmlFabs(ctx.S, e.dataset.mesure); return; }
  if ((e = t.closest("[data-marque]"))) { expl.marque = e.dataset.marque; expl.vus = 20; const s = $("#x-marque"); if (s) { s.value = expl.marque; if (s.value !== expl.marque) expl.marque = ""; } majExplorer(); ongletRayon = choisirOnglet($("#v-rayon"), "refs", true); window.scrollTo(0, 0); return; }
  if ((e = t.closest("[data-position]"))) { expl.pos = e.dataset.position; expl.vus = 20; $("#x-pos").value = expl.pos; majExplorer(); ongletRayon = choisirOnglet($("#v-rayon"), "refs", true); window.scrollTo(0, 0); return; }
  if (t.closest("#x-plus")) { expl.vus += 20; return majExplorer(); }
  if (t.closest("#b-installer") && invite) { const i = invite; invite = null; i.prompt(); if (i.userChoice) i.userChoice.then(majInstaller, majInstaller); return; }
  if (t.closest("#a-csv")) return enregistrer("barrometre-" + nomFichier(ctx.r.nom) + ".csv", csv(ctx.prods, () => ctx.r.nom), $("#a-retour"));
  if (t.closest("#a-synthese")) return copier(syntheseRayon(), $("#a-retour"));
  if (t.closest("#p-releve")) { basculerReleve(courant.x, courant.r); const b = $("#p-releve"), d = dansReleve(courant.x.c); b.setAttribute("aria-pressed", String(d)); b.textContent = d ? "Retirer du relevé" : "Ajouter au relevé"; return; }
  if (t.closest("#rl-csv")) return enregistrer("barrometre-releve.csv", csv(releve.map(x => connus.get(x.l[0]) || P(x.l)), x => { const e2 = releve.find(y => y.l[0] === x.c); return e2 && e2.r != null && R[e2.r] ? R[e2.r].nom : ""; }), $("#rl-retour"));
  if (t.closest("#rl-vider")) { const b = $("#rl-vider"); if (b.dataset.sur) { releve = []; ecrire("barometre.releve", releve); majPastille(); return voirReleve(); } b.dataset.sur = "1"; b.textContent = "Confirmer : tout retirer"; return; }
});
document.addEventListener("input", ev => {
  const t = ev.target;
  if (t.id === "q-rayon") return majSuggRayons();
  if (t.classList.contains("q-produit")) return majSuggProduits(t.closest(".rp, .entree"));
  if (t.id === "x-q") { expl.q = t.value; expl.vus = 20; return majExplorer(); }
});
document.addEventListener("change", ev => {
  const t = ev.target;
  if (t.id === "c-indic" || t.id === "c-champ" || t.id === "c-ordre") return rendreComparer();
  if (t.id === "sr-indic") return rendreRangs($("#sr-rangs"), ctx.r.enf, t.value, "desc", null, 0);
  if (t.id === "x-marque") { expl.marque = t.value; expl.vus = 20; return majExplorer(); }
  if (t.id === "x-pos") { expl.pos = t.value; expl.vus = 20; return majExplorer(); }
  if (t.id === "x-tri") { expl.tri = t.value; expl.vus = 20; return majExplorer(); }
  if (t.id === "x-x") { expl.x = t.value; return majExplorer(); }
  if (t.id === "x-y") { expl.y = t.value; return majExplorer(); }
  if (t.id === "scan-photo") return lirePhoto(t.files && t.files[0]);
});
document.addEventListener("keydown", ev => {
  const t = ev.target;
  if (ev.key === "Escape" && !$("#scanner").hidden) return fermerScanner();
  if (ev.key === "Enter" && t.id === "q-rayon") { ev.preventDefault(); return $("#b-rayon").click(); }
  if (ev.key === "Enter" && t.classList && t.classList.contains("q-produit")) { ev.preventDefault(); return lancerRecherche(t.closest(".rp, .entree")); }
  if ((ev.key === "Enter" || ev.key === " ") && t.matches && t.matches("circle.pt[data-code]")) { ev.preventDefault(); t.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
});
// Bulles du nuage de points : survol, focus clavier, toucher
function bullePoint(pt) {
  const zone = pt.closest(".carte-zone"), x = connus.get(pt.dataset.code); if (!zone || !x) return;
  const zr = zone.getBoundingClientRect(), pr = pt.getBoundingClientRect(), cx = zone.dataset.cx, cy = zone.dataset.cy;
  bulle(zone, pr.left + pr.width / 2 - zr.left, pr.top - zr.top, `<b>${esc(x.titre)}</b>${esc(x.m)}<br>${esc(MET[cx].nom)} : ${esc(val(cx, x[cx]))}<br>${esc(MET[cy].nom)} : ${esc(val(cy, x[cy]))}`);
}
document.addEventListener("pointerover", ev => { const pt = ev.target.closest && ev.target.closest("circle.pt[data-code]"); if (pt) bullePoint(pt); else if (!ev.target.closest || !ev.target.closest(".bulle")) fermerBulle(); });
document.addEventListener("focusin", ev => { const pt = ev.target.closest && ev.target.closest("circle.pt[data-code]"); if (pt) bullePoint(pt); });
addEventListener("pagehide", arreterFlux);

/* ---------- Installation sur le téléphone (version web uniquement) ---------- */
let invite = null;
function majInstaller() {
  const z = $("#zone-installer"); if (!z) return;
  const installee = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  if (!EN_LIGNE || installee) { z.innerHTML = ""; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (invite) z.innerHTML = `<div class="installer"><p><strong>Installer l'app.</strong> Une icône sur l'écran d'accueil, en plein écran, utilisable sans réseau pour les rayons déjà ouverts.</p><button type="button" class="bouton jaune" id="b-installer">Installer</button></div>`;
  else if (ios) z.innerHTML = `<div class="installer"><p><strong>Installer l'app sur l'iPhone.</strong> Dans Safari, touchez le bouton Partager, puis « Sur l'écran d'accueil ».</p></div>`;
  else z.innerHTML = "";
}
addEventListener("beforeinstallprompt", ev => { ev.preventDefault(); invite = ev; majInstaller(); });
addEventListener("appinstalled", () => { invite = null; majInstaller(); });
if (EN_LIGNE && "serviceWorker" in navigator) addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => { /* hors connexion indisponible, l'app marche quand même */ }); });

/* ---------- Lancement ---------- */
rendreAccueil(); majPastille(); majInstaller();
etat = depuisJeton(location.hash);
try { history.replaceState(etat, "", location.hash || "#"); } catch (e) { /* cadre sans historique */ }
rendre();
if (etat.vue === "accueil") { const a = document.activeElement; if (a && a.blur) a.blur(); }
})();
