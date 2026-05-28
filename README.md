# 22h22 Affiliation

Plateforme privée d'affiliation pour [22h22foret.fr](https://22h22foret.fr).
Interface Next.js + Tailwind qui se branche au-dessus de l'écosystème
existant (Shopify → Apps Script → Google Sheets) sans rien remplacer.

> **Important** — cette interface ne touche pas à Shopify et ne réécrit
> pas la logique d'Apps Script. Elle lit / affiche / organise les
> données du Google Sheet et permet à l'admin de faire évoluer les
> statuts des commissions.

---

## 🚀 Déploiement Vercel

### 1. Variables d'environnement requises

| Variable | Valeur attendue |
|----------|-----------------|
| `GOOGLE_SHEET_ID` (ou `GOOGLE_SHEETS_ID`) | ID du Sheet (segment entre `/d/` et `/edit` dans l'URL) |
| `GOOGLE_CLIENT_EMAIL` | Email du service account Google Cloud |
| `GOOGLE_PRIVATE_KEY` | Clé privée du service account, avec `\n` littéraux |
| `NEXTAUTH_SECRET` | Secret aléatoire pour signer les cookies (`openssl rand -hex 32`) |
| `NEXTAUTH_URL` | URL de l'app déployée |
| `NEXT_PUBLIC_SHOPIFY_URL` | `https://22h22foret.fr` (facultatif, défaut) |
| `DATA_SOURCE` | Facultatif. `sheets` (défaut si `GOOGLE_SHEET_ID` présent) ou `mock` |

> Le code tolère les deux orthographes `GOOGLE_SHEET_ID` et
> `GOOGLE_SHEETS_ID` pour rester compatible avec ta config Vercel
> existante.

### 2. Partager le Sheet

Le Sheet identifié par `GOOGLE_SHEET_ID` doit être partagé avec
l'email `GOOGLE_CLIENT_EMAIL` en **droits Éditeur** (pour pouvoir
écrire les changements de statut).

### 3. Déployer

```bash
npm install
npm run build       # vérification locale
git add .
git commit -m "..."
git push            # Vercel déploie automatiquement
```

---

## 🔐 Authentification

Le login utilise l'onglet **Commerciaux** du Sheet avec ces colonnes :

- `email`
- `mot_de_passe_temp`
- `role` (`admin`, `manager`, `commercial`)
- `statut` (`Actif`, `Inactif`, `Suspendu`)

**Règles :**

- Connexion acceptée uniquement si `statut == "Actif"` (insensible à
  la casse — `Actif`, `actif`, `ACTIF` fonctionnent tous)
- Aucun compte démo en dur — seul le Sheet fait foi
- Une fois connecté, le cookie de session est signé via HMAC-SHA256
  avec `NEXTAUTH_SECRET`

### Cloisonnement par rôle

| Rôle | Voit |
|------|------|
| `admin` | Tout — tous les comptes, toutes les commandes, toutes les commissions, paramètres |
| `manager` | Son équipe : commerciaux dont `manager_id` = son `commercial_id` (ou son email en fallback), plus leurs ventes et commissions, plus sa commission manager |
| `commercial` | Uniquement ses propres ventes et commissions |

Le filtrage côté commercial / manager est **tolérant** : il accepte
que les lignes Sheet référencent un commercial par son
`commercial_id`, son `code_affilie` ou son `email`. Pour le manager,
même chose avec `manager_id` ou son email.

---

## 🗂 Mapping Sheet → app

Le mapping est **tolérant aux variantes de noms de colonnes** :

- minuscules / majuscules sans importance
- accents retirés (`prénom` → `prenom`)
- espaces et tirets convertis en `_` (`Code affilié` → `code_affilie`)
- plusieurs alias acceptés par champ

### Onglet `Commerciaux`

| Champ app | Colonnes acceptées dans le Sheet |
|-----------|----------------------------------|
| `commercial_id` | `commercial_id`, `id`, `id_commercial` |
| `prenom` | `prenom`, `prénom`, `firstname`, `first_name` |
| `nom` | `nom`, `lastname`, `last_name` |
| `email` | `email`, `mail`, `e_mail` |
| `mot_de_passe_temp` | `mot_de_passe_temp`, `mot_de_passe`, `mdp`, `password` |
| `role` | `role`, `rôle`, `type` — valeurs `admin` / `manager` / `commercial` |
| `manager_id` | `manager_id`, `id_manager`, `manager` |
| `code_affilie` | `code_affilie`, `code`, `code_affiliation` |
| `lien_affilie` | `lien_affilie`, `lien`, `lien_affiliation` (auto-généré sinon) |
| `statut` | `statut`, `etat`, `état` — `Actif` requis pour login |
| `date_creation` | `date_creation`, `date_création`, `created_at` |

### Onglet `Commandes`

| Champ app | Colonnes acceptées |
|-----------|--------------------|
| `commande_id` | `commande_id`, `id_commande`, `id`, `order_id` |
| `date` | `date`, `date_commande`, `created_at` |
| `client_email` | `client_email`, `email_client`, `client`, `customer_email` |
| `produit_id` | `produit_id`, `id_produit` |
| `produit_nom` | `produit_nom`, `produit`, `nom_produit`, `product_name` |
| `montant` | `montant`, `prix`, `total`, `amount` |
| `code_affilie` | `code_affilie`, `code`, `ref` |
| `commercial_id` | `commercial_id`, `id_commercial` |
| `manager_id` | `manager_id`, `id_manager` |
| `statut` | `statut`, `etat`, `état` — `payée` / `remboursée` / `en_attente` |

### Onglet `Commissions`

| Champ app | Colonnes acceptées |
|-----------|--------------------|
| `commission_id` | `commission_id`, `id_commission`, `id` |
| `date_creation` | `date_creation`, `date_création`, `created_at` |
| `date_commission` | `date_commission`, `date_due` |
| `type_commission` | `type_commission`, `type` |
| `commande_id` | `commande_id`, `id_commande`, `order_id` |
| `subscription_id` | `subscription_id`, `id_abonnement`, `abonnement_id` |
| `commercial_id` | `commercial_id`, `id_commercial`, `beneficiaire_id` |
| `role_beneficiaire` | `role_beneficiaire`, `beneficiaire` — `commercial` ou `manager` |
| `base_commission_vendeur` | `base_commission_vendeur`, `base_commission`, `base` |
| `commission_vendeur` | `commission_vendeur`, `commission`, `montant` |
| `manager_id` | `manager_id`, `id_manager` |
| `statut` | `statut` — `À valider`, `Validée`, `À payer`, `Payée`, `Annulée` |

### Autres onglets

- `Abonnements`, `Paiements`, `Logs`, `Clics_Affiliation` — lus en
  best-effort. Si l'onglet est manquant, l'app continue sans crasher.
- `Produits` — facultatif. S'il n'existe pas, le catalogue de
  référence interne est utilisé pour l'affichage des règles.

---

## 🛟 Fallback automatique

Si l'API Google Sheets renvoie une erreur (clé invalide, partage
manquant, onglet absent, quota...), **les pages continuent de
s'afficher** en retombant sur les données mock de
`lib/mockData.ts`. Un log clair apparaît dans la console serveur :

```
[dataSource] getCommandes : Google Sheets indisponible, fallback mock. <raison>
```

> Les **écritures** (changement de statut, création de commercial)
> ne se replient PAS sur le mock — elles remontent l'erreur à l'UI.
> Un changement qui semble réussir mais ne persiste pas serait pire
> qu'une erreur claire.

---

## 🏗 Architecture

```
22h22-affiliation/
├── app/
│   ├── login/                ← page de connexion (Sheet-only)
│   ├── commercial/           ← dashboard vendeur (filtré pour lui)
│   ├── manager/              ← dashboard manager (filtré pour son équipe)
│   ├── admin/
│   │   ├── page.tsx          ← vue d'ensemble
│   │   ├── commerciaux/      ← liste + nouveau + édition
│   │   ├── commissions/      ← tableau filtres + changement statut
│   │   └── parametres/       ← réglages + grille commissions
│   ├── api/
│   │   ├── auth/             ← login + logout
│   │   ├── commerciaux/      ← POST + PATCH
│   │   └── commissions/[id]/ ← PATCH (statut)
│   ├── layout.tsx
│   ├── page.tsx              ← redirige selon le rôle
│   └── globals.css
│
├── components/
│   ├── ui/                   ← Logo, Card, Button, Badge, Table, CopyLink…
│   ├── layout/               ← AppShell, AdminShell, PageHeader
│   └── dashboard/            ← CommercialForm, CommissionsTable
│
├── lib/
│   ├── types.ts              ← types métier alignés sur les onglets Sheets
│   ├── auth.ts               ← session cookie HMAC + login Sheet
│   ├── commissions.ts        ← règles métier + helpers de format
│   ├── selectors.ts          ← agrégats + helpers de cloisonnement
│   ├── dataSource.ts         ← bascule sheets / mock + fallback
│   ├── mockData.ts           ← données de secours
│   └── googleSheets.ts       ← adapter Google Sheets réel
│
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── package.json              ← inclut googleapis
```

### Convention forte

> L'UI n'accède **jamais** à `mockData.ts` ni à `googleSheets.ts`
> directement. Elle passe par les fonctions de `lib/dataSource.ts`. Ce
> seul fichier décide où lire et où écrire.

---

## 💻 Développement local

```bash
# 1. installer les dépendances
npm install

# 2. configurer
cp .env.example .env.local
# → renseigner les vraies variables Google + NEXTAUTH_SECRET

# 3. lancer
npm run dev
# → http://localhost:3000
```

### Mode mock pour développer sans Sheets

```bash
DATA_SOURCE=mock npm run dev
```

Utile pour itérer sur l'UI sans dépendre du Sheet réel. Les
modifications de statut / création de commercial sont alors en
mémoire et disparaissent au redémarrage.

---

## 📜 Règles de commission

Centralisées dans `lib/commissions.ts` (`REGLES_COMMISSION`). Si tu
changes les montants ici, **change-les aussi dans Apps Script** —
c'est Apps Script qui écrit réellement les commissions en prod.

| Produit | Vendeur | Manager (20 %) | Déclenchement |
|---------|---------|---------------|---------------|
| Coffret 176 € | 50 € | 10 € | À la vente |
| Abonnement J+30 | 10 € | 2 € | 30 jours après |
| Abonnement J+60 | 5 € | 1 € | 60 jours après *(prévu, non automatisé)* |
| Abonnement récurrent | 1 € / mois | 0,20 € | Mensuel *(prévu, non automatisé)* |

---

## 🔒 Sécurité

**Aujourd'hui (MVP)**

- Mots de passe stockés en clair dans le Sheet (`mot_de_passe_temp`).
- Session = cookie httpOnly signé HMAC-SHA256 avec `NEXTAUTH_SECRET`.
- Cloisonnement par rôle vérifié côté serveur sur chaque page.
- Les routes API d'administration vérifient `role === "admin"`.

**Avant de figer en prod**

- [ ] Hasher `mot_de_passe_temp` (bcrypt) — adapter `authenticate()`
      dans `lib/auth.ts`
- [ ] Limiter les tentatives de connexion (rate limit)
- [ ] Rotation périodique de `NEXTAUTH_SECRET`

---

## 📜 Licence

Projet privé — ne pas redistribuer.
