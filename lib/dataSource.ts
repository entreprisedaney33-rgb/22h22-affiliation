// ─────────────────────────────────────────────────────────────────
// Source de données — Google Sheets avec fallback mock.
//
// Comportement :
//   DATA_SOURCE=mock        → toujours mock (mémoire, mutable)
//   DATA_SOURCE=sheets      → essaye Sheets, retombe sur mock READ-ONLY
//                              si Sheets échoue (avec un log explicite)
//   DATA_SOURCE absent      → "sheets" par défaut si GOOGLE_SHEET_ID est
//                              défini, sinon "mock"
// ─────────────────────────────────────────────────────────────────

import type {
  Commercial,
  Manager,
  Produit,
  Commande,
  Commission,
  Abonnement,
  Paiement,
  StatutCommission,
} from "./types";

import {
  mockCommerciaux,
  mockManagers,
  mockProduits,
  mockCommandes,
  mockCommissions,
  mockAbonnements,
  mockPaiements,
} from "./mockData";

import * as gs from "./googleSheets";

// ─── Détection du mode ─────────────────────────────────────────────
function resolveMode(): "mock" | "sheets" {
  const explicit = (process.env.DATA_SOURCE || "").toLowerCase().trim();
  if (explicit === "mock") return "mock";
  if (explicit === "sheets") return "sheets";
  // Auto : sheets si l'ID est défini sous l'un des deux noms tolérés.
  const hasId = !!(process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID);
  return hasId ? "sheets" : "mock";
}

const MODE = resolveMode();

// ─── État mock mutable (utilisé seulement en mode mock) ────────────
let _mockCommerciaux: Commercial[] = [...mockCommerciaux];
let _mockCommissions: Commission[] = [...mockCommissions];

// ─── Helper de fallback ────────────────────────────────────────────
// Compteur global de fallbacks mock survenus pendant la vie du process.
// Exposé pour /api/health/sheets et la bannière admin.
let _mockFallbackCount = 0;
let _lastMockFallback: { label: string; at: number; reason: string } | null = null;

export function getMockFallbackStats() {
  return {
    count: _mockFallbackCount,
    last: _lastMockFallback,
  };
}

async function tryOrFallback<T>(
  label: string,
  fromSheets: () => Promise<T>,
  fallback: () => T
): Promise<T> {
  if (MODE === "mock") return fallback();
  try {
    return await fromSheets();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    _mockFallbackCount++;
    _lastMockFallback = { label, at: Date.now(), reason };
    // Log très visible dans les Vercel Function Logs.
    console.error(
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️  FALLBACK MOCK déclenché sur ${label}()\n` +
      `Raison : ${reason}\n` +
      `Conséquence : la page va afficher des données MOCK\n` +
      `au lieu des vraies données Google Sheets.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    );
    return fallback();
  }
}

// ─── Déduplication ─────────────────────────────────────────────────
//
// Si Apps Script crée par erreur plusieurs lignes pour la même
// commande_id (par exemple parce que Shopify rejoue un webhook), on
// les regroupe ici à la lecture. La vraie correction est côté Apps
// Script : avant d'append, vérifier que la commande_id n'existe pas.
//
// Stratégie :
//   - Commandes  : 1 ligne par commande_id (on garde la 1re trouvée)
//   - Commissions: 1 ligne par (commande_id, role_beneficiaire), car
//                  une commande légitime a 2 lignes (vendeur + manager).
//                  Pour les commissions sans commande_id (cas tordu),
//                  on dédupe par commission_id.

function dedupeCommandes(list: Commande[]): {
  unique: Commande[];
  removed: number;
} {
  const seen = new Set<string>();
  const unique: Commande[] = [];
  let removed = 0;
  for (const c of list) {
    // Clé unique recommandée : shopify_order_id si présent (c'est
    // l'identifiant Shopify, stable et unique par vente), sinon on
    // retombe sur commande_id.
    const key = (c.shopify_order_id || "").trim() || (c.commande_id || "").trim();
    if (!key) {
      // pas d'id du tout : on garde (impossible de dédupe sans clé)
      unique.push(c);
      continue;
    }
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    unique.push(c);
  }
  return { unique, removed };
}

function dedupeCommissions(list: Commission[]): {
  unique: Commission[];
  removed: number;
} {
  const seen = new Set<string>();
  const unique: Commission[] = [];
  let removed = 0;
  for (const c of list) {
    const cid = (c.commande_id || "").trim();
    // Clé fonctionnelle : pour une même commande, il ne peut y avoir
    // qu'UNE commission par (type, bénéficiaire, rôle). C'est la clé
    // métier qui garantit "1 commission vendeur + 1 commission manager"
    // maximum par commande produit.
    const key = cid
      ? `cmd:${cid}::${c.type_commission}::${c.commercial_id}::${c.role_beneficiaire}`
      : `id:${(c.commission_id || "").trim()}`;

    // Si aucune clé exploitable, on garde la ligne (ne pas perdre de
    // données par excès de zèle).
    if (!cid && !c.commission_id) {
      unique.push(c);
      continue;
    }
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    unique.push(c);
  }
  return { unique, removed };
}

// Compteur global exposé pour la bannière admin.
// Reset à chaque appel pertinent.
let _lastDuplicateCount = 0;
export function getLastDuplicateCount(): number {
  return _lastDuplicateCount;
}

// ─── Lectures ──────────────────────────────────────────────────────

export async function getCommerciaux(): Promise<Commercial[]> {
  return tryOrFallback(
    "getCommerciaux",
    () => gs.sheetsGetCommerciaux(),
    () => _mockCommerciaux
  );
}

export async function getCommercialById(id: string): Promise<Commercial | null> {
  const all = await getCommerciaux();
  return all.find((c) => c.commercial_id === id) ?? null;
}

export async function getCommercialByEmail(email: string): Promise<Commercial | null> {
  const target = email.toLowerCase().trim();
  const all = await getCommerciaux();
  return all.find((c) => c.email.toLowerCase().trim() === target) ?? null;
}

export async function getManagers(): Promise<Manager[]> {
  return tryOrFallback(
    "getManagers",
    () => gs.sheetsGetManagers(),
    () => mockManagers
  );
}

export async function getProduits(): Promise<Produit[]> {
  return tryOrFallback(
    "getProduits",
    () => gs.sheetsGetProduits(),
    () => mockProduits
  );
}

export async function getCommandes(): Promise<Commande[]> {
  const raw = await tryOrFallback(
    "getCommandes",
    () => gs.sheetsGetCommandes(),
    () => mockCommandes
  );
  const { unique, removed } = dedupeCommandes(raw);
  if (removed > 0) {
    _lastDuplicateCount += removed;
    console.warn(
      `[dataSource] Commandes : ${removed} doublon(s) par commande_id ignoré(s) à la lecture. ` +
      `À corriger côté Apps Script (idempotence du webhook orders/paid).`
    );
  }
  return unique;
}

export async function getCommissions(): Promise<Commission[]> {
  const raw = await tryOrFallback(
    "getCommissions",
    () => gs.sheetsGetCommissions(),
    () => _mockCommissions
  );
  const { unique, removed } = dedupeCommissions(raw);
  if (removed > 0) {
    _lastDuplicateCount += removed;
    console.warn(
      `[dataSource] Commissions : ${removed} doublon(s) par (commande_id, rôle) ignoré(s) à la lecture. ` +
      `À corriger côté Apps Script (idempotence du webhook orders/paid).`
    );
  }
  return unique;
}

// Lectures brutes (sans déduplication) — utiles pour le diagnostic
// admin. Ne pas utiliser dans les dashboards de tous les jours.
export async function getCommandesRaw(): Promise<Commande[]> {
  return tryOrFallback(
    "getCommandesRaw",
    () => gs.sheetsGetCommandes(),
    () => mockCommandes
  );
}

export async function getCommissionsRaw(): Promise<Commission[]> {
  return tryOrFallback(
    "getCommissionsRaw",
    () => gs.sheetsGetCommissions(),
    () => _mockCommissions
  );
}

/**
 * Compte les doublons dans les onglets actuels.
 * Utilisé par la bannière admin et /api/health/sheets.
 */
export async function getDuplicatesStats(): Promise<{
  commandes_doublons: number;
  commissions_doublons: number;
}> {
  const [cmds, comm] = await Promise.all([
    getCommandesRaw(),
    getCommissionsRaw(),
  ]);
  const { removed: cmdDup } = dedupeCommandes(cmds);
  const { removed: comDup } = dedupeCommissions(comm);
  return {
    commandes_doublons: cmdDup,
    commissions_doublons: comDup,
  };
}

export async function getAbonnements(): Promise<Abonnement[]> {
  return tryOrFallback(
    "getAbonnements",
    () => gs.sheetsGetAbonnements(),
    () => mockAbonnements
  );
}

export async function getPaiements(): Promise<Paiement[]> {
  return tryOrFallback(
    "getPaiements",
    () => gs.sheetsGetPaiements(),
    () => mockPaiements
  );
}

// ─── Écritures ─────────────────────────────────────────────────────
//
// En mode mock : on mute la mémoire.
// En mode sheets : on délègue à Sheets. Si ça échoue on remonte
// l'erreur (l'UI affiche le message), on ne replie PAS silencieusement
// sur le mock pour les writes — un changement de statut qui semble
// réussir mais ne persiste pas serait pire qu'une erreur claire.

export interface CommissionFallbackKey {
  commande_id?: string;
  type_commission?: string;
  commercial_id?: string;
  role_beneficiaire?: string;
}

export async function updateCommissionStatut(
  commission_id: string,
  statut: StatutCommission,
  fallback?: CommissionFallbackKey
): Promise<Commission | null> {
  if (MODE === "sheets") {
    return gs.sheetsUpdateCommissionStatut(commission_id, statut, fallback);
  }
  // Mode mock : match par id, sinon par quadruplet fonctionnel.
  let idx = _mockCommissions.findIndex((c) => c.commission_id === commission_id);
  if (idx === -1 && fallback?.commande_id) {
    idx = _mockCommissions.findIndex(
      (c) =>
        c.commande_id === fallback.commande_id &&
        c.type_commission === fallback.type_commission &&
        c.commercial_id === fallback.commercial_id &&
        c.role_beneficiaire === fallback.role_beneficiaire
    );
  }
  if (idx === -1) return null;
  _mockCommissions[idx] = { ..._mockCommissions[idx], statut };
  return _mockCommissions[idx];
}

export async function createCommercial(
  data: Omit<Commercial, "commercial_id" | "lien_affilie" | "date_creation">
): Promise<Commercial> {
  if (MODE === "sheets") {
    return gs.sheetsCreateCommercial(data);
  }
  const shopify = process.env.NEXT_PUBLIC_SHOPIFY_URL || "https://22h22foret.fr";
  const next = `COM${String(_mockCommerciaux.length + 1).padStart(3, "0")}`;
  const created: Commercial = {
    ...data,
    commercial_id: next,
    lien_affilie: `${shopify}/?ref=${data.code_affilie}`,
    date_creation: new Date().toISOString().slice(0, 10),
  };
  _mockCommerciaux.push(created);
  return created;
}

export async function updateCommercial(
  commercial_id: string,
  patch: Partial<Commercial>
): Promise<Commercial | null> {
  if (MODE === "sheets") {
    return gs.sheetsUpdateCommercial(commercial_id, patch);
  }
  const idx = _mockCommerciaux.findIndex((c) => c.commercial_id === commercial_id);
  if (idx === -1) return null;
  _mockCommerciaux[idx] = { ..._mockCommerciaux[idx], ...patch };
  return _mockCommerciaux[idx];
}

// Pour debug : exposé en lecture seule.
export const __mode = MODE;
