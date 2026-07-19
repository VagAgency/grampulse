# Déploiement API GramPulse (Render)

Même architecture que Spoofizy : **API sur Render**, **frontend sur Netlify**, **paiements Whop**, **DNS OVH**.

## Domaine recommandé

| Usage | URL |
|---|---|
| Site & app | `https://grampulse.com` et `https://www.grampulse.com` |
| API | `https://api.grampulse.com` |

Achète `grampulse.com` sur OVH (ou ton registrar habituel).

---

## 1. Pousser le code sur GitHub

```bash
cd ~/Projects/photo-spoof/grampulse
git add .
git commit -m "Prepare SaaS deployment"
# Crée un repo vide sur github.com/new nommé grampulse
git remote add origin https://github.com/VagAgency/grampulse.git
git push -u origin main
```

---

## 2. Créer l'API sur Render

1. Va sur [render.com](https://render.com) → **New +** → **Blueprint**
2. Connecte le repo GitHub `grampulse`
3. Render lit `render.yaml` et crée `grampulse-api` (Docker + disque persistant)

Test : `https://grampulse-api.onrender.com/health`

---

## 3. Variables d'environnement (Render → Environment)

| Variable | Valeur |
|---|---|
| `HIKERAPI_ACCESS_KEY` | Ta clé HikerAPI |
| `LINKSCALE_API_KEY` | Ta clé Linkscale (`lk_...`) |
| `LINKSCALE_TIMEZONE` | `Europe/Paris` |
| `WHOP_API_KEY` | Clé API Whop (`apik_...`) |
| `WHOP_WEBHOOK_SECRET` | Secret webhook Whop (`whsec_...`) |
| `WHOP_PLAN_ID` | `plan_duJvdhlQGgfDY` |
| `WHOP_PRODUCT_ID` | `prod_dJcY2U9SHlGwh` |
| `WHOP_CHECKOUT_URL` | *(laisser vide — le checkout utilise `plan_duJvdhlQGgfDY`)* |
| `WHOP_RETURN_URL` | `https://grampulse.app/account?checkout=success` |
| `APP_URL` | `https://grampulse.com` |
| `ALLOWED_ORIGINS` | `https://grampulse.com,https://www.grampulse.com` |
| `GRAMPULSE_PLAN_LABEL` | `GramPulse Pro` |
| `GRAMPULSE_PRICE_LABEL` | `99 €/mois` |
| `DEV_BYPASS_EMAIL` | *(vide en prod — ton email en dev local)* |

`GRAMPULSE_DB` est déjà défini dans `render.yaml` → `/var/data/grampulse.db` (disque persistant).

### Disque persistant (obligatoire pour garder tes comptes)

Sans disque, Render stocke la base dans `/tmp` : **chaque redéploiement efface tout**.

1. Render → service `grampulse-api` → **Disks** → ajoute un disque :
   - **Mount path** : `/var/data`
   - **Size** : 1 GB
2. Vérifie que `GRAMPULSE_DB` = `/var/data/grampulse.db` (et **pas** `/tmp/grampulse.db`)
3. Redéploie une fois
4. Contrôle : `GET https://api.grampulse.app/health` → `persist.volume_mounted: true` et `db_path: /var/data/grampulse.db`

À chaque ajout/suppression de compte, l’API sauvegarde aussi un fichier JSON sur ce disque (`/var/data/backups/…`) pour récupération automatique au démarrage.

---

## 4. Domaine API (OVH + Render)

**OVH → Zone DNS :**
```
api.grampulse.com  →  CNAME  →  grampulse-api.onrender.com
```

**Render → Settings → Custom Domains :** ajoute `api.grampulse.com`

---

## 5. Webhook Whop

Dans le dashboard Whop → Webhooks → Add endpoint :
```
https://api.grampulse.com/whop/webhook
```

Événements : `membership.activated`, `membership.deactivated`, `payment.succeeded`

---

## 6. Frontend Netlify

1. [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Repo `grampulse`, **Base directory** : `web`
3. Build : `npm run build` (déjà dans `netlify.toml`)
4. Variable d'environnement :
   ```
   NEXT_PUBLIC_API_URL=https://api.grampulse.com
   ```
5. **Domain management** → ajoute `grampulse.com` et `www.grampulse.com`

**OVH → Zone DNS (frontend) :**
```
grampulse.com      →  A      →  75.2.60.5   (IP Netlify — vérifie dans Netlify)
www.grampulse.com  →  CNAME  →  ton-site.netlify.app
```

---

## 7. Créer le produit Whop

1. [whop.com/dashboard](https://whop.com/dashboard) → **Products** → **New product**
2. Nom : **GramPulse Pro**
3. Prix : **99 €/mois** (ou ton tarif)
4. Copie `plan_...` → `WHOP_PLAN_ID` sur Render
5. Copie les clés API et webhook secret

---

## 8. Ton accès perso (sans payer)

En **local**, dans `.env` :
```
DEV_BYPASS_EMAIL=ton@email.com
```

En **prod**, ajoute temporairement la même variable sur Render le temps de tester, puis retire-la une fois Whop configuré — ou abonne-toi avec ton email via Whop.

---

## 9. Vérification finale

| Test | URL |
|---|---|
| API health | `https://api.grampulse.com/health` |
| Whop config | `https://api.grampulse.com/whop/config-check` |
| Landing | `https://grampulse.com` |
| Checkout | Bouton « S'abonner » sur la landing |
| Dashboard | `https://grampulse.com/login` après paiement |

---

## Coûts estimés

| Service | Coût |
|---|---|
| Render Standard (API) | ~25 $/mois |
| Netlify (frontend) | Gratuit → Pro si besoin |
| Domaine OVH | ~10 €/an |
| HikerAPI | Pay-as-you-go (~0,002 $/compte) |
| Whop | Commission sur ventes |
