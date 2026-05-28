# Fix Apps Script — idempotence Commandes + Commissions

> **Pourquoi ici et pas dans Next ?** C'est Apps Script qui écrit dans
> `Commandes` et `Commissions` quand Shopify envoie `orders/paid`. Next
> ne fait que lire. Donc l'idempotence de l'écriture (ne pas créer 2
> fois la même ligne) DOIT être codée dans Apps Script.
>
> Next, de son côté :
>   - dédoublonne à la LECTURE (les dashboards n'affichent jamais de
>     doublon, clé = shopify_order_id sinon commande_id) ;
>   - fournit `/api/admin/cleanup-duplicates` pour nettoyer l'existant.
>
> Mais sans le fix ci-dessous, les doublons reviendront à chaque vente.

---

## 1. Commandes — ne créer qu'une ligne par `shopify_order_id`

```javascript
const SHEET_ID = "TON_SHEET_ID";

/** Retourne le numéro de ligne (1-based) d'une commande existante, ou -1. */
function findCommandeRow(shopifyOrderId) {
  if (!shopifyOrderId) return -1;
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Commandes");
  if (!sheet) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = headers.findIndex(h =>
    String(h).trim().toLowerCase() === "shopify_order_id"
  ) + 1;
  if (col < 1) return -1;

  const ids = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  const target = String(shopifyOrderId).trim();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === target) return i + 2;
  }
  return -1;
}

function upsertCommande(commande) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Commandes");
  const existingRow = findCommandeRow(commande.shopify_order_id);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // Construire la ligne dans l'ordre des colonnes du Sheet
  const rowValues = headers.map(h => {
    const key = String(h).trim().toLowerCase();
    return commande[key] !== undefined ? commande[key] : "";
  });

  if (existingRow > 0) {
    // MISE À JOUR de la ligne existante (pas de nouvelle ligne)
    sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
    Logger.log("Commande " + commande.shopify_order_id + " mise à jour (ligne " + existingRow + ")");
  } else {
    sheet.appendRow(rowValues);
    Logger.log("Commande " + commande.shopify_order_id + " créée");
  }
}
```

## 2. Commissions — vérifier avant d'append

Clé fonctionnelle : `commande_id + type_commission + commercial_id + role_beneficiaire`.

```javascript
function commissionExiste(commandeId, typeCommission, commercialId, roleBeneficiaire) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Commissions");
  if (!sheet) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).trim().toLowerCase());

  const idx = name => headers.indexOf(name);
  const cCmd = idx("commande_id");
  const cType = idx("type_commission");
  const cComm = idx("commercial_id");
  const cRole = idx("role_beneficiaire");
  if (cCmd < 0) return false;

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (const row of data) {
    const sameCmd  = String(row[cCmd]).trim()  === String(commandeId).trim();
    const sameType = cType < 0 || String(row[cType]).trim() === String(typeCommission).trim();
    const sameComm = cComm < 0 || String(row[cComm]).trim() === String(commercialId).trim();
    const sameRole = cRole < 0 || String(row[cRole]).trim() === String(roleBeneficiaire).trim();
    if (sameCmd && sameType && sameComm && sameRole) return true;
  }
  return false;
}

function creerCommissionSiAbsente(commission) {
  if (commissionExiste(
    commission.commande_id,
    commission.type_commission,
    commission.commercial_id,
    commission.role_beneficiaire
  )) {
    Logger.log("Commission déjà existante — skip : " +
      commission.commande_id + "/" + commission.role_beneficiaire);
    return;
  }
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Commissions");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowValues = headers.map(h => {
    const key = String(h).trim().toLowerCase();
    return commission[key] !== undefined ? commission[key] : "";
  });
  sheet.appendRow(rowValues);
}
```

## 3. Le handler webhook complet

```javascript
function onOrderPaid(e) {
  const order = JSON.parse(e.postData.contents);
  const shopifyOrderId = String(order.id);

  // 1. Upsert commande (jamais 2 lignes pour le même shopify_order_id)
  upsertCommande({
    commande_id: "CMD" + order.order_number,
    shopify_order_id: shopifyOrderId,
    shopify_order_name: order.name,         // ex "#1042"
    date: order.created_at,
    client_email: order.email,
    montant: order.total_price,
    // ... le reste de tes colonnes
  });

  // 2. Commission vendeur — créée une seule fois
  creerCommissionSiAbsente({
    commission_id: "C-" + shopifyOrderId + "-V",
    commande_id: "CMD" + order.order_number,
    type_commission: "vente_produit",
    commercial_id: vendeurId,
    role_beneficiaire: "commercial",
    statut: "À valider",
    // ...
  });

  // 3. Commission manager — seulement si manager lié, une seule fois
  if (managerId) {
    creerCommissionSiAbsente({
      commission_id: "C-" + shopifyOrderId + "-M",
      commande_id: "CMD" + order.order_number,
      type_commission: "commission_manager",
      commercial_id: managerId,
      role_beneficiaire: "manager",
      statut: "À valider",
      // ...
    });
  }

  return ContentService.createTextOutput("ok");
}
```

## 4. Nettoyer l'existant (une fois)

Avant d'activer le fix, nettoie les doublons déjà présents :

**Option A — via Next (recommandé)**
```bash
# dry-run : voir ce qui serait supprimé
curl -X POST https://ton-domaine.vercel.app/api/admin/cleanup-duplicates \
  -H "Content-Type: application/json" -d '{}' \
  --cookie "h22_session=TON_COOKIE"

# appliquer
curl -X POST https://ton-domaine.vercel.app/api/admin/cleanup-duplicates \
  -H "Content-Type: application/json" -d '{"confirm":true}' \
  --cookie "h22_session=TON_COOKIE"
```
> Fais une copie du Sheet avant le run avec confirm:true.

**Option B — Google Sheets manuel**
Data → Nettoyage des données → Supprimer les doublons, en se basant
sur la colonne `shopify_order_id` (Commandes).
