/* ============================================================
   Fiche de rayon
   ============================================================ */
let ctx = null;     // rayon affiché : { r, S, lot, prods, par, Spar }
const ORDRE_BANDES = ["k", "s", "f", "a", "se", "p", "fb", "pp"];

function filAriane(r, fin) {
  return `<nav class="fil" aria-label="Fil d'Ariane"><button type="button" data-vue="accueil">Rayons</button>${lignee(r).map(a => `<span aria-hidden="true">›</span><button type="button" data-rayon-fiche="${a.i}">${esc(a.nom)}</button>`).join("")}${fin ? `<span aria-hidden="true">›</span><button type="button" data-rayon-fiche="${r.i}">${esc(r.nom)}</button>` : ""}</nav>`;
}
function teteRayon(r, suite) {
  return `<div class="tete">${filAriane(r)}<p class="surtitre">Fiche de rayon</p><h1 tabindex="-1">${esc(r.nom)}</h1>
    <p class="sous">${base === "act"
      ? `<strong>${pluriel(r.n, "référence active", "références actives")}</strong>${r.dispo ? ` de <strong>${pluriel(r.nmq, "marque", "marques")}</strong>` : ""}, sur ${pluriel(r.nTout, "fiche recensée", "fiches recensées")}. Open Food Facts au ${DATE}.`
      : `<strong>${pluriel(r.n, "fiche", "fiches")}</strong> de <strong>${pluriel(r.nmq, "marque", "marques")}</strong> vendues en France, produits arrêtés compris. Open Food Facts au ${DATE}.`}</p>
    <div class="zone-bascule">${bascule()}</div>${suite || ""}</div>`;
}
let ongletRayon = "resume";
const ONGLETS_RAYON = [["resume", "Résumé"], ["marques", "Marques"], ["compo", "Composition"], ["packs", "Packs"], ["creneaux", "Créneaux"], ["neuf", "Nouveautés"], ["refs", "Références"]];

/* Bande : étendue P10–P90, boîte P25–P75, médiane, médiane du rayon parent, et le produit situé s'il y en a un. */
function bande(c, q, n, opt) {
  opt = opt || {}; const m = MET[c];
  if (!q || n < 5) return `<div class="bande-l"><div class="bande-nom"><b>${m.nom}</b><span>Trop peu de fiches renseignées (${n || 0}).</span></div><div></div></div>`;
  const haut = Math.max(q[19], opt.moi != null ? opt.moi : 0, opt.par != null ? opt.par : 0) * 1.06 || 1, e = echelle(haut), pos = v => Math.max(0, Math.min(100, v / e.max * 100));
  let sous = `Médiane ${val(c, q[10])} · moitié du rayon entre ${nb(q[5], m.d)} et ${val(c, q[15])}`;
  if (opt.moi != null) { const t = rang(q, opt.moi); sous = `<span class="dit">${val(c, opt.moi)}.</span> ${opt.moi === q[10] ? "Pile à la médiane du rayon." : t >= 55 ? `${m.plus} que ${nb(t)}${I}% du rayon.` : t <= 45 ? `${m.moins} que ${nb(100 - t)}${I}% du rayon.` : "Au milieu du rayon."} Médiane du rayon : ${val(c, q[10])}.`; }
  else if (opt.moi === null) sous = `<span class="dit">Valeur absente de la fiche.</span> Médiane du rayon : ${val(c, q[10])}.`;
  const lib = `${m.nom} : médiane ${val(c, q[10])}, de ${val(c, q[2])} à ${val(c, q[18])} pour 80 % des références` + (opt.moi != null ? `, ce produit ${val(c, opt.moi)}` : "");
  return `<div class="bande-l"><div class="bande-nom"><b>${m.nom}</b><span>${sous}</span></div>
    <div><div class="bande" role="img" aria-label="${esc(lib)}">
      <span class="etendue" style="left:${pos(q[2])}%;width:${Math.max(.4, pos(q[18]) - pos(q[2]))}%"></span>
      <span class="boite" style="left:${pos(q[5])}%;width:${Math.max(.6, pos(q[15]) - pos(q[5]))}%"></span>
      <span class="med" style="left:${pos(q[10])}%"></span>
      ${opt.par != null ? `<span class="par" style="left:${pos(opt.par)}%" title="Médiane de ${esc(opt.parNom)} : ${esc(val(c, opt.par))}"></span>` : ""}
      ${opt.moi != null ? `<span class="moi" style="left:${pos(opt.moi)}%"></span>` : ""}
    </div><div class="bande-axe" aria-hidden="true">${e.T.map(t => `<span style="left:${t / e.max * 100}%">${nb(t, 2)}</span>`).join("")}</div></div></div>`;
}
function legendeBandes(par, moi) {
  return `<ul class="legende"><li><i class="l-med"></i>Médiane du rayon</li><li><i class="l-boite"></i>Moitié centrale des références</li>${par ? `<li><i class="l-par"></i>Médiane de ${esc(par.nom)}</li>` : ""}${moi ? `<li><i class="l-moi"></i>Ce produit</li>` : ""}</ul>`;
}
function empileNS(ns) {
  const connu = ns.slice(0, 5).reduce((a, b) => a + b, 0); if (!connu) return `<p class="vide">Aucune référence de ce rayon n'a de Nutri-Score calculé.</p>`;
  return `<div class="empile" role="img" aria-label="Répartition du Nutri-Score : ${ns.slice(0, 5).map((v, i) => "ABCDE"[i] + " " + Math.round(v / connu * 100) + " %").join(", ")}">${ns.slice(0, 5).map((v, i) => v ? `<div class="ns-${"abcde"[i]}" style="flex:${v} 1 0">${v / connu >= .07 ? "ABCDE"[i] : ""}</div>` : "").join("")}</div>
    <div class="detail">${ns.slice(0, 5).map((v, i) => `<span><b>${"ABCDE"[i]}</b> ${pc(v / connu * 100)}</span>`).join("")}${ns[5] ? `<span>Non calculé : ${nb(ns[5])} fiches</span>` : ""}</div>`;
}
function empileNova(nv) {
  const connu = nv.slice(0, 4).reduce((a, b) => a + b, 0); if (!connu) return `<p class="vide">Aucune référence de ce rayon n'a de groupe NOVA.</p>`;
  return `<div class="empile" role="img" aria-label="Répartition NOVA : ${nv.slice(0, 4).map((v, i) => "groupe " + (i + 1) + " " + Math.round(v / connu * 100) + " %").join(", ")}">${nv.slice(0, 4).map((v, i) => v ? `<div class="nv-${i + 1}" style="flex:${v} 1 0">${v / connu >= .07 ? i + 1 : ""}</div>` : "").join("")}</div>
    <div class="detail">${["Brut ou peu transformé", "Ingrédient culinaire", "Transformé", "Ultra-transformé"].map((t, i) => `<span><b>${i + 1}</b> ${t} ${pc(nv[i] / connu * 100)}</span>`).join("")}</div>`;
}

function htmlFabs(S, mode) {
  const tot = mode === "sc" ? S.scm : S.nm, k = mode === "sc" ? 2 : 1, L = S.fab.slice().sort((a, b) => b[k] - a[k]), max = L.length ? L[0][k] : 1;
  return L.map(f => `<div class="groupe${f[3] === 2 ? " mdd" : ""}"><span>${esc(f[0])}${f[3] === 2 ? `<span class="etiq mdd">MDD</span>` : ""}</span><i style="width:${Math.max(.5, f[k] / (max || 1) * 100).toFixed(1)}%"></i><b>${pc(tot ? f[k] / tot * 100 : 0, 1)}</b></div>`).join("");
}
function blocOccupation(r, S) {
  const top3 = S.fab.slice(0, 3).reduce((s, f) => s + f[1], 0), pMdd = S.nm ? S.mdd[0] / S.nm * 100 : 0;
  const lignes = S.mq.map((b, i) => `<tr><td>${i + 1}. <button type="button" class="lien" data-marque="${esc(b[0])}">${esc(b[0])}</button>${b[3] >= 0 && B.groupes[b[3]][0] !== b[0] ? `<span class="discret"> · ${esc(B.groupes[b[3]][0])}</span>` : ""}${b[3] >= 0 && B.groupes[b[3]][1] === 2 ? `<span class="etiq mdd">MDD</span>` : ""}</td>
    <td class="n">${nb(b[1])}</td><td class="n">${pc(b[1] / S.nm * 100, 1)}</td><td class="n">${S.scm ? pc(b[2] / S.scm * 100, 1) : "n. d."}</td><td class="n">${b[4] == null ? "n. d." : nb(b[4], 1) + I + "g"}</td><td class="n">${b[5] == null ? "n. d." : pc(b[5])}</td></tr>`).join("");
  return `<section aria-labelledby="t-occ"><h2 id="t-occ">Qui occupe le rayon</h2>
    <p class="intro"><strong>${pluriel(S.nmq, "marque", "marques")}</strong> pour ${nb(S.nm)} références de marque connue. Les trois premiers fabricants en réunissent <strong>${pc(S.nm ? top3 / S.nm * 100 : 0)}</strong>.</p>
    <div class="duo"><div>
      <h3>Les dix premiers fabricants</h3>
      <div class="puces" role="group" aria-label="Mesure"><button type="button" class="puce" data-mesure="n" aria-pressed="true">Part des références</button><button type="button" class="puce" data-mesure="sc" aria-pressed="false">Part des scans</button></div>
      <div class="groupes" id="fabs">${htmlFabs(S, "n")}</div>
      <p class="note">Les marques d'un même groupe sont additionnées, les marques de distributeur regroupées par enseigne. Scans : compteur d'Open Food Facts, un indice d'attention des utilisateurs de l'application, pas une part de marché.</p>
    </div><div>
      <h3>Marques de distributeur et marques nationales</h3>
      <div class="partage" role="img" aria-label="Marques de distributeur ${Math.round(pMdd)} %, autres marques ${Math.round(100 - pMdd)} %">${pMdd > 0 ? `<div class="p-mdd" style="flex:${pMdd} 1 0">${pMdd >= 12 ? "MDD " + pc(pMdd) : ""}</div>` : ""}<div class="p-nat" style="flex:${100 - pMdd} 1 0">${100 - pMdd >= 25 ? "Autres marques " + pc(100 - pMdd) : ""}</div></div>
      <div class="detail"><span><b>${pc(pMdd, 1)}</b> des références sont des MDD (${nb(S.mdd[0])})</span>${S.scm ? `<span><b>${pc(S.mdd[1] / S.scm * 100, 1)}</b> des scans</span>` : ""}</div>
      ${S.mdd[2].length ? `<p class="note">Enseignes les plus présentes : ${S.mdd[2].map(e => `${esc(e[0])} (${nb(e[1])})`).join(", ")}.</p>` : ""}
      ${r.par >= 0 && R[r.par].mdd != null ? `<p class="note">Dans ${esc(R[r.par].nom)}, les MDD pèsent ${pc(R[r.par].mdd, 1)}.</p>` : ""}
    </div></div>
    <h3 style="margin-top:28px">Les quinze premières marques</h3>
    <div class="table-zone"><table><thead><tr><th>Marque</th><th class="n">Références</th><th class="n">Part</th><th class="n">Part des scans</th><th class="n">Sucres médians</th><th class="n">Nutri-Score A ou B</th></tr></thead><tbody>${lignes}</tbody></table></div>
    <p class="note">Cliquez sur une marque pour voir ses références parmi les plus scannées du rayon.</p></section>`;
}

function blocComposition(r, S, par) {
  const pm = c => par && par[c] != null ? par[c] : null;
  return `<section aria-labelledby="t-compo"><h2 id="t-compo">Ce qu'il y a dans les produits</h2>
    <p class="intro">Valeurs pour 100 g ou 100 ml. Le trait couvre 80 % des références, la boîte la moitié centrale.</p>
    <div class="bandes">${ORDRE_BANDES.map(c => bande(c, S.q[c], S.qn[c], { par: pm(c), parNom: par ? par.nom : "" })).join("")}</div>
    ${legendeBandes(par)}
    <div class="duo"><div><h3>Nutri-Score</h3>${empileNS(S.ns)}</div>
      <div><h3>Degré de transformation (NOVA)</h3>${empileNova(S.nova)}
      ${S.add[3] >= 10 ? `<p class="note">Sur ${nb(S.add[3])} listes d'ingrédients lues : ${nb(S.add[0], 1)} additif${S.add[0] > 1 ? "s" : ""} en médiane, ${pc(S.add[1])} des produits sans aucun additif${S.add[2] != null ? `, ${nb(S.add[2])} ingrédients en médiane` : ""}.</p>` : ""}</div></div></section>`;
}

function blocPromesses(r, S, par, Spar) {
  const pos = M.POSITIONS.map((p, i) => ({ i, nom: p.nom, court: p.court, n: S.pos[i], part: S.pos[i] / S.n * 100, parent: Spar ? Spar.pos[i] / Spar.n * 100 : null })).filter(p => p.n > 0).sort((a, b) => b.n - a.n);
  const maxPos = pos.length ? Math.max(...pos.map(p => Math.max(p.part, p.parent || 0))) : 1;
  const tPos = pos.map(p => `<tr><td><button type="button" class="lien" data-position="${p.i}" title="${esc(p.nom)}">${esc(p.court)}</button></td><td class="n">${nb(p.n)}</td><td class="n">${pc(p.part, 1)}</td><td style="min-width:90px"><span class="barrette" style="width:${(p.part / maxPos * 100).toFixed(1)}%"></span></td>${Spar ? `<td class="n">${pc(p.parent, 1)}</td>` : ""}</tr>`).join("");
  const tPr = S.pr.map(p => { const [i, t, tenue, limite, non, nd, inv, mq] = p, def = M.PROMESSES[i], verif = tenue + limite + non;
    return `<tr><td><b>${esc(def.nom)}</b></td><td class="n">${nb(t)}</td><td class="n">${pc(t / S.n * 100, 1)}</td><td>${verif ? `<span class="verdicts" role="img" aria-label="${tenue} tenues, ${limite} à la limite, ${non} non tenues">${tenue ? `<i class="v-tenue" style="flex:${tenue}"></i>` : ""}${limite ? `<i class="v-limite" style="flex:${limite}"></i>` : ""}${non ? `<i class="v-non" style="flex:${non}"></i>` : ""}</span>` : ""}</td>
      <td class="nw">${verif ? `${nb(tenue)} sur ${nb(verif)} tenue${tenue > 1 ? "s" : ""}${non ? `, <b>${nb(non)} non</b>` : ""}` : `<span class="discret">Invérifiable par le calcul</span>`}</td><td class="discret">${mq.map(m => esc(m[0])).join(", ")}</td></tr>`; }).join("");
  const DR = [["prot12", "Source de protéines"], ["prot20", "Riche en protéines"], ["fib3", "Source de fibres"], ["fib6", "Riche en fibres"], ["sucres5", "Faible teneur en sucres"], ["sucres0", "Sans sucres"], ["gras3", "Faible teneur en matières grasses"], ["gras0", "Sans matières grasses"], ["sel", "Pauvre en sel"]];
  const dr = DR.map((d, i) => ({ nom: d[1], n: S.dr[i] })).filter(d => d.n >= 3 && d.n / S.n <= .5).sort((a, b) => b.n - a.n);
  return `<section aria-labelledby="t-packs"><h2 id="t-packs">Ce que disent les packs</h2>
    <p class="intro">Arguments repérés dans le nom du produit et dans ses labels. Une mention écrite sur le pack mais absente de la fiche n'est pas comptée : les parts sont des planchers.</p>
    <h3 style="margin-top:20px">Les arguments du rayon</h3>
    ${pos.length ? `<div class="table-zone"><table><thead><tr><th>Argument</th><th class="n">Références</th><th class="n">Part du rayon</th><th></th>${Spar ? `<th class="n">Dans ${esc(par.nom)}</th>` : ""}</tr></thead><tbody>${tPos}</tbody></table></div>` : `<p class="vide">Aucun argument repéré dans ce rayon.</p>`}
    <h3 style="margin-top:28px">Les promesses nutritionnelles, vérifiées par le calcul</h3>
    ${S.pr.length ? `<div class="table-zone"><table><thead><tr><th>Promesse</th><th class="n">Références</th><th class="n">Part</th><th></th><th>Verdict</th><th>Qui la porte le plus</th></tr></thead><tbody>${tPr}</tbody></table></div>
      <ul class="legende"><li><i class="l-boite v-tenue" style="box-shadow:none"></i>Tenue</li><li><i class="l-boite v-limite" style="box-shadow:none"></i>À la limite</li><li><i class="l-boite v-non" style="box-shadow:none"></i>Non tenue</li></ul>
      <p class="note">Seuils de l'annexe du règlement (CE) n° 1924/2006, appliqués aux valeurs de la fiche. Un écart de moins de 10 % avec le seuil est classé « à la limite ».</p>` : `<p class="vide">Aucune promesse nutritionnelle repérée dans ce rayon.</p>`}
    ${dr.length ? `<h3 style="margin-top:28px">Seuils atteints sans le dire</h3><p class="intro">Références qui auraient le droit d'écrire la mention, d'après leurs valeurs, et dont la fiche ne la porte pas.</p>
      <ul class="droits" style="max-width:640px">${dr.map(d => `<li><b>${esc(d.nom)}</b><span>${pluriel(d.n, "référence", "références")} · ${pc(d.n / S.n * 100, 1)} du rayon</span></li>`).join("")}</ul>` : ""}</section>`;
}

function blocCreneaux(r, S, par, Spar) {
  const lignes = M.POSITIONS.map((p, i) => ({ i, nom: p.nom, court: p.court, n: S.pos[i], g: S.gr[i] }));
  const seuilPeu = Math.min(10, Math.max(2, Math.round(S.n * .002)));
  const cell = v => `<div class="g-c${v === 0 ? " zero" : v <= seuilPeu ? " peu" : ""}">${v === 0 ? "0" : nb(v)}</div>`;
  const grille = lignes.map(l => `<div class="g-nom" title="${esc(l.nom)}">${esc(l.court)}</div>${cell(l.g[0])}${cell(l.g[1])}${cell(l.g[2])}<div class="g-t">${nb(l.n)}</div>`).join("");
  // Pistes : arguments absents ou rares ici et installés dans le rayon parent, puis croisements jamais faits
  const pistes = [];
  if (Spar) lignes.map(l => ({ l, ici: l.n / S.n * 100, la: Spar.pos[l.i] / Spar.n * 100 })).filter(x => x.la >= 3 && x.ici <= x.la / 3).sort((a, b) => (b.la - b.ici) - (a.la - a.ici)).slice(0, 3)
    .forEach(x => pistes.push(`<b>${esc(x.l.nom)}</b> : ${x.l.n ? pc(x.ici, 1) + " des références ici" : "aucune référence ici"}, contre ${pc(x.la, 1)} dans ${esc(par.nom)}.`));
  const forts = lignes.filter(l => l.n >= Math.max(5, S.n * .03)).sort((a, b) => b.n - a.n).slice(0, 6), croise = new Map(S.px.map(p => [p[0] + "-" + p[1], p[2]]));
  const vides = [];
  for (let a = 0; a < forts.length; a++) for (let b = a + 1; b < forts.length; b++) { const i = Math.min(forts[a].i, forts[b].i), j = Math.max(forts[a].i, forts[b].i), v = croise.get(i + "-" + j) || 0; if (v <= 1) vides.push([forts[a], forts[b], v]); }
  vides.slice(0, 3).forEach(([a, b, v]) => pistes.push(`<b>${esc(a.court)} et ${esc(b.court.toLowerCase())}</b> : ${v ? "une seule référence réunit" : "aucune référence ne réunit"} les deux, alors que chacun pèse au moins ${pc(Math.min(a.n, b.n) / S.n * 100)} du rayon.`));
  const ab = lignes.filter(l => l.n >= 5 && l.g[0] === 0 && l.g[1] + l.g[2] >= 5).slice(0, 2);
  ab.forEach(l => pistes.push(`<b>${esc(l.court)} et bien noté</b> : aucune des ${nb(l.n)} références « ${esc(l.nom.toLowerCase())} » n'est en Nutri-Score A ou B.`));
  return `<section aria-labelledby="t-cren"><h2 id="t-cren">Où il reste de la place</h2>
    <p class="intro">Chaque argument croisé avec le Nutri-Score. Une case hachurée est vide, une case jaune compte ${seuilPeu} référence${seuilPeu > 1 ? "s" : ""} ou moins.</p>
    <div class="table-zone"><div class="grille" role="table" aria-label="Arguments croisés avec le Nutri-Score">
      <div class="g-tete">Argument</div><div class="g-tete">A ou B</div><div class="g-tete">C</div><div class="g-tete">D ou E</div><div class="g-tete">Total</div>${grille}</div></div>
    <p class="note">Le total d'une ligne inclut les références sans Nutri-Score calculé.</p>
    ${pistes.length ? `<h3 style="margin-top:24px">Pistes à creuser</h3><ul class="pistes">${pistes.map(p => `<li>${p}</li>`).join("")}</ul>
      <p class="note">Une case vide n'est pas toujours une opportunité : elle peut signaler un créneau sans demande, ou des fiches incomplètes. À recouper en magasin.</p>` : ""}</section>`;
}

function blocEntrants(r, S, lot) {
  const [n12, nMq, mq] = S.nv, der = S.nvp.map(k => retenir(P(lot.p[k])));
  const ans = S.an.filter(a => a[1] > 0), max = Math.max(...ans.map(a => a[1]), 1);
  const prot = ans.filter(a => a[1] >= 30);
  return `<section aria-labelledby="t-neuf"><h2 id="t-neuf">Les nouveaux entrants</h2>
    <p class="intro"><strong>${pluriel(n12, "fiche créée", "fiches créées")}</strong> dans les douze mois avant le ${DATE}, soit ${pc(n12 / S.n * 100, 1)} du rayon${nMq ? `, dont <strong>${pluriel(nMq, "marque", "marques")}</strong> jamais vue${nMq > 1 ? "s" : ""} dans ce rayon auparavant` : ""}.</p>
    ${mq.length ? `<p class="note">Marques apparues : ${mq.map(m => `${esc(m[0])} (${nb(m[1])})`).join(", ")}.</p>` : ""}
    <div class="duo"><div><h3>Dernières fiches arrivées</h3>${der.length ? `<div class="lignes">${der.map(x => ligneProduit(x, r.i)).join("")}</div>` : `<p class="vide">Aucune fiche complète créée sur la période.</p>`}</div>
    <div><h3>Fiches créées par année</h3>
      ${ans.length ? `<div class="cohortes" role="img" aria-label="Fiches créées par année : ${ans.map(a => a[0] + " " + a[1]).join(", ")}">${ans.map(a => `<div><small>${nb(a[1])}</small><i style="height:${Math.max(1, a[1] / max * 82)}%"></i></div>`).join("")}</div>
        <div class="cohortes-axe" aria-hidden="true">${ans.map(a => `<span>${String(a[0]).slice(2)}</span>`).join("")}</div>` : `<p class="vide">Dates de création absentes.</p>`}
      ${prot.length >= 3 && prot.some(a => a[2] > 0) ? `<p class="note">Part des fiches qui mettent la protéine en avant, par année de création : ${prot.map(a => `${a[0]} : ${pc(a[2] / a[1] * 100, 1)}`).join(" · ")}.</p>` : ""}
      <p class="note">La date est celle de l'entrée de la fiche dans Open Food Facts, pas celle du lancement en magasin. Les derniers mois sont sous-comptés : une fiche récente n'a souvent pas encore sa catégorie.</p></div></div></section>`;
}

/* ---------- Explorer les références ---------- */
const expl = { q: "", marque: "", pos: "", tri: "sc", x: "s", y: "pp", vus: 20 };
function filtres() {
  const mots = plat(expl.q).split(/\s+/).filter(Boolean);
  return x => (!mots.length || mots.every(m => plat(x.n + " " + x.m).includes(m))) && (!expl.marque || x.m === expl.marque) && (expl.pos === "" || (M.positions(x.cl, x.ar) & (1 << +expl.pos)));
}
function blocExplorer(r, S, prods) {
  const marques = [...new Set(prods.map(x => x.m).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const axes = c => ORDRE_BANDES.map(k => `<option value="${k}"${k === c ? " selected" : ""}>${MET[k].court}</option>`).join("");
  return `<section aria-labelledby="t-expl"><h2 id="t-expl">Explorer les références</h2>
    <p class="intro">${prods.length < S.n ? `Les ${nb(prods.length)} références les plus scannées du rayon, sur ${nb(S.n)}.` : `Les ${nb(prods.length)} références du rayon.`} Cliquez sur un point ou une ligne pour ouvrir la fiche du produit.</p>
    <div class="reglages">
      <label class="large">Nom ou marque<input type="search" id="x-q" placeholder="Filtrer" autocomplete="off"></label>
      <label>Marque<select id="x-marque"><option value="">Toutes</option>${marques.map(m => `<option>${esc(m)}</option>`).join("")}</select></label>
      <label>Argument<select id="x-pos"><option value="">Tous</option>${M.POSITIONS.map((p, i) => S.pos[i] ? `<option value="${i}">${esc(p.nom)}</option>` : "").join("")}</select></label>
      <label>Tri<select id="x-tri"><option value="sc">Les plus scannés</option><option value="s">Les moins sucrés</option><option value="pp">Les plus protéinés</option><option value="k">Les moins caloriques</option><option value="se">Les moins salés</option><option value="ym">Les plus récents</option></select></label>
    </div>
    <div class="reglages"><label>Axe horizontal<select id="x-x">${axes(expl.x)}</select></label><label>Axe vertical<select id="x-y">${axes(expl.y)}</select></label></div>
    <div class="carte-zone" id="x-carte"></div>
    <ul class="legende"><li><i class="l-pt bleu"></i>Met la protéine en avant</li><li><i class="l-pt"></i>Les autres</li></ul>
    <p class="compte" id="x-compte" role="status"></p>
    <div class="lignes" id="x-liste"></div>
    <button type="button" class="plus" id="x-plus" hidden>Afficher plus de références</button></section>`;
}
function nuage(zone, prods, cx, cy, garde, moi) {
  const pts = prods.filter(x => x[cx] != null && x[cy] != null);
  if (pts.length < 3) { zone.innerHTML = `<p class="vide" style="margin:0">Pas assez de références avec ces deux valeurs pour tracer le nuage.</p>`; return; }
  // Le dessin prend la largeur de l'écran : sur téléphone, un nuage plus étroit et plus haut, avec des textes lisibles
  const dispo = zone.clientWidth || Math.min(900, document.documentElement.clientWidth - 64), W = Math.max(320, Math.min(720, Math.round(dispo))), H = Math.round(W < 520 ? W * .82 : W * .56);
  const g = { l: 46, r: 12, t: 14, b: 46 }, tri = c => pts.map(x => x[c]).sort((a, b) => a - b);
  const borne = c => { const v = tri(c), p98 = v[Math.min(v.length - 1, Math.floor(v.length * .98))]; return Math.max(p98, moi && moi[c] != null ? moi[c] : 0) * 1.05 || 1; };
  const ex = echelle(borne(cx)), ey = echelle(borne(cy));
  const X = v => g.l + Math.min(1, v / ex.max) * (W - g.l - g.r), Y = v => H - g.b - Math.min(1, v / ey.max) * (H - g.t - g.b);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Nuage de points : ${esc(MET[cx].nom)} en horizontal, ${esc(MET[cy].nom)} en vertical, ${pts.length} références">`;
  ex.T.forEach(t => { s += `<line class="grille-l" x1="${X(t)}" x2="${X(t)}" y1="${g.t}" y2="${H - g.b}"/><text class="axe-t" x="${X(t)}" y="${H - g.b + 16}" text-anchor="middle">${nb(t, 2)}</text>`; });
  ey.T.forEach(t => { s += `<line class="grille-l" x1="${g.l}" x2="${W - g.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axe-t" x="${g.l - 8}" y="${Y(t) + 4}" text-anchor="end">${nb(t, 2)}</text>`; });
  if (cy === "pp") [12, 20].forEach(v => { if (v < ey.max) s += `<line class="seuil" x1="${g.l}" x2="${W - g.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axe-t" x="${W - g.r - 4}" y="${Y(v) - 5}" text-anchor="end">${W < 520 ? "" : "seuil légal "}${v} %</text>`; });
  s += `<text class="axe-t" x="${(g.l + W - g.r) / 2}" y="${H - 6}" text-anchor="middle">${esc(MET[cx].court)} (${MET[cx].u})</text><text class="axe-t" transform="translate(13 ${(g.t + H - g.b) / 2}) rotate(-90)" text-anchor="middle">${esc(MET[cy].court)} (${MET[cy].u})</text>`;
  const ordre = pts.slice().sort((a, b) => (garde(a) ? 1 : 0) - (garde(b) ? 1 : 0) || ((a.cl & M.MASQUE_PROT) ? 1 : 0) - ((b.cl & M.MASQUE_PROT) ? 1 : 0));
  if (moi) ordre.sort((a, b) => (a.c === moi.c) - (b.c === moi.c));
  ordre.forEach(x => { const ok = garde(x), m = moi && moi.c === x.c; s += `<circle class="pt${x.cl & M.MASQUE_PROT ? " dit" : ""}${ok ? "" : " efface"}${m ? " moi" : ""}" cx="${X(x[cx]).toFixed(1)}" cy="${Y(x[cy]).toFixed(1)}" r="${m ? (W < 520 ? 8 : 9) : (W < 520 ? 5 : 6)}" data-code="${esc(x.c)}"${ok ? ` tabindex="0" role="button" aria-label="${esc(x.titre)}, ${esc(x.m)} : ${esc(val(cx, x[cx]))}, ${esc(val(cy, x[cy]))}"` : ""}/>`; });
  if (moi && moi[cx] != null && moi[cy] != null && !pts.some(x => x.c === moi.c)) s += `<circle class="pt moi" cx="${X(moi[cx]).toFixed(1)}" cy="${Y(moi[cy]).toFixed(1)}" r="9"/>`;
  zone.innerHTML = s + "</svg>";
  zone.dataset.cx = cx; zone.dataset.cy = cy;
}
function majExplorer() {
  if (!ctx) return; const garde = filtres(), L = ctx.prods.filter(garde);
  const cle = expl.tri, sens = (cle === "sc" || cle === "pp" || cle === "ym") ? -1 : 1;
  L.sort((a, b) => (a[cle] == null) - (b[cle] == null) || sens * (a[cle] - b[cle]) || b.sc - a.sc);
  nuage($("#x-carte"), ctx.prods, expl.x, expl.y, garde);
  const LIB = { k: "énergie", s: "sucres", se: "sel" }, c1 = LIB[cle] ? cle : "s", faits = [[c1, LIB[c1]], ["pp", "prot."]];
  $("#x-compte").textContent = L.length === ctx.prods.length ? `${nb(L.length)} références.` : `${pluriel(L.length, "référence", "références")} sur ${nb(ctx.prods.length)}.`;
  $("#x-liste").innerHTML = L.slice(0, expl.vus).map(x => ligneProduit(x, ctx.r.i, faits)).join("") || `<p class="vide">Aucune référence ne correspond à ces filtres.</p>`;
  $("#x-plus").hidden = L.length <= expl.vus;
}

function blocSousRayons(r) {
  const enf = r.enf.filter(e => e.n > 0); if (!enf.length) return "";
  return `<section aria-labelledby="t-sous"><h2 id="t-sous">Ses sous-rayons</h2>
    <div class="puces">${enf.slice(0, 30).map(e => `<button type="button" class="puce" data-rayon-fiche="${e.i}">${esc(e.nom)} <span>${nb(e.n)}</span></button>`).join("")}</div>
    ${r.enf.filter(e => e.dispo).length >= 2 ? `<h3>Côte à côte</h3><div class="reglages"><label>Indicateur<select id="sr-indic">${optionsIndic("s")}</select></label></div><div class="rangs" id="sr-rangs"></div>` : ""}</section>`;
}

function constats(r, S) {
  const f = S.fab[0], nsConnu = S.n - S.ns[5], de = nsConnu ? (S.ns[3] + S.ns[4]) / nsConnu * 100 : null, ab = nsConnu ? (S.ns[0] + S.ns[1]) / nsConnu * 100 : null;
  const pos = M.POSITIONS.map((p, i) => ({ p, n: S.pos[i] })).sort((a, b) => b.n - a.n)[0];
  const T = [];
  if (f) T.push(["", pc(f[1] / S.nm * 100), `des références pour <strong>${esc(f[0])}</strong>, premier ${f[3] === 2 ? "distributeur" : "fabricant"} du rayon${f[4] > 1 ? ` avec ${f[4]} marques` : ""}.`]);
  T.push(["", pc(S.nm ? S.mdd[0] / S.nm * 100 : 0), `de <strong>marques de distributeur</strong> parmi les références de marque connue.`]);
  if (de != null) T.push(de >= 50 ? ["ton-e", pc(de), `des références notées sont en <strong>Nutri-Score D ou E</strong>.`] : ["", pc(ab), `des références notées sont en <strong>Nutri-Score A ou B</strong>.`]);
  if (pos && pos.n) T.push(["ton-bleu", pc(pos.n / S.n * 100, pos.n / S.n < .1 ? 1 : 0), `des packs portent l'argument le plus fréquent du rayon : <strong>${esc(pos.p.nom.toLowerCase())}</strong>.`]);
  return `<div class="constats">${T.map(t => `<div class="constat ${t[0]}"><div class="constat-chiffre"><b>${t[1].replace(I + "%", "")}</b><span>%</span></div><p>${t[2]}</p></div>`).join("")}</div>`;
}

async function voirRayon(r) {
  montrer("rayon"); const el = $("#v-rayon");
  if (!r.dispo) { el.innerHTML = teteRayon(r) + `<p class="vide">Ce rayon compte ${pluriel(r.n, "référence active", "références actives")} : trop peu pour des repères fiables (il en faut ${B.meta.minAct}). Passez sur <strong>Toutes les fiches</strong> pour lire le rayon complet, produits arrêtés compris.</p>` + blocSousRayons(r); if (r.enf.filter(e => e.dispo).length >= 2) rendreRangs($("#sr-rangs"), r.enf, "s", "desc", null, 0); return; }
  el.innerHTML = teteRayon(r) + `<p class="attente" role="status">Lecture du rayon…</p>`;
  let lot, lotPar = null; const par = r.par >= 0 ? R[r.par] : null;
  try { [lot, lotPar] = await Promise.all([chargeLot(r.lot), par ? chargeLot(par.lot).catch(() => null) : null]); }
  catch (e) { if (etat.vue === "rayon" && etat.r === r.i) el.innerHTML = teteRayon(r) + `<p class="vide">Les données de ce rayon ne se chargent pas. Vérifiez la connexion, puis rouvrez la fiche.</p>`; return; }
  if (etat.vue !== "rayon" || etat.r !== r.i) return;
  const S = statsDe(lot, r.i), Spar = lotPar && par ? statsDe(lotPar, par.i) : null, prods = S.top.map(k => retenir(P(lot.p[k])));
  ctx = { r, S, lot, prods, par, Spar };
  Object.assign(expl, { q: "", marque: "", pos: "", tri: "sc", vus: 20 });
  const actions = `<div class="actions"><button type="button" class="bouton jaune" data-scan>Scanner un produit</button><button type="button" class="bouton" id="a-csv">Exporter (CSV)</button><button type="button" class="bouton" id="a-synthese">Copier la synthèse</button></div><div id="a-retour" role="status"></div>`;
  const P_ = (nom, html) => `<div class="panneau" data-panneau="${nom}">${html}</div>`;
  el.innerHTML = teteRayon(r, actions) + segments(ONGLETS_RAYON, ongletRayon, true)
    + P_("resume", constats(r, S) + blocSousRayons(r) + `<p class="note">Fiches saisies par des bénévoles : une valeur peut être fausse ou datée. L'outil compte des références, pas des ventes. ${base === "act" ? `Repères calculés sur les références actives : scannées en ${B.meta.annee} ou créées depuis.` : "Repères calculés sur toutes les fiches, produits arrêtés compris."} <button type="button" class="lien" data-vue="methode">Lire la méthode</button></p>`)
    + P_("marques", blocOccupation(r, S)) + P_("compo", blocComposition(r, S, par)) + P_("packs", blocPromesses(r, S, par, Spar))
    + P_("creneaux", blocCreneaux(r, S, par, Spar)) + P_("neuf", blocEntrants(r, S, lot)) + P_("refs", blocExplorer(r, S, prods));
  ongletRayon = choisirOnglet(el, ongletRayon, true);
  majExplorer();
  if (r.enf.filter(e => e.dispo).length >= 2) rendreRangs($("#sr-rangs"), r.enf, "s", "desc", null, 0);
  const t = $("h1", el); if (t) t.focus({ preventScroll: true });
}

function syntheseRayon() {
  const { r, S } = ctx, f = S.fab[0], nsConnu = S.n - S.ns[5], novaConnu = S.n - S.nova[4];
  const pos = M.POSITIONS.map((p, i) => ({ nom: p.nom, n: S.pos[i] })).filter(p => p.n).sort((a, b) => b.n - a.n).slice(0, 3);
  const med = c => S.q[c] ? val(c, S.q[c][10]) : "n. d.";
  return [`Rayon ${r.nom} : relevé Le Barromètre, d'après Open Food Facts (état de la base au ${DATE}).`,
    `${base === "act" ? `${nb(S.n)} références actives (scannées en ${B.meta.annee} ou créées depuis), sur ${nb(r.nTout)} fiches recensées` : `${nb(S.n)} fiches, produits arrêtés compris`}, ${nb(S.nmq)} marques.${f ? ` Premier fabricant : ${f[0]} (${nb(f[1] / S.nm * 100, 1)} % des références).` : ""} Marques de distributeur : ${nb(S.nm ? S.mdd[0] / S.nm * 100 : 0, 1)} %.`,
    `Médianes pour 100 g ou 100 ml : ${med("k")}, ${med("s")} de sucres, ${med("f")} de matières grasses, ${med("se")} de sel, ${med("pp")} des calories venant des protéines.`,
    nsConnu ? `Nutri-Score : ${nb((S.ns[0] + S.ns[1]) / nsConnu * 100)} % en A ou B, ${nb((S.ns[3] + S.ns[4]) / nsConnu * 100)} % en D ou E.${novaConnu ? ` Ultra-transformés (NOVA 4) : ${nb(S.nova[3] / novaConnu * 100)} %.` : ""}` : "",
    pos.length ? `Arguments les plus fréquents : ${pos.map(p => `${p.nom.toLowerCase()} (${nb(p.n / S.n * 100, 1)} %)`).join(", ")}.` : "",
    `Limite : la base mesure une présence en références, pas des ventes, des prix ni une distribution.`].filter(Boolean).join("\n").replace(/ /g, " ");
}
const CSV_TETE = ["Code-barres", "Nom", "Marque", "Fabricant ou enseigne", "Quantité", "Rayon", "kcal", "Matières grasses (g)", "Acides gras saturés (g)", "Sucres (g)", "Fibres (g)", "Protéines (g)", "Sel (g)", "Calories venant des protéines (%)", "Nutri-Score", "NOVA", "Scans", "Promesses nutritionnelles", "Arguments", "Fiche créée"];
function csv(prods, rayonDe) {
  const c = v => { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }, n = (v, d) => v == null ? "" : String(+v.toFixed(d == null ? 2 : d)).replace(".", ",");
  return [CSV_TETE.map(c).join(";")].concat(prods.map(x => [x.c, x.n, x.m, x.g >= 0 ? B.groupes[x.g][0] : "", x.q, rayonDe(x), n(x.k, 0), n(x.f), n(x.a), n(x.s), n(x.fb), n(x.p), n(x.se), n(x.pp, 1), x.ns ? NSL[x.ns].toUpperCase() : "", x.nova || "", x.sc,
    M.PROMESSES.filter((p, i) => x.cl & (1 << i)).map(p => p.nom + " (" + M.ETATS[M.etat(p.cle, x)].toLowerCase() + ")").join(" | "), M.ARGUMENTS.filter((a, i) => x.ar & (1 << i)).map(a => a.nom).join(" | "), x.ym ? "20" + String(Math.floor(x.ym / 100)).padStart(2, "0") + "-" + String(x.ym % 100).padStart(2, "0") : ""].map(c).join(";"))).join("\r\n");
}
