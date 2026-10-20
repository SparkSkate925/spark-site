// SPARK — création d'une session Stripe Checkout à partir du panier.
// Les prix sont TOUJOURS relus ici (côté serveur) : le navigateur n'envoie que id / taille / quantité.
// Variables d'environnement Vercel :
//   STRIPE_SECRET_KEY  (obligatoire) clé secrète Stripe (sk_live_... ou sk_test_...)
//   SHIPPING_EUR       (optionnel)   frais de livraison en euros, ex. "4.90". Absent ou 0 = livraison offerte.
//   SITE_URL           (optionnel)   défaut https://www.sparkskate.com

const CATALOG = {
  spk01: { ref: 'SPK-01', name: 'SIGNATURE', sub: 'Tee Oversize · Dos Imprimé', price: 45, available: true },
  spk02: { ref: 'SPK-02', name: 'VELOCITY', sub: 'Tee Oversize · Effet Vitesse', price: 45, available: false },
  spk03: { ref: 'SPK-03', name: 'STATIC', sub: 'Tee Oversize · Op-Art', price: 48, available: false },
  spk04: { ref: 'SPK-04', name: 'STACK', sub: 'Tee Oversize · Typographique', price: 45, available: false },
  spk05: { ref: 'SPK-05', name: 'BOLT', sub: 'Tee Oversize · Graphique', price: 48, available: true },
  spk06: { ref: 'SPK-06', name: 'ALL-OVER', sub: 'Tee Oversize · Full Print · Limited', price: 52, available: false },
};
const SIZES = ['S', 'M', 'L'];
const MAX_QTY = 10;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({ error: 'Paiement en ligne pas encore activé' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const items = body && Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.length > 20) return res.status(400).json({ error: 'Panier invalide' });

  const site = (process.env.SITE_URL || 'https://www.sparkskate.com').replace(/\/$/, '');
  const p = new URLSearchParams();
  p.append('mode', 'payment');
  p.append('locale', 'fr');
  p.append('success_url', site + '/?success=1');
  p.append('cancel_url', site + '/?canceled=1');
  p.append('shipping_address_collection[allowed_countries][0]', 'FR');
  p.append('phone_number_collection[enabled]', 'true');
  p.append('billing_address_collection', 'auto');

  const summary = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const prod = CATALOG[it.id];
    const size = String(it.size || '');
    const qty = parseInt(it.qty, 10);
    if (!prod || !prod.available || !SIZES.includes(size) || !(qty >= 1 && qty <= MAX_QTY)) {
      return res.status(400).json({ error: 'Article indisponible ou invalide' });
    }
    const k = `line_items[${i}]`;
    p.append(`${k}[quantity]`, String(qty));
    p.append(`${k}[price_data][currency]`, 'eur');
    p.append(`${k}[price_data][unit_amount]`, String(Math.round(prod.price * 100)));
    p.append(`${k}[price_data][product_data][name]`, `${prod.name} — Taille ${size}`);
    p.append(`${k}[price_data][product_data][description]`, `${prod.ref} · ${prod.sub}`);
    summary.push(`${prod.ref}-${size}x${qty}`);
  }
  p.append('metadata[commande]', summary.join(', ').slice(0, 500));
  p.append('payment_intent_data[description]', ('SPARK ' + summary.join(', ')).slice(0, 500));

  const ship = Math.round(parseFloat(process.env.SHIPPING_EUR || '0') * 100) || 0;
  p.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  p.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(ship));
  p.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'eur');
  p.append('shipping_options[0][shipping_rate_data][display_name]', ship ? 'Livraison suivie — France métropolitaine' : 'Livraison offerte — France métropolitaine');
  p.append('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  p.append('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]', '3');
  p.append('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  p.append('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]', '5');

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: p.toString(),
    });
    const data = await r.json();
    if (!r.ok || !data.url) {
      console.error('Stripe error', data && data.error);
      return res.status(502).json({ error: 'Le paiement est momentanément indisponible' });
    }
    return res.status(200).json({ url: data.url });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'Le paiement est momentanément indisponible' });
  }
};
