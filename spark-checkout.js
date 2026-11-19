// SPARK — paiement par carte via Stripe Checkout.
// Ajouté automatiquement à chaque version du site par build.mjs : il remplace la commande
// par email par le paiement Stripe, en gardant l'email en secours si Stripe est indisponible.
(function () {
  var navUrl = '';
  try { navUrl = performance.getEntriesByType('navigation')[0].name || ''; } catch (e) {}
  navUrl = navUrl || location.href;

  var emailCheckout = typeof window.checkout === 'function' ? window.checkout : null;

  var btn = document.querySelector('.checkout-btn');
  if (btn) { btn.id = 'checkout-btn'; btn.textContent = 'Payer par carte →'; }

  function getCart() { try { return cart; } catch (e) { return []; } }
  function setCart(c) { try { cart = c; if (typeof updateCart === 'function') updateCart(); } catch (e) {} }
  function promo() { try { return discountPct > 0 ? PROMO_CODE : null; } catch (e) { return null; } }
  function say(m) { try { toast(m); } catch (e) { alert(m); } }

  window.checkout = async function () {
    var items = getCart();
    if (!items || !items.length) return;
    var b = document.getElementById('checkout-btn');
    var label = b ? b.textContent : '';
    if (b) { b.disabled = true; b.textContent = 'Redirection vers le paiement…'; }
    try {
      var r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promo: promo(), items: items.map(function (i) { return { id: i.id, size: i.size, qty: i.qty }; }) })
      });
      var d = await r.json().catch(function () { return {}; });
      if (r.ok && d.url) {
        try { sessionStorage.setItem('spark_cart', JSON.stringify(items)); } catch (e) {}
        location.href = d.url;
        return;
      }
      if (b) { b.disabled = false; b.textContent = label; }
      if (r.status === 503 && emailCheckout) { emailCheckout(); return; }
      say(d.error || 'Paiement indisponible, réessaie dans un instant');
    } catch (e) {
      if (b) { b.disabled = false; b.textContent = label; }
      say('Connexion impossible, réessaie dans un instant');
    }
  };

  if (navUrl.indexOf('success=1') !== -1) {
    setCart([]);
    try { sessionStorage.removeItem('spark_cart'); } catch (e) {}
  } else if (navUrl.indexOf('canceled=1') !== -1) {
    try {
      var saved = JSON.parse(sessionStorage.getItem('spark_cart') || '[]');
      if (saved.length) setCart(saved);
    } catch (e) {}
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }
})();
