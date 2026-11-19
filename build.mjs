// SPARK — étape de build exécutée automatiquement par Vercel à chaque déploiement.
// Elle prend index.html TEL QUEL (n'importe quelle nouvelle version) et :
//   1. remplace l'ancienne adresse Netlify par https://www.sparkskate.com/
//   2. ajoute le script de paiement Stripe (spark-checkout.js) juste avant </body>
//   3. extrait le catalogue (const products=[...]) et les codes promo (const PROMOS={...})
//      vers api/catalog.json, pour que les prix payés sur Stripe = prix affichés sur le site.
// Résultat publié dans ./public
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public');
const SKIP = new Set(['public', 'api', 'node_modules', '.git', '.vercel', 'build.mjs', 'vercel.json', 'package.json', 'README.md']);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Copie de tous les fichiers statiques (images, autres pages éventuelles…)
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name) || name.startsWith('.')) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// 1. Adresse officielle
html = html.replace(/https:\/\/sparkskate\.netlify\.app\/?/g, 'https://www.sparkskate.com/');

// 2. Script de paiement
const tag = '<script src="/spark-checkout.js?v=' + Date.now() + '"></script>';
html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, tag + '\n</body>') : html + '\n' + tag;
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// 3. Catalogue + codes promo pour le serveur de paiement
function extract(re) {
  const m = html.match(re);
  if (!m) return null;
  try { return vm.runInNewContext('(' + m[1] + ')', {}, { timeout: 1000 }); } catch { return null; }
}
const products = extract(/const\s+products\s*=\s*(\[[\s\S]*?\])\s*;/);
const promos = extract(/const\s+PROMOS\s*=\s*(\{[^}]*\})\s*;/) || {};
const sizes = extract(/const\s+sizes\s*=\s*(\[[^\]]*\])\s*;/) || ['S', 'M', 'L'];
if (!Array.isArray(products) || !products.length) {
  console.error('ERREUR : catalogue "const products=[...]" introuvable dans index.html');
  process.exit(1);
}
const catalog = {};
for (const p of products) {
  if (!p || !p.id || typeof p.price !== 'number') continue;
  catalog[p.id] = { ref: p.ref || p.id, name: p.name || p.id, sub: p.sub || '', price: p.price, available: p.available !== false };
}
fs.writeFileSync(path.join(ROOT, 'api', 'catalog.json'), JSON.stringify({ builtAt: new Date().toISOString(), catalog, promos, sizes }, null, 2));
console.log('Build OK —', Object.keys(catalog).length, 'produits,', Object.keys(promos).length, 'codes promo');
