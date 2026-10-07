// Sécurité : une fiche hostile (lue en direct ou gardée dans le relevé) ne doit faire exécuter aucun code dans la page.
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = pw;
const URL0 = process.argv[2] || 'http://localhost:8765/index.html';
const X = n => `"><img src=x onerror="window.__pwn=(window.__pwn||[]).concat('${n}')"><script>window.__pwn=(window.__pwn||[]).concat('${n}-script')</script>'`;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  const err = []; p.on('pageerror', e => err.push(e.message));
  // 1. Open Food Facts répond une fiche piégée dans tous ses champs texte
  await ctx.route('https://world.openfoodfacts.org/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ status: 1, product: { code: '2999999999995' + X('code'), product_name: 'Barre' + X('nom'), product_name_fr: 'Barre' + X('nomfr'), generic_name_fr: X('gen'), brands: 'Marque' + X('marque'), quantity: '50 g' + X('qte'),
      categories_tags: ['en:crisps', 'en:snacks', X('cat')], labels_tags: ['en:organic', X('label')], nutriments: { 'energy-kcal_100g': 500, fat_100g: 30, sugars_100g: 2, proteins_100g: 6, salt_100g: 1.2, carbohydrates_100g: 50 },
      nutriscore_grade: 'd' + X('ns'), nova_group: 4, unique_scans_n: 12, created_t: 1700000000, image_front_small_url: 'javascript:window.__pwn=["img"]//' + X('img') } }) }));
  await p.goto(URL0 + '#p.2999999999995'); await p.waitForTimeout(2500);
  const titre = await p.locator('#v-produit h1').first().innerText().catch(() => '(pas de fiche)');
  await p.locator('#p-releve').click().catch(() => {}); await p.click('#n-releve').catch(() => {}); await p.waitForTimeout(800);
  await p.locator('#rl-csv').count();
  await p.click('#n-produit').catch(() => {}); await p.waitForTimeout(500);                    // derniers produits consultés
  const r1 = await p.evaluate(() => window.__pwn || null);
  // 2. Relevé et produits récents trafiqués dans le stockage du navigateur, puis rechargement
  await p.evaluate(X0 => { const l = ['2999999999988' + X0, 'Nom' + X0, 'Marque' + X0, '1 kg' + X0, 400, 10, 2, 3, 1, 5, 1, 4, 4, 0, 0, 5, 2401, 8, -1, [0, 1]];
    localStorage.setItem('barometre.releve', JSON.stringify([{ l, r: 0 }])); localStorage.setItem('barometre.recents', JSON.stringify([l])); localStorage.setItem('barometre.base', X0); }, X('stock'));
  await p.goto(URL0 + '#releve'); await p.reload(); await p.waitForTimeout(1200);
  await p.click('#n-produit').catch(() => {}); await p.waitForTimeout(600);
  // 3. Adresses piégées
  for (const h of ['#r.' + encodeURIComponent(X('hash')), '#p.123' + encodeURIComponent(X('hash2')), '#' + encodeURIComponent(X('hash3')), '#r._999999', '#r.en.' + encodeURIComponent('<img src=x onerror=window.__pwn=["h4"]>')]) { await p.goto(URL0 + h); await p.reload(); await p.waitForTimeout(500); }
  // 4. Recherche piégée
  await p.goto(URL0); await p.reload(); await p.waitForTimeout(500);
  await p.fill('#q-rayon', X('rech')); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.fill('#q-produit', X('rech2')); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  const r2 = await p.evaluate(() => window.__pwn || null);
  // 5. La politique de sécurité de la page : même si du code hostile arrivait dans la page, il ne s'exécuterait pas
  const r3 = await p.evaluate(() => new Promise(res => { document.body.insertAdjacentHTML('beforeend', '<img src="data:image/gif;base64,AAAA" onerror="window.__csp=1">');
    const sc = document.createElement('script'); sc.textContent = 'window.__csp2=1'; document.body.appendChild(sc);
    const ext = document.createElement('script'); ext.src = 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js'; ext.onload = () => { window.__csp3 = 1; }; document.body.appendChild(ext);
    setTimeout(() => res({ gestionnaire: !!window.__csp, scriptAjoute: !!window.__csp2, scriptExterne: !!window.__csp3 }), 1500); }));
  const r4 = await p.evaluate(() => fetch('https://example.com/').then(() => 'envoi possible', () => 'envoi bloqué'));
  console.log('fiche piégée affichée :', JSON.stringify(titre.slice(0, 60)));
  console.log('code exécuté après la fiche piégée :', JSON.stringify(r1), '| après stockage, adresses et recherches piégés :', JSON.stringify(r2), '| erreurs de page :', JSON.stringify(err.slice(0, 3)));
  console.log('politique de sécurité, code injecté exécuté :', JSON.stringify(r3), '| vers un site tiers :', r4);
  const perce = r3.gestionnaire || r3.scriptAjoute || r3.scriptExterne || r4 !== 'envoi bloqué';
  await b.close(); process.exit(r1 || r2 || perce ? 1 : 0);
})().catch(e => { console.log('EXCEPTION', e.message.split('\n')[0]); process.exit(2); });
