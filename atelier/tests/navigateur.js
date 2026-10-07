// Contrôle avant publication : l'application s'ouvre et marche dans un vrai navigateur, sur les données qui viennent d'être fabriquées.
// Aucune requête ne sort de la machine (Open Food Facts est coupé) : le résultat ne dépend que du site fabriqué.
// Usage : node navigateur.js http://localhost:PORT/index.html
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = pw, fs = require('fs'), path = require('path');
const URL0 = process.argv[2], SITE = path.join(process.env.BARRO_RACINE || path.join(__dirname, '..'), 'site');
let ok = 0, ko = 0; const verifie = (c, m) => { if (c) ok++; else { ko++; console.log('  REFUS ', m); } };
(async () => {
  const ix = JSON.parse(fs.readFileSync(path.join(SITE, 'd/index.json'), 'utf8')), fr = n => n.toLocaleString('fr-FR').replace(/\s/g, ' ');
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const dehors = [], donnees = [];
  await ctx.route(u => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u.href) && !/^(data|blob):/.test(u.href), r => { dehors.push(r.request().url()); return r.abort(); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('request', r => { if (r.url().includes('/d/')) donnees.push(r.url()); });
  const t = s => p.locator(s).first().innerText(), net = async s => (await t(s)).replace(/\s/g, ' ');
  // Accueil
  await p.goto(URL0); await p.waitForSelector('#vedettes .pose');
  verifie((await p.locator('#vedettes .pose').count()) === 24, 'accueil : 24 rayons en vue');
  verifie((await p.locator('#vedettes .pose img').count()) >= 22, 'accueil : photos des rayons en vue');
  verifie((await net('#chiffres')).includes(fr(ix.meta.gardes)) && (await net('#chiffres')).includes(fr(ix.meta.actives)), 'accueil : chiffres de la base affichés');
  verifie((await p.locator('#zone-bascule [data-base="act"]').getAttribute('aria-pressed')) === 'true', 'accueil : références actives par défaut');
  await p.click('#v-accueil [data-onglet="comparer"]'); verifie((await p.locator('#c-rangs .rang-l').count()) >= 10, 'accueil : comparaison des rayons');
  await p.click('#v-accueil [data-onglet="tous"]'); verifie((await p.locator('#arbre .noeud').count()) >= 5, 'accueil : liste de tous les rayons');
  await p.fill('#q-rayon', 'yaourt'); await p.waitForTimeout(150); verifie((await p.locator('#s-rayon .sugg').count()) > 2, 'recherche de rayon');
  // Fiche de rayon
  const chips = ix.rayons.find(r => r[0] === 'en:crisps');
  await p.goto(URL0 + '#r.en.crisps'); await p.reload(); await p.waitForSelector('#v-rayon .constat');
  verifie((await t('#v-rayon h1')) === 'Chips', 'rayon : titre');
  verifie((await net('#v-rayon .sous')).includes(fr(chips[6]) + ' références actives'), 'rayon : effectif actif affiché');
  verifie((await p.locator('#v-rayon .constat').count()) === 4, 'rayon : quatre constats');
  verifie((await p.locator('#v-rayon [data-onglet]').count()) === 7, 'rayon : sept onglets');
  for (const [o, sel, mini] of [['marques', '#fabs .groupe', 5], ['compo', '#v-rayon .bande', 6], ['packs', '#v-rayon [data-panneau="packs"] tr', 3], ['creneaux', '#v-rayon [data-panneau="creneaux"] section', 1], ['neuf', '#v-rayon [data-panneau="neuf"] section', 1], ['refs', '#x-liste .ligne', 20]]) {
    await p.click(`#v-rayon [data-onglet="${o}"]`); await p.waitForTimeout(120); verifie((await p.locator(sel).count()) >= mini, `rayon : onglet ${o} rempli (${await p.locator(sel).count()})`); }
  verifie((await p.locator('#x-carte circle.pt').count()) > 50, 'rayon : carte des références');
  await p.click('#v-rayon .bascule [data-base="tout"]'); await p.waitForSelector('#v-rayon .bascule [data-base="tout"][aria-pressed="true"]'); await p.waitForSelector('#x-liste .ligne');
  verifie((await net('#v-rayon .sous')).includes(fr(chips[2]) + ' fiches'), 'rayon : bascule sur toutes les fiches');
  await p.click('#v-rayon .bascule [data-base="act"]'); await p.waitForSelector('#v-rayon .bascule [data-base="act"][aria-pressed="true"]'); await p.waitForSelector('#x-liste .ligne');
  // Fiche produit depuis le rayon
  await p.click('#v-rayon [data-onglet="refs"]'); await p.locator('#x-liste .ligne').first().click(); await p.waitForSelector('#v-produit #t-pos');
  verifie((await p.locator('#v-produit .bande .moi').count()) >= 4, 'produit : position sur les bandes');
  verifie((await p.locator('#p-carte circle.moi').count()) === 1, 'produit : point sur la carte du rayon');
  await p.click('#p-releve'); verifie((await t('#n-releve-nb')) === '1', 'relevé : ajout');
  await p.click('#v-produit [data-onglet="pack"]'); verifie(await p.locator('#t-pp').isVisible(), 'produit : onglet Pack');
  await p.click('#v-produit [data-onglet="voisins"]'); verifie((await p.locator('#v-produit [data-panneau="voisins"] .ligne').count()) >= 2, 'produit : voisins');
  // Recherche par nom et par code-barres (base embarquée, Open Food Facts coupé)
  await p.click('#n-produit'); await p.waitForSelector('#q-produit-2'); await p.fill('#q-produit-2', 'nutella'); await p.waitForSelector('#v-produit .s-produit .sugg', { timeout: 15000 });
  verifie((await p.locator('#v-produit .s-produit .sugg').count()) >= 1, 'recherche de produit par nom');
  const code = JSON.parse(fs.readFileSync(path.join(SITE, 'd/c/003.json'), 'utf8')).find(l => l[19] && l[19].length && l[4] != null && (l[17] & 8))[0];
  await p.goto(URL0 + '#p.' + code); await p.reload(); await p.waitForSelector('#v-produit #t-pos', { timeout: 20000 });
  verifie(/\d/.test(await net('#v-produit .produit-nom')), 'produit : fiche ouverte par son code-barres ' + code);
  // Relevé, méthode
  await p.click('#n-releve'); await p.waitForSelector('.releve-table'); verifie((await p.locator('.releve-table tbody tr').count()) === 1, 'relevé : tableau');
  await p.click('#n-methode'); verifie(/2006/.test(await t('#methode-corps')) && /Références actives/.test(await p.evaluate(() => document.querySelector('#methode-corps').textContent)), 'méthode affichée');
  // Rayon sans assez de références actives
  const maigre = ix.rayons.find(r => !r[8] && /^[a-z]{2}:[a-z0-9-]+$/.test(r[0]));
  if (maigre) { await p.goto(URL0 + '#r.' + maigre[0].replace(':', '.')); await p.reload(); await p.waitForSelector('#v-rayon .vide'); verifie(/trop peu/.test(await t('#v-rayon .vide')), 'petit rayon : message clair'); }
  // Téléphone
  const m = await ctx.newPage(); m.on('pageerror', e => err.push(e.message)); await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(URL0 + '#r.en.yogurts'); await m.waitForSelector('#v-rayon .constat');
  verifie(await m.locator('.onglets').isVisible(), 'téléphone : onglets du bas');
  const large = await m.evaluate(() => document.documentElement.scrollWidth); verifie(large <= 390, 'téléphone : pas de défilement horizontal (' + large + ')');
  // Données versionnées, aucune erreur de script
  verifie(donnees.length > 3 && donnees.every(u => u.includes('?v=' + encodeURIComponent(ix.meta.v))), 'fichiers de données demandés avec la version de la base');
  verifie(err.length === 0, 'aucune erreur de script : ' + err.slice(0, 3).join(' | '));
  verifie(dehors.every(u => /openfoodfacts\.org/.test(u)), 'aucune requête vers un autre site qu\'Open Food Facts : ' + dehors.filter(u => !/openfoodfacts\.org/.test(u)).slice(0, 3).join(' '));
  console.log(`Navigateur : ${ok} vérifications réussies, ${ko} manquées.`);
  await b.close(); process.exit(ko ? 1 : 0);
})().catch(e => { console.log('EXCEPTION', e.message.split('\n').slice(0, 4).join('\n')); process.exit(2); });
