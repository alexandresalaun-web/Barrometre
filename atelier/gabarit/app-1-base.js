(function () {
"use strict";
/* ============================================================
   Le Barromètre : relevé de rayon instantané.
   Les données viennent de la préparation (pipeline/prep.js) :
   l'index des rayons est dans la page, le reste se charge à la demande.
   ============================================================ */
const B = /*__INDEX__*/null;
const EN_LIGNE = /*__EN_LIGNE__*/false;   // vrai sur le site web : lecture en direct d'Open Food Facts
const D = "d/";
// Sur le site web, chaque fichier de données porte la version de la base : après une mise à jour, rien d'ancien ne peut être resservi.
const VD = EN_LIGNE ? "?v=" + encodeURIComponent(B.meta.v || B.meta.date) : "";
const M = Moteur, nb = M.nb, f1 = M.f1, plat = M.plat;
const $ = (s, e) => (e || document).querySelector(s), $$ = (s, e) => Array.from((e || document).querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const I = " ";
const pc = (v, d) => { if (v == null) return "n.\u00a0d."; d = d == null ? 0 : d; const bas = Math.pow(10, -d); return (v > 0 && v < bas / 2 ? "<" + I + nb(bas, d) : nb(v, d)) + I + "%"; };
const GRAND = () => !window.matchMedia || window.matchMedia("(min-width:720px)").matches;   // au-dessous : mise en page téléphone
const pluriel = (n, un, des) => nb(n) + I + (n > 1 ? des : un);
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dateFr = iso => { const [a, m, j] = iso.split("-").map(Number); return (j === 1 ? "1er" : j) + " " + MOIS[m - 1] + " " + a; };
const DATE = dateFr(B.meta.date);

/* ---------- Rayons ---------- */
/* Chaque rayon est calculé sur deux bases : « act », les références actives (scannées la dernière année connue, ou créées depuis),
   et « tout », toutes les fiches recensées. L'interrupteur choisit laquelle remplit les champs lus partout ailleurs (r.n, r.s, r.mdd…). */
const CHAMPS_IX = ["k", "s", "pp", "se", "f", "fb", "ab", "nova4", "mdd", "prot", "protOk", "bio", "neuf", "nmq", "top", "topPart"];
const R = B.rayons.map((r, i) => ({ i, tag: r[0], nom: r[1], nTout: r[2], par: r[3], lot: r[4], tr: r[5], nAct: r[6], bases: { tout: r[7], act: r[8] }, enf: [], cle: plat(r[1]) }));
R.forEach(r => { if (r.par >= 0) R[r.par].enf.push(r); });
let base = "act";
try { if (localStorage.getItem("barometre.base") === "tout") base = "tout"; } catch (e) { /* stockage indisponible */ }
function appliquerBase() {
  R.forEach(r => { const ix = r.bases[base]; r.n = base === "act" ? r.nAct : r.nTout; r.dispo = !!ix; CHAMPS_IX.forEach((c, j) => { r[c] = ix ? ix[j] : null; }); });
  R.forEach(r => r.enf.sort((a, b) => b.n - a.n));
}
appliquerBase();
const statsDe = (lot, i) => (base === "act" ? lot.a : lot.r)[i] || null;
const motRefs = n => base === "act" ? pluriel(n, "référence active", "références actives") : pluriel(n, "fiche", "fiches");
const bascule = () => `<div class="bascule" role="group" aria-label="Base de calcul"><button type="button" data-base="act" aria-pressed="${base === "act"}">Références actives</button><button type="button" data-base="tout" aria-pressed="${base === "tout"}">Toutes les fiches</button></div>`;
const parTag = new Map(R.map(r => [r.tag, r]));
const jeton = r => /^[a-z]{2}:[a-z0-9-]+$/.test(r.tag) ? "r." + r.tag.replace(":", ".") : "r._" + r.i;
const lignee = r => { const L = []; let u = r.par, g = 0; while (u >= 0 && g++ < 40) { L.unshift(R[u]); u = R[u].par; } return L; };
function frontiere(tags) {
  const rs = []; for (const t of new Set(tags || [])) { const r = parTag.get(t); if (r) rs.push(r); }
  const anc = new Set(); rs.forEach(r => lignee(r).forEach(a => anc.add(a.i)));
  return rs.filter(r => !anc.has(r.i)).sort((a, b) => a.tr - b.tr || a.n - b.n).map(r => r.i);
}

// Rayon de comparaison par défaut : le plus précis qui compte au moins 200 références, pour éviter les rayons d'une seule gamme.
function rayonParDefaut(fr) {
  const vus = new Set(), C = [];
  (fr || []).forEach(i => { const r = R[i]; if (!r) return; [r].concat(lignee(r)).forEach(a => { if (!vus.has(a.i)) { vus.add(a.i); C.push(a); } }); });
  if (!C.length) return null;
  const nets = C.filter(r => !r.tr), L = nets.length ? nets : C, gros = L.filter(r => r.n >= 200).sort((a, b) => a.n - b.n);
  return (gros[0] || L.sort((a, b) => b.n - a.n)[0]).i;
}

/* ---------- Indicateurs ---------- */
const MET = {
  k: { nom: "Calories", court: "Calories", u: "kcal", d: 0, plus: "Plus calorique", moins: "Moins calorique" },
  s: { nom: "Sucres", court: "Sucres", u: "g", d: 1, plus: "Plus sucré", moins: "Moins sucré" },
  f: { nom: "Matières grasses", court: "Mat. grasses", u: "g", d: 1, plus: "Plus gras", moins: "Moins gras" },
  a: { nom: "Acides gras saturés", court: "Saturés", u: "g", d: 1, plus: "Plus riche en saturés", moins: "Moins riche en saturés" },
  se: { nom: "Sel", court: "Sel", u: "g", d: 2, plus: "Plus salé", moins: "Moins salé" },
  p: { nom: "Protéines", court: "Protéines", u: "g", d: 1, plus: "Plus riche en protéines", moins: "Moins riche en protéines" },
  fb: { nom: "Fibres", court: "Fibres", u: "g", d: 1, plus: "Plus riche en fibres", moins: "Moins riche en fibres" },
  pp: { nom: "Calories venant des protéines", court: "Protéines / calories", u: "%", d: 1, plus: "Plus protéiné, à calories égales,", moins: "Moins protéiné, à calories égales," }
};
const val = (c, v) => v == null ? "n. d." : nb(v, MET[c].d) + I + MET[c].u;
const INDIC = [
  { c: "s", nom: "Sucres médians", u: "g", d: 1 }, { c: "k", nom: "Calories médianes", u: "kcal", d: 0 },
  { c: "pp", nom: "Calories venant des protéines (médiane)", u: "%", d: 1 }, { c: "se", nom: "Sel médian", u: "g", d: 2 },
  { c: "f", nom: "Matières grasses médianes", u: "g", d: 1 }, { c: "fb", nom: "Fibres médianes", u: "g", d: 1 },
  { c: "ab", nom: "Références notées Nutri-Score A ou B", u: "%", d: 0 }, { c: "nova4", nom: "Références ultra-transformées (NOVA 4)", u: "%", d: 0 },
  { c: "mdd", nom: "Poids des marques de distributeur", u: "%", d: 0 }, { c: "prot", nom: "Packs qui mettent la protéine en avant", u: "%", d: 1 },
  { c: "protOk", nom: "Promesses protéine tenues", u: "%", d: 0 }, { c: "bio", nom: "Références bio", u: "%", d: 0 },
  { c: "n", nom: "Nombre de références", u: "", d: 0 }, { c: "nmq", nom: "Nombre de marques", u: "", d: 0 }
];
const optionsIndic = sel => INDIC.map(x => `<option value="${x.c}"${x.c === sel ? " selected" : ""}>${esc(x.nom)}</option>`).join("");

/* ---------- Chargement à la demande ---------- */
const memo = new Map();
function charge(url) {
  if (!memo.has(url)) memo.set(url, fetch(url).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { memo.delete(url); throw e; }));
  return memo.get(url);
}
const pad3 = n => String(n).padStart(3, "0");
const photos = new Map();
B.vedettes.forEach(v => { if (v[1]) photos.set("v" + v[0], v[1]); });
const chargeLot = n => charge(D + "r/" + pad3(n) + ".json" + VD).then(l => { if (!l.vu) { l.vu = 1; for (const c in l.ph) photos.set(c, l.ph[c]); } return l; });
const chargeCodes = code => charge(D + "c/" + pad3((Number(String(code).slice(-4)) % B.meta.ncodes) || 0) + ".json" + VD);
const chargeRecherche = () => charge(D + "recherche.json" + VD).then(L => { if (!L.pret) { L.forEach(x => x.t = plat(x[1] + " " + x[2])); L.pret = 1; } return L; });

/* ---------- Produits ---------- */
function P(l) {
  l[0] = String(l[0] == null ? "" : l[0]).replace(/\D/g, "").slice(0, 14);   // un code-barres n'est fait que de chiffres : rien d'autre n'entre dans la page
  const x = { l, c: l[0], n: l[1] || "", m: l[2] || "", q: l[3] || "", k: l[4], f: l[5], a: l[6], s: l[7], fb: l[8], p: l[9], se: l[10], ns: l[11] || 0, nova: l[12] || 0, cl: l[13] || 0, ar: l[14] || 0, sc: l[15] || 0, ym: l[16] || 0, liq: !!(l[17] & 1), mdd: !!(l[17] & 2), bad: !!(l[17] & 4), act: !!(l[17] & 8), g: l[18], fr: l[19] || [] };
  x.pp = M.part(x); x.titre = x.n || x.m || "Produit sans nom"; return x;
}
const NSL = ["", "a", "b", "c", "d", "e"];
const badgeNS = (ns, grand) => `<span class="ns ${ns ? "ns-" + NSL[ns] : "ns-x"}${grand ? " grand" : ""}" title="Nutri-Score ${ns ? NSL[ns].toUpperCase() : "non calculé"}">${ns ? NSL[ns].toUpperCase() : "?"}</span>`;
const initiales = x => esc((x.m || x.n || "?").replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "").trim().slice(0, 2) || "?");
function vignette(x, grand) {
  const src = photos.get(x.c) || x.img;
  return `<span class="vignette${grand ? " grand" : ""}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : `<span class="initiales" aria-hidden="true">${initiales(x)}</span>`}</span>`;
}
function ligneProduit(x, r, faits) {
  const f = faits || [["s", "sucres"], ["pp", "prot."]];
  return `<button type="button" class="ligne" data-code="${esc(x.c)}"${r != null ? ` data-rayon="${r}"` : ""}>
    ${vignette(x)}
    <span class="ligne-nom"><b>${esc(x.titre)}</b><span>${esc(x.m || "Marque non renseignée")}${x.q ? " · " + esc(x.q) : ""}</span></span>
    <span class="ligne-faits">${f.map(([c, lib]) => `<span class="f">${x[c] == null ? "n. d." : nb(x[c], MET[c].d) + I + MET[c].u}<small>${lib}</small></span>`).join("")}${badgeNS(x.ns)}</span>
  </button>`;
}
const connus = new Map();          // produits déjà vus dans cette visite, par code
const retenir = x => { connus.set(x.c, x); return x; };

/* ---------- Statistiques ---------- */
// Part du rayon située sous une valeur, à partir des 21 quantiles (0, 5, …, 100).
function rang(q, v) {
  if (!q || v == null) return null;
  let i = 0; while (i < q.length && q[i] < v) i++;
  let j = q.length - 1; while (j >= 0 && q[j] > v) j--;
  if (i >= q.length) return 100; if (j < 0) return 0;
  if (j >= i) return (i + j) / 2 * 5;
  return (j + (v - q[j]) / (q[i] - q[j])) * 5;
}
function joli(v) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
function echelle(max) { const pas = joli(max / 4), haut = Math.ceil(max / pas - 1e-9) * pas; const T = []; for (let t = 0; t <= haut + pas / 2; t += pas) T.push(+t.toFixed(4)); return { max: haut, T }; }

/* ---------- Navigation ---------- */
const VUES = ["accueil", "rayon", "produit", "releve", "methode"];
let etat = { vue: "accueil" };
function montrer(vue) {
  VUES.forEach(v => { $("#v-" + v).hidden = v !== vue; });
  const actif = vue === "rayon" ? "accueil" : vue;
  $$(".nav button[data-vue], .onglets button[data-vue]").forEach(b => { if (b.dataset.vue === actif) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
}
function jetonEtat(e) { return e.vue === "rayon" ? jeton(R[e.r]) : e.vue === "produit" ? (e.code ? "p." + e.code : "produit") : e.vue === "accueil" ? "" : e.vue; }
function aller(e, sansHistorique) {
  etat = e;
  if (!sansHistorique) { try { history.pushState(e, "", "#" + jetonEtat(e)); } catch (err) { /* cadre sans historique */ } }
  rendre(); window.scrollTo(0, 0);
}
function rendre() {
  fermerBulle();
  if (etat.vue === "rayon") voirRayon(R[etat.r]);
  else if (etat.vue === "produit") voirProduit();
  else if (etat.vue === "releve") voirReleve();
  else if (etat.vue === "methode") { montrer("methode"); }
  else montrer("accueil");
  const t = $("#v-" + etat.vue + " h1"); if (t) { t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); }
}
function depuisJeton(h) {
  h = (h || "").replace(/^#/, "");
  if (h.startsWith("r.")) { const s = h.slice(2), r = s[0] === "_" ? R[+s.slice(1)] : parTag.get(s.replace(".", ":")); if (r) return { vue: "rayon", r: r.i }; }
  if (h.startsWith("p.") && /^\d{6,14}$/.test(h.slice(2))) return { vue: "produit", code: h.slice(2) };
  if (h === "produit" || h === "releve" || h === "methode") return { vue: h };
  return { vue: "accueil" };
}
addEventListener("popstate", ev => { etat = ev.state && ev.state.vue ? ev.state : depuisJeton(location.hash); rendre(); });

/* ---------- Onglets d'un écran : un seul panneau visible à la fois ---------- */
function choisirOnglet(vue, nom, centrer) {
  const tabs = $$("[data-onglets] [data-onglet]", vue); if (!tabs.length) return nom;
  if (!tabs.some(b => b.dataset.onglet === nom)) nom = tabs[0].dataset.onglet;
  tabs.forEach(b => b.setAttribute("aria-selected", String(b.dataset.onglet === nom)));
  $$(":scope > [data-panneau]", vue).forEach(p => { p.hidden = p.dataset.panneau !== nom; });
  if (centrer) { const b = tabs.find(x => x.dataset.onglet === nom), z = b.parentElement; z.scrollLeft = b.offsetLeft - (z.clientWidth - b.offsetWidth) / 2; }
  return nom;
}
const segments = (liste, actif, colle) => `<div class="segments${colle ? " colle" : ""}" data-onglets role="tablist">${liste.map(([c, nom]) => `<button type="button" role="tab" data-onglet="${c}" aria-selected="${c === actif}">${nom}</button>`).join("")}</div>`;

/* ---------- Bulle d'information des graphiques ---------- */
function bulle(zone, x, y, html) {
  let b = $(".bulle", zone); if (!b) { b = document.createElement("div"); b.className = "bulle"; zone.appendChild(b); }
  b.innerHTML = html; b.hidden = false;
  const w = zone.clientWidth, bw = b.offsetWidth, bh = b.offsetHeight;
  b.style.left = Math.max(4, Math.min(w - bw - 4, x - bw / 2)) + "px";
  b.style.top = (y - bh - 12 < 0 ? y + 14 : y - bh - 12) + "px";
}
function fermerBulle() { $$(".bulle").forEach(b => { b.hidden = true; }); }

/* ---------- Classement de rayons sur un indicateur ---------- */
function rendreRangs(cible, liste, c, ordre, moi, limite) {
  const ind = INDIC.find(x => x.c === c), L = liste.filter(r => r[c] != null).sort((a, b) => ordre === "asc" ? a[c] - b[c] : b[c] - a[c]);
  const vus = limite ? L.slice(0, limite) : L, max = Math.max(...L.map(r => r[c]), 1e-9);
  cible.innerHTML = vus.length ? vus.map(r => `<button type="button" class="rang-l${moi === r.i ? " moi" : ""}" data-rayon-fiche="${r.i}"><span>${esc(r.nom)}</span><i style="width:${Math.max(.5, r[c] / max * 100).toFixed(1)}%"></i><b>${nb(r[c], ind.d)}${ind.u ? I + ind.u : ""}</b></button>`).join("")
    : `<p class="vide">Aucun rayon de cette liste n'a assez de données pour cet indicateur.</p>`;
  return { total: L.length, vus: vus.length, manquants: liste.length - L.length };
}

/* ---------- Accueil ---------- */
function suggRayons(q) {
  const mots = plat(q).split(/\s+/).filter(Boolean); if (!mots.length) return [];
  const L = R.filter(r => (base === "tout" || r.n > 0) && mots.every(m => r.cle.includes(m)));
  const note = r => (r.cle === mots.join(" ") ? 0 : r.cle.startsWith(mots[0]) ? 1 : new RegExp("\\b" + mots[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(r.cle) ? 2 : 3);
  return L.sort((a, b) => note(a) - note(b) || b.n - a.n).slice(0, 8);
}
function majSuggRayons() {
  const q = $("#q-rayon").value.trim(), L = suggRayons(q);
  $("#s-rayon").innerHTML = L.map(r => { const p = r.par >= 0 ? R[r.par].nom : ""; return `<button type="button" class="sugg" data-rayon-fiche="${r.i}"><b>${esc(r.nom)}${p ? `<small>dans ${esc(p)}</small>` : ""}</b><span>${nb(r.n)} ${base === "act" ? "actives" : "fiches"}</span></button>`; }).join("");
  $("#e-rayon").textContent = q && !L.length ? "Aucun rayon de ce nom. Essayez un mot plus court, ou parcourez la liste plus bas." : "";
}
function rendreVedettes() {
  $("#vedettes").innerHTML = B.vedettes.map(v => { const r = R[v[0]], src = v[1];
    return `<button type="button" class="pose" data-rayon-fiche="${r.i}"><span class="pose-photo">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : ""}</span><span class="pose-tag"><b>${esc(r.nom)}</b><span>${motRefs(r.n)}</span></span></button>`; }).join("");
}
function rendreComparer() {
  const c = $("#c-indic").value, champ = $("#c-champ").value, ordre = $("#c-ordre").value;
  const seuil = base === "act" ? 200 : 500, liste = champ === "vedettes" ? B.vedettes.map(v => R[v[0]]) : R.filter(r => r.n >= seuil && !r.tr);
  const og = $("#c-champ option[value=grands]"); if (og) og.textContent = base === "act" ? "Tous les rayons de 200 références actives et plus" : "Tous les rayons de 500 fiches et plus";
  const res = rendreRangs($("#c-rangs"), liste, c, ordre, null, champ === "vedettes" ? 0 : 25);
  $("#c-note").textContent = (champ === "grands" ? `Les ${res.vus} premiers sur ${nb(res.total)} rayons. ` : "") + (c === "protOk" ? "Promesses tenues : part des packs qui mettent la protéine en avant et atteignent le seuil légal de 12 % des calories. Rayons avec au moins cinq promesses vérifiables." : c === "mdd" ? "Part calculée sur les références dont la marque est connue." : "Valeurs pour 100 g ou 100 ml.") + (base === "act" ? " Calcul sur les références actives." : " Calcul sur toutes les fiches.");
}
function noeud(r) {
  return `<div class="noeud" data-noeud="${r.i}"><div class="noeud-tete"><button type="button" class="noeud-nom" data-rayon-fiche="${r.i}"><b>${esc(r.nom)}</b><span>${nb(r.n)} ${base === "act" ? "actives" : "fiches"}</span></button>${r.enf.some(e => e.n > 0) ? `<button type="button" class="deplier" aria-expanded="false" aria-label="Voir les ${r.enf.length} sous-rayons de ${esc(r.nom)}" data-deplier="${r.i}">+</button>` : ""}</div></div>`;
}
function rendreAccueil() {
  const m = B.meta, dispo = R.filter(r => r.dispo).length;
  $("#date-base").textContent = "Open Food Facts, état de la base au " + DATE;
  $("#barre-date").textContent = "Base au " + DATE;
  $("#zone-bascule").innerHTML = bascule() + `<p>${base === "act" ? `Actives : scannées en ${m.annee} ou créées depuis. C'est le rayon d'aujourd'hui.` : "Toutes les fiches recensées, produits arrêtés compris."}</p>`;
  $("#entree-rayon-note").textContent = base === "act" ? `${nb(dispo)} rayons d'au moins ${m.minAct} références actives. Tapez un nom pour ouvrir sa fiche.` : `${nb(m.rayons)} rayons d'au moins ${m.min} fiches. Tapez un nom pour ouvrir sa fiche.`;
  $("#pied-date").textContent = `État de la base au ${DATE}, export lu le ${dateFr(m.collecte)}. ${nb(m.gardes)} fiches retenues, dont ${nb(m.actives)} références actives.`;
  if (!$("#rp-accueil").firstChild) $("#rp-accueil").innerHTML = zoneRecherche("q-produit");
  rendreVedettes();
  if (!$("#c-indic").options.length) $("#c-indic").innerHTML = optionsIndic("s");
  rendreComparer();
  const racines = R.filter(r => r.par < 0 && r.n > 0).sort((a, b) => b.n - a.n);
  $("#arbre-intro").textContent = `${nb(base === "act" ? dispo : m.rayons)} rayons, rangés du plus large au plus précis. Un produit appartient à plusieurs rayons à la fois : les effectifs ne s'additionnent pas.`;
  $("#arbre").innerHTML = racines.map(noeud).join("");
  $("#chiffres").innerHTML = [[nb(m.actives), `références actives : scannées en ${m.annee} ou créées depuis`], [nb(m.gardes), "fiches vendues en France, avec catégorie et valeurs nutritionnelles"], [nb(m.rayons), `rayons d'au moins ${m.min} fiches, dont ${nb(R.filter(r => r.bases.act).length)} avec assez de références actives`], [nb(m.marques), "marques distinctes"]].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join("");
  rendreMethode();
}
