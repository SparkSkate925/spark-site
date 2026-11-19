# SPARK — www.sparkskate.com

Mettre une nouvelle version du site en ligne : remplacer `index.html` (sur GitHub : Add file → Upload files → Commit).
Vercel redéploie automatiquement en ~1 minute. À chaque déploiement, `build.mjs` :
- remet l'adresse officielle https://www.sparkskate.com/
- branche le paiement Stripe (`spark-checkout.js`)
- relit les prix (`const products=[...]`) et codes promo (`const PROMOS={...}`) de index.html pour le paiement.

Ne pas modifier : `build.mjs`, `spark-checkout.js`, `api/`, `vercel.json`.
