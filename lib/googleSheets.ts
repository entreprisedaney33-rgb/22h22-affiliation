// ─────────────────────────────────────────────────────────────────
// Google Sheets adapter — implémentation réelle.
//
// Le mapping est volontairement TOLÉRANT :
//   - les noms de colonnes sont normalisés (minuscules, accents
//     retirés, espaces et tirets convertis en underscore)
//   - on essaye plusieurs alias par champ
//
// Si le Sheet est inaccessible ou si une colonne critique manque,
// les fonctions throw une SheetsError. C'est dataSource.ts qui
// décide alors de retomber sur les données mock.
//
// Cache : 10 s en mémoire process pour éviter de retaper l'API à
// chaque requête Next.js (les pages SSR appellent get* plusieurs
// fois par render).
// ─────────────────────────────────────────────────────────────────

import { google, sheets_v4 } from "googleapis";
import type {
  Commercial,
  Manager,
  Produit,
  Commande,
  Commission,
  Abonnement,
  Paiement,
  Role,
  StatutCommercial,
  StatutCommande,
  StatutCommission,
  RoleBeneficiaire,
  TypeCommission,
} from "./types";

// ─── Erreur dédiée ────────────────────────────────────────────────
export class SheetsError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "SheetsError";
  }
}

// ─── Client Sheets (lazy + cached) ────────────────────────────────
let _sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (_sheetsClient) return _sheetsClient;

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !rawKey) {
    throw new SheetsError(
      "GOOGLE_CLIENT_EMAIL ou GOOGLE_PRIVATE_KEY manquant."
    );
  }
  // Vercel stocke souvent la clé avec les \n littéraux. On les
  // transforme en vrais retours à la ligne.
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  _sheetsClient = google.sheets({ version: "v4", auth });
  return _sheetsClient;
}

function spreadsheetId(): string {
  // Vercel a probablement GOOGLE_SHEET_ID ou GOOGLE_SHEETS_ID selon
  // comment la variable a été créée. On tolère les deux.
  const id =
    process.env.GOOGLE_SHEET_ID ||
    process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new SheetsError("GOOGLE_SHEET_ID manquant.");
  return id;
}

// ─── Cache mémoire 1 s ────────────────────────────────────────────
//
// Pourquoi si court ? On est sur Vercel (serverless). Chaque
// invocation peut tomber sur un process différent. Le cache mémoire
// process-local n'est utile que pour dédupliquer les appels parallèles
// à `getCommissions()`, `getCommandes()`, etc dans un même render
// SSR (plusieurs `await Promise.all(...)`). 1 s est largement assez
// pour ça et garantit qu'après une écriture, la prochaine requête
// (au pire ~1 s plus tard) verra les données fraîches.
interface CacheEntry<T> {
  value: T;
  expires: number;
}
const TTL_MS = 1_000;
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (e.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return e.value as T;
}
function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, expires: Date.now() + TTL_MS });
}
function invalidate(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

// Helper exposé pour les fonctions de write : on flush TOUT après
// chaque écriture pour garantir une vue cohérente immédiatement après.
export function clearSheetsCache(): void {
  cache.clear();
}

// ─── Lecture brute d'un onglet ────────────────────────────────────
async function readTab(tab: string): Promise<Row[]> {
  const cacheKey = `tab:${tab}`;
  const cached = getCached<Row[]>(cacheKey);
  if (cached) return cached;

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values
    .get({
      spreadsheetId: spreadsheetId(),
      range: tab,
    })
    .catch((err: unknown) => {
      throw new SheetsError(`Lecture onglet "${tab}" échouée`, err);
    });

  const values = (res.data.values || []) as string[][];
  if (values.length === 0) {
    setCached(cacheKey, []);
    return [];
  }
  const [header, ...rows] = values;
  const normalizedHeaders = header.map(normalizeKey);

  const parsed: Row[] = rows
    .filter((r) => r.some((c) => (c ?? "").toString().trim() !== ""))
    .map((r) => {
      const obj: Row = {};
      normalizedHeaders.forEach((h, i) => {
        obj[h] = (r[i] ?? "").toString();
      });
      return obj;
    });

  setCached(cacheKey, parsed);
  return parsed;
}

type Row = Record<string, string>;

// ─── Alias de colonnes ───────────────────────────────────────────
// Centralisés ici pour être disponibles à la fois en lecture
// (mapping) et en écriture (recherche de ligne). Si tu changes le
// nom d'une colonne dans le Sheet, ajoute-le ici une seule fois.
const COMMISSION_ID_ALIASES = [
  "commission_id",
  "id_commission",
  "id",
  "id_commissions",
];
const STATUT_ALIASES = ["statut", "status", "etat", "état", "statut_commission"];
const COMMERCIAL_ID_ALIASES = ["commercial_id", "id_commercial", "id"];

// ─── Helpers de mapping tolérants ─────────────────────────────────

/** Retire accents, met en minuscules, remplace espaces/tirets par underscore. */
function normalizeKey(k: string): string {
  return (k || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/** Récupère la valeur d'une cellule en testant plusieurs alias. */
function pick(row: Row, ...aliases: string[]): string {
  for (const a of aliases) {
    const n = normalizeKey(a);
    if (n in row && row[n] !== "") return row[n];
  }
  // Tolère aussi le cas où la valeur est juste en blancs.
  for (const a of aliases) {
    const n = normalizeKey(a);
    if (n in row) return row[n].trim();
  }
  return "";
}

function pickNum(row: Row, ...aliases: string[]): number {
  const raw = pick(row, ...aliases);
  if (!raw) return 0;
  // Sheet renvoie "9,90" ou "9.90" ou "176 €" — on nettoie.
  const cleaned = raw
    .replace(/[€$\s]/g, "")
    .replace(",", ".")
    .replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function pickDate(row: Row, ...aliases: string[]): string {
  const raw = pick(row, ...aliases);
  if (!raw) return "";
  // Sheet : formats possibles "2026-05-20", "20/05/2026", "2026-05-20T10:24:00Z"
  // On normalise vers ISO si possible, sinon on garde tel quel
  // (les helpers d'affichage gèrent les chaînes vides).
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // tentative parse JS
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return raw;
}

function pickRole(row: Row): Role {
  const raw = pick(row, "role", "rôle", "type").toLowerCase().trim();
  if (raw.startsWith("admin")) return "admin";
  if (raw.startsWith("manager") || raw.startsWith("respons")) return "manager";
  return "commercial";
}

function pickStatutCommercial(row: Row): StatutCommercial {
  const raw = pick(row, "statut", "etat", "état").toLowerCase().trim();
  if (raw.startsWith("actif")) return "actif";
  if (raw.startsWith("suspend")) return "suspendu";
  return "inactif";
}

function pickStatutCommande(row: Row): StatutCommande {
  const raw = pick(row, "statut", "etat", "état").toLowerCase().trim();
  if (raw.startsWith("rembours")) return "remboursee";
  if (raw.startsWith("en_attente") || raw.startsWith("en attente") || raw.startsWith("attente")) return "en_attente";
  return "payee";
}

/**
 * Normalise un statut commission tel que stocké dans Google Sheets
 * vers la valeur d'enum interne.
 *
 * Robuste à :
 *   - casse, accents, espaces normaux, underscores, tirets
 *   - espaces Unicode bizarres (insécable U+00A0, fine U+202F, etc)
 *     que Google Sheets insère parfois avant la ponctuation française
 *   - guillemets collés (' " « » ` ’)
 *   - caractères de contrôle / zero-width
 *
 * Symétrique avec `statutToSheetLabel` (l'écriture) :
 *   "À valider" ←→ "a_valider"
 *   "Validée"   ←→ "validee"
 *   "À payer"   ←→ "a_payer"
 *   "Payée"     ←→ "payee"
 *   "Annulée"   ←→ "annulee"
 */
function normalizeStatutCommission(raw: string): StatutCommission {
  // 1. trim
  // 2. retirer guillemets et zero-width
  // 3. lowercase
  // 4. NFD pour décomposer les accents, puis retirer les diacritiques
  // 5. tous les espaces (\s couvre \u00A0, \u202F, tab, etc) + underscores
  //    + tirets → un seul "_"
  // 6. ne garder que [a-z0-9_]
  const cleaned = (raw || "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")        // zero-width
    .replace(/["'`«»‘’“”]/g, "")                   // guillemets
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")               // diacritiques
    .replace(/[\s_\-]+/g, "_")                     // séparateurs → "_"
    .replace(/[^a-z0-9_]/g, "")                    // garde seulement a-z, 0-9, _
    .replace(/^_+|_+$/g, "");                      // trim underscores

  // Dictionnaire explicite couvrant toutes les variantes connues.
  switch (cleaned) {
    case "a_valider":
    case "avalider":
    case "valider":
    case "to_validate":
      return "a_valider";

    case "validee":
    case "valide":
    case "validated":
      return "validee";

    case "a_payer":
    case "apayer":
    case "payer":
    case "to_pay":
      return "a_payer";

    case "payee":
    case "paye":
    case "paid":
    case "payed":
      return "payee";

    case "annulee":
    case "annule":
    case "cancel":
    case "cancelled":
    case "canceled":
      return "annulee";
  }

  // Fallback : préfixes (couvre les variantes imprévues).
  if (cleaned.startsWith("annul")) return "annulee";
  if (cleaned.startsWith("a_payer") || cleaned.startsWith("apay")) return "a_payer";
  if (cleaned.startsWith("a_valider") || cleaned.startsWith("avalid")) return "a_valider";
  if (cleaned.startsWith("pay")) return "payee";
  if (cleaned.startsWith("valid")) return "validee";

  // Inconnu → on log AVEC la version cleaned ET la chaîne brute en
  // hex pour pouvoir repérer un caractère exotique invisible.
  const hex = Array.from(raw || "")
    .map((c) => c.charCodeAt(0).toString(16).padStart(4, "0"))
    .join(" ");
  console.warn(
    `[googleSheets] statut commission inconnu :\n` +
    `  raw      = ${JSON.stringify(raw)}\n` +
    `  hex      = ${hex}\n` +
    `  cleaned  = ${JSON.stringify(cleaned)}\n` +
    `  fallback = "a_valider"`
  );
  return "a_valider";
}

function pickStatutCommission(row: Row): StatutCommission {
  // IMPORTANT : passe par STATUT_ALIASES pour ne pas rater la colonne
  // si elle s'appelle "statut_commission" (alias) au lieu de "statut".
  // (C'était le bug : la lecture cherchait seulement "statut" / "etat"
  // alors que la colonne réelle dans le Sheet est "statut_commission".)
  const raw = pick(row, ...STATUT_ALIASES);
  return normalizeStatutCommission(raw);
}

function pickRoleBeneficiaire(row: Row): RoleBeneficiaire {
  const raw = pick(row, "role_beneficiaire", "rôle_bénéficiaire", "beneficiaire", "bénéficiaire").toLowerCase().trim();
  if (raw.startsWith("manager")) return "manager";
  return "commercial";
}

function pickTypeCommission(row: Row): TypeCommission {
  const raw = pick(row, "type_commission", "type").toLowerCase().trim().replace(/\s+/g, "_");
  if (raw.includes("manager")) return "commission_manager";
  if (raw.includes("recurrent") || raw.includes("récurrent") || raw.includes("mensuel")) return "vente_abonnement_recurrent";
  if (raw.includes("j60") || raw.includes("j_60") || raw.includes("60")) return "vente_abonnement_j60";
  if (raw.includes("abonnement") || raw.includes("j30") || raw.includes("j_30") || raw.includes("30")) return "vente_abonnement_j30";
  return "vente_produit";
}

function nullable(v: string): string | null {
  const trimmed = (v ?? "").trim();
  return trimmed === "" || trimmed.toLowerCase() === "null" ? null : trimmed;
}

// ─── Domain mappers ───────────────────────────────────────────────

function rowToCommercial(row: Row): Commercial {
  const shopify = process.env.NEXT_PUBLIC_SHOPIFY_URL || "https://22h22foret.fr";
  const code = pick(row, "code_affilie", "code", "code_affiliation");
  const lienFromSheet = pick(row, "lien_affilie", "lien", "lien_affiliation");

  return {
    commercial_id: pick(row, "commercial_id", "id", "id_commercial"),
    prenom: pick(row, "prenom", "prénom", "firstname", "first_name"),
    nom: pick(row, "nom", "lastname", "last_name"),
    email: pick(row, "email", "mail", "e_mail").toLowerCase(),
    mot_de_passe_temp: pick(row, "mot_de_passe_temp", "mot_de_passe", "mdp", "password"),
    role: pickRole(row),
    manager_id: nullable(pick(row, "manager_id", "id_manager", "manager")),
    code_affilie: code,
    lien_affilie: lienFromSheet || (code ? `${shopify}/?ref=${code}` : ""),
    statut: pickStatutCommercial(row),
    date_creation: pickDate(row, "date_creation", "date_création", "created_at", "created"),
  };
}

function rowToManager(row: Row): Manager {
  return {
    manager_id: pick(row, "manager_id", "id_manager", "id"),
    prenom: pick(row, "prenom", "prénom"),
    nom: pick(row, "nom"),
    email: pick(row, "email", "mail").toLowerCase(),
    taux_commission: pickNum(row, "taux_commission", "taux", "pourcentage") || 0.20,
  };
}

function rowToProduit(row: Row): Produit {
  const type = pick(row, "type", "type_produit").toLowerCase();
  return {
    produit_id: pick(row, "produit_id", "id"),
    nom: pick(row, "nom", "name", "produit"),
    prix: pickNum(row, "prix", "price", "montant"),
    type: type.includes("abonn") ? "abonnement" : "one_shot",
    commission_vendeur: pickNum(row, "commission_vendeur", "commission"),
    taux_manager: pickNum(row, "taux_manager", "taux") || 0.20,
  };
}

function rowToCommande(row: Row): Commande {
  return {
    commande_id: pick(row, "commande_id", "id_commande", "id", "order_id"),
    shopify_order_id: pick(
      row,
      "shopify_order_id",
      "shopify_id",
      "order_id",
      "id_shopify",
      "shopify_commande_id"
    ),
    shopify_order_name: pick(
      row,
      "shopify_order_name",
      "order_name",
      "nom_commande",
      "numero_commande",
      "name"
    ),
    date: pickDate(row, "date", "date_commande", "created_at"),
    client_email: pick(row, "client_email", "email_client", "client", "customer_email").toLowerCase(),
    produit_id: pick(row, "produit_id", "id_produit"),
    produit_nom: pick(row, "produit_nom", "produit", "nom_produit", "product_name"),
    montant: pickNum(row, "montant", "montant_ttc", "prix", "total", "amount"),
    code_affilie: pick(row, "code_affilie", "code", "ref"),
    commercial_id: pick(row, "commercial_id", "id_commercial"),
    manager_id: nullable(pick(row, "manager_id", "id_manager")),
    statut: pickStatutCommande(row),
  };
}

function rowToCommission(row: Row): Commission {
  return {
    commission_id: pick(row, "commission_id", "id_commission", "id"),
    date_creation: pickDate(row, "date_creation", "date_création", "created_at"),
    date_commission: pickDate(row, "date_commission", "date_due") || pickDate(row, "date_creation", "date_création", "created_at"),
    type_commission: pickTypeCommission(row),
    commande_id: pick(row, "commande_id", "id_commande", "order_id"),
    subscription_id: nullable(pick(row, "subscription_id", "id_abonnement", "abonnement_id")),
    commercial_id: pick(row, "commercial_id", "id_commercial", "beneficiaire_id", "bénéficiaire_id"),
    role_beneficiaire: pickRoleBeneficiaire(row),
    base_commission_vendeur: pickNum(row, "base_commission_vendeur", "base_commission", "base"),
    commission_vendeur: pickNum(row, "commission_vendeur", "commission", "montant"),
    manager_id: nullable(pick(row, "manager_id", "id_manager")),
    statut: pickStatutCommission(row),
  };
}

function rowToAbonnement(row: Row): Abonnement {
  const statut = pick(row, "statut", "état").toLowerCase();
  return {
    subscription_id: pick(row, "subscription_id", "id_abonnement", "id"),
    commande_id: pick(row, "commande_id", "id_commande"),
    client_email: pick(row, "client_email", "email_client", "email").toLowerCase(),
    date_debut: pickDate(row, "date_debut", "date_début", "start_date"),
    date_fin: nullable(pickDate(row, "date_fin", "end_date")),
    statut: statut.startsWith("annul") ? "annule" : statut.startsWith("pause") ? "pause" : "actif",
    commercial_id: pick(row, "commercial_id", "id_commercial"),
    manager_id: nullable(pick(row, "manager_id", "id_manager")),
  };
}

function rowToPaiement(row: Row): Paiement {
  return {
    paiement_id: pick(row, "paiement_id", "id_paiement", "id"),
    date: pickDate(row, "date", "date_paiement"),
    commercial_id: pick(row, "commercial_id", "id_commercial", "beneficiaire_id"),
    montant: pickNum(row, "montant", "amount"),
    methode: pick(row, "methode", "méthode", "method") || "virement",
    reference: pick(row, "reference", "référence", "ref"),
  };
}

// ─── Lectures exposées ────────────────────────────────────────────

export async function sheetsGetCommerciaux(): Promise<Commercial[]> {
  const rows = await readTab("Commerciaux");
  return rows
    .map(rowToCommercial)
    .filter((c) => c.commercial_id && c.email);
}

export async function sheetsGetManagers(): Promise<Manager[]> {
  // Si un onglet "Managers" existe on l'utilise, sinon on dérive
  // depuis Commerciaux (les comptes role=manager).
  try {
    const rows = await readTab("Managers");
    if (rows.length > 0) {
      return rows.map(rowToManager).filter((m) => m.manager_id);
    }
  } catch {
    /* pas grave, on dérive */
  }
  const commerciaux = await sheetsGetCommerciaux();
  return commerciaux
    .filter((c) => c.role === "manager")
    .map((c) => ({
      manager_id: c.commercial_id,
      prenom: c.prenom,
      nom: c.nom,
      email: c.email,
      taux_commission: 0.20,
    }));
}

export async function sheetsGetProduits(): Promise<Produit[]> {
  try {
    const rows = await readTab("Produits");
    return rows.map(rowToProduit).filter((p) => p.produit_id);
  } catch {
    // Onglet absent — fallback sur le mock (le catalogue est figé).
    const { mockProduits } = await import("./mockData");
    return mockProduits;
  }
}

export async function sheetsGetCommandes(): Promise<Commande[]> {
  const rows = await readTab("Commandes");
  return rows.map(rowToCommande).filter((c) => c.commande_id);
}

export async function sheetsGetCommissions(): Promise<Commission[]> {
  const rows = await readTab("Commissions");
  return rows.map(rowToCommission).filter((c) => c.commission_id);
}

export async function sheetsGetAbonnements(): Promise<Abonnement[]> {
  try {
    const rows = await readTab("Abonnements");
    return rows.map(rowToAbonnement).filter((a) => a.subscription_id);
  } catch {
    return [];
  }
}

export async function sheetsGetPaiements(): Promise<Paiement[]> {
  try {
    const rows = await readTab("Paiements");
    return rows.map(rowToPaiement).filter((p) => p.paiement_id);
  } catch {
    return [];
  }
}

// ─── Écritures ────────────────────────────────────────────────────

/**
 * Trouve l'index 1-based de la ligne dans l'onglet `tab` dont une des
 * colonnes identifiées par `idHeaders` vaut `idValue`.
 *
 * Accepte plusieurs alias de colonne (utile si le Sheet utilise
 * `commission_id`, `id_commission`, `id`, etc).
 *
 * Renvoie aussi le header brut + ses noms normalisés, pour permettre
 * à l'appelant de localiser d'autres colonnes (statut, etc).
 */
async function findRowIndex(
  tab: string,
  idHeaders: string | string[],
  idValue: string
): Promise<{
  rowIndex: number;
  header: string[];
  normalizedHeader: string[];
  matchedHeader: string | null;
}> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: tab,
  });
  const values = (res.data.values || []) as string[][];
  if (values.length === 0) {
    return { rowIndex: -1, header: [], normalizedHeader: [], matchedHeader: null };
  }
  const [header, ...rows] = values;
  const normalizedHeader = header.map(normalizeKey);

  const aliases = (Array.isArray(idHeaders) ? idHeaders : [idHeaders])
    .map(normalizeKey);

  // Trouver la première colonne qui matche un alias.
  let idx = -1;
  let matchedHeader: string | null = null;
  for (const a of aliases) {
    const found = normalizedHeader.indexOf(a);
    if (found !== -1) {
      idx = found;
      matchedHeader = a;
      break;
    }
  }
  if (idx === -1) {
    return { rowIndex: -1, header, normalizedHeader, matchedHeader: null };
  }

  const target = idValue.trim();
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][idx] ?? "").trim() === target) {
      // +2 car ligne 1 = header (1-based) + index 0
      return {
        rowIndex: i + 2,
        header,
        normalizedHeader,
        matchedHeader,
      };
    }
  }
  return { rowIndex: -1, header, normalizedHeader, matchedHeader };
}

function columnLetter(index0: number): string {
  // 0 → A, 25 → Z, 26 → AA...
  let n = index0;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// Alias acceptés pour les colonnes critiques de l'onglet Commissions.
// Ajoute ici si tu vois un cas non couvert dans les logs.
export interface CommissionFallback {
  commande_id?: string;
  type_commission?: string;
  commercial_id?: string;
  role_beneficiaire?: string;
}

export async function sheetsUpdateCommissionStatut(
  commission_id: string,
  statut: StatutCommission,
  fallback?: CommissionFallback
): Promise<Commission | null> {
  const sheets = getSheetsClient();

  // On lit tout l'onglet une fois pour pouvoir matcher par id OU par
  // quadruplet fonctionnel, et localiser la colonne statut.
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Commissions",
  });
  const values = (res.data.values || []) as string[][];
  if (values.length < 2) {
    throw new SheetsError(`Onglet "Commissions" vide ou sans données.`);
  }
  const [header, ...rows] = values;
  const normalizedHeader = header.map(normalizeKey);

  // Localiser les colonnes utiles.
  const colOf = (aliases: string[]): number => {
    for (const a of aliases) {
      const i = normalizedHeader.indexOf(normalizeKey(a));
      if (i !== -1) return i;
    }
    return -1;
  };

  const idCol = colOf(COMMISSION_ID_ALIASES);
  const statutCol = colOf(STATUT_ALIASES);
  const commandeCol = colOf(["commande_id", "id_commande", "order_id"]);
  const typeCol = colOf(["type_commission", "type"]);
  const commercialCol = colOf(["commercial_id", "id_commercial", "beneficiaire_id"]);
  const roleCol = colOf(["role_beneficiaire", "rôle_bénéficiaire", "beneficiaire", "bénéficiaire"]);

  if (statutCol === -1) {
    throw new SheetsError(
      `Colonne "statut" introuvable dans "Commissions". ` +
      `Alias testés : ${STATUT_ALIASES.join(", ")}. Header : ${header.join(" | ")}`
    );
  }

  // ─── Recherche de la ligne ──────────────────────────────────────
  // 1. Par commission_id exact (prioritaire)
  // 2. Fallback : quadruplet commande_id + type + commercial + role
  const targetId = (commission_id || "").trim();
  let rowOffset = -1;

  if (idCol !== -1 && targetId) {
    rowOffset = rows.findIndex((r) => (r[idCol] ?? "").trim() === targetId);
  }

  let matchedBy = "commission_id";
  if (rowOffset === -1 && fallback?.commande_id) {
    matchedBy = "fallback(commande_id+type+commercial+role)";
    const fType = normalizeKey(fallback.type_commission || "");
    const fRole = normalizeKey(fallback.role_beneficiaire || "");
    rowOffset = rows.findIndex((r) => {
      const sameCommande =
        commandeCol !== -1 &&
        (r[commandeCol] ?? "").trim() === fallback.commande_id!.trim();
      const sameType =
        typeCol === -1 || normalizeKey(r[typeCol] ?? "") === fType || !fType;
      const sameCommercial =
        commercialCol === -1 ||
        (r[commercialCol] ?? "").trim() === (fallback.commercial_id || "").trim() ||
        !fallback.commercial_id;
      const sameRole =
        roleCol === -1 || normalizeKey(r[roleCol] ?? "").startsWith(fRole) || !fRole;
      return sameCommande && sameType && sameCommercial && sameRole;
    });
  }

  if (rowOffset === -1) {
    throw new SheetsError(
      `Commission introuvable. id="${commission_id}", ` +
      `fallback=${JSON.stringify(fallback || {})}. ` +
      `Ni le commission_id ni le quadruplet (commande_id+type+commercial+role) ` +
      `ne matchent une ligne de l'onglet "Commissions".`
    );
  }

  const rowIndex = rowOffset + 2; // +1 header, +1 pour passer en 1-based
  const range = `Commissions!${columnLetter(statutCol)}${rowIndex}`;
  const value = statutToSheetLabel(statut);

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId(),
      range,
      valueInputOption: "RAW",
      requestBody: { values: [[value]] },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SheetsError(
      `Échec écriture du statut "${value}" en ${range} (matché par ${matchedBy}). ${msg}`,
      err
    );
  }

  clearSheetsCache();

  // Reconstruire la commission mise à jour à partir de la ligne qu'on
  // vient de modifier (pas de relecture → pas de souci de propagation
  // Google). On parse la ligne via rowToCommission après avoir
  // appliqué le nouveau statut.
  const updatedRow = [...rows[rowOffset]];
  updatedRow[statutCol] = value;
  const rowObj: Row = {};
  normalizedHeader.forEach((h, i) => {
    rowObj[h] = (updatedRow[i] ?? "").toString();
  });
  const commission = rowToCommission(rowObj);
  // Garantir le statut demandé même si le parsing rate un cas exotique.
  return { ...commission, statut };
}

function statutToSheetLabel(s: StatutCommission): string {
  // On réécrit avec la convention "À valider" / "Validée" / ... pour
  // rester aligné avec ce que ton Apps Script écrit déjà.
  switch (s) {
    case "a_valider": return "À valider";
    case "validee":   return "Validée";
    case "a_payer":   return "À payer";
    case "payee":     return "Payée";
    case "annulee":   return "Annulée";
  }
}

export async function sheetsCreateCommercial(
  data: Omit<Commercial, "commercial_id" | "lien_affilie" | "date_creation">
): Promise<Commercial> {
  const sheets = getSheetsClient();
  // 1. lire le header pour respecter l'ordre des colonnes existantes
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Commerciaux!1:1",
  });
  const header = ((res.data.values || [[]])[0] || []) as string[];
  if (header.length === 0) {
    throw new SheetsError("Onglet Commerciaux : pas de header");
  }
  const normalized = header.map(normalizeKey);

  // 2. générer l'id (compte les lignes existantes)
  const allRes = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Commerciaux!A:A",
  });
  const nbRows = (allRes.data.values || []).length;
  const commercial_id = `COM${String(Math.max(nbRows, 1)).padStart(3, "0")}`;

  const shopify = process.env.NEXT_PUBLIC_SHOPIFY_URL || "https://22h22foret.fr";
  const lien_affilie = `${shopify}/?ref=${data.code_affilie}`;
  const date_creation = new Date().toISOString().slice(0, 10);

  // 3. construire la ligne en suivant le header
  const fullRecord: Record<string, string> = {
    commercial_id,
    prenom: data.prenom,
    nom: data.nom,
    email: data.email,
    mot_de_passe_temp: data.mot_de_passe_temp,
    role: data.role,
    manager_id: data.manager_id ?? "",
    code_affilie: data.code_affilie,
    lien_affilie,
    statut: data.statut === "actif" ? "Actif" : data.statut === "suspendu" ? "Suspendu" : "Inactif",
    date_creation,
  };
  const row = normalized.map((h) => fullRecord[h] ?? "");

  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: "Commerciaux",
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
  clearSheetsCache();

  return {
    ...data,
    commercial_id,
    lien_affilie,
    date_creation,
  };
}

export async function sheetsUpdateCommercial(
  commercial_id: string,
  patch: Partial<Commercial>
): Promise<Commercial | null> {
  if (!commercial_id || !commercial_id.trim()) {
    throw new SheetsError("commercial_id vide");
  }

  const { rowIndex, header, normalizedHeader, matchedHeader } =
    await findRowIndex("Commerciaux", COMMERCIAL_ID_ALIASES, commercial_id);

  if (matchedHeader === null) {
    throw new SheetsError(
      `Aucune colonne d'identifiant trouvée dans l'onglet "Commerciaux". ` +
      `Alias testés : ${COMMERCIAL_ID_ALIASES.join(", ")}. ` +
      `Header actuel : ${header.join(" | ")}`
    );
  }
  if (rowIndex === -1) {
    throw new SheetsError(
      `Commercial "${commercial_id}" introuvable dans la colonne "${matchedHeader}" ` +
      `de l'onglet "Commerciaux".`
    );
  }

  const sheets = getSheetsClient();
  // Lire la ligne actuelle
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `Commerciaux!A${rowIndex}:${columnLetter(header.length - 1)}${rowIndex}`,
  });
  const currentRow = ((cur.data.values || [[]])[0] || []) as string[];
  const newRow = [...currentRow];

  const setCol = (h: string, v: string | null | undefined) => {
    const idx = normalizedHeader.indexOf(normalizeKey(h));
    if (idx === -1) return;
    newRow[idx] = v ?? "";
  };

  if (patch.prenom !== undefined) setCol("prenom", patch.prenom);
  if (patch.nom !== undefined) setCol("nom", patch.nom);
  if (patch.email !== undefined) setCol("email", patch.email);
  if (patch.mot_de_passe_temp !== undefined) setCol("mot_de_passe_temp", patch.mot_de_passe_temp);
  if (patch.role !== undefined) setCol("role", patch.role);
  if (patch.manager_id !== undefined) setCol("manager_id", patch.manager_id ?? "");
  if (patch.code_affilie !== undefined) {
    setCol("code_affilie", patch.code_affilie);
    const shopify = process.env.NEXT_PUBLIC_SHOPIFY_URL || "https://22h22foret.fr";
    setCol("lien_affilie", `${shopify}/?ref=${patch.code_affilie}`);
  }
  if (patch.statut !== undefined) {
    setCol("statut", patch.statut === "actif" ? "Actif" : patch.statut === "suspendu" ? "Suspendu" : "Inactif");
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `Commerciaux!A${rowIndex}:${columnLetter(header.length - 1)}${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [newRow] },
  });
  clearSheetsCache();

  const all = await sheetsGetCommerciaux();
  return all.find((c) => c.commercial_id === commercial_id) ?? null;
}

// ─────────────────────────────────────────────────────────────────
// Nettoyage des doublons existants dans le Sheet.
//
// Réécrit l'onglet en ne gardant qu'une ligne par clé fonctionnelle.
// Opération destructive → l'appelant DOIT confirmer explicitement.
//
//   - Commandes   : clé = shopify_order_id sinon commande_id
//   - Commissions : clé = commande_id + type_commission +
//                         commercial_id + role_beneficiaire
//
// On garde la PREMIÈRE occurrence de chaque clé (souvent la plus
// ancienne / la ligne d'origine). On préserve l'ordre du Sheet.
// ─────────────────────────────────────────────────────────────────

export interface CleanupReport {
  tab: string;
  total_rows: number;
  unique_rows: number;
  removed_rows: number;
  applied: boolean;
}

async function cleanupTab(
  tab: string,
  keyOf: (row: Row) => string,
  apply: boolean
): Promise<CleanupReport> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: tab,
  });
  const values = (res.data.values || []) as string[][];
  if (values.length < 2) {
    return { tab, total_rows: 0, unique_rows: 0, removed_rows: 0, applied: false };
  }

  const [header, ...rows] = values;
  const normalizedHeader = header.map(normalizeKey);

  const toRowObj = (r: string[]): Row => {
    const obj: Row = {};
    normalizedHeader.forEach((h, i) => {
      obj[h] = (r[i] ?? "").toString();
    });
    return obj;
  };

  const seen = new Set<string>();
  const keptRows: string[][] = [];
  let removed = 0;

  for (const r of rows) {
    // Ignorer les lignes totalement vides
    if (!r.some((c) => (c ?? "").toString().trim() !== "")) {
      continue;
    }
    const key = keyOf(toRowObj(r));
    if (!key) {
      // pas de clé exploitable → on garde par sécurité
      keptRows.push(r);
      continue;
    }
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    keptRows.push(r);
  }

  const report: CleanupReport = {
    tab,
    total_rows: rows.length,
    unique_rows: keptRows.length,
    removed_rows: removed,
    applied: false,
  };

  if (apply && removed > 0) {
    // Réécriture : on efface la plage de données et on réécrit
    // header + lignes uniques.
    await sheets.spreadsheets.values.clear({
      spreadsheetId: spreadsheetId(),
      range: tab,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId(),
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [header, ...keptRows] },
    });
    clearSheetsCache();
    report.applied = true;
  }

  return report;
}

export async function cleanupDuplicates(apply: boolean): Promise<CleanupReport[]> {
  const reports: CleanupReport[] = [];

  // Commandes — clé shopify_order_id sinon commande_id
  reports.push(
    await cleanupTab(
      "Commandes",
      (row) => {
        const shopify = pick(
          row,
          "shopify_order_id",
          "shopify_id",
          "order_id",
          "id_shopify",
          "shopify_commande_id"
        ).trim();
        if (shopify) return `shopify:${shopify}`;
        const cid = pick(row, "commande_id", "id_commande", "id").trim();
        return cid ? `cmd:${cid}` : "";
      },
      apply
    )
  );

  // Commissions — clé commande_id + type + commercial + role
  reports.push(
    await cleanupTab(
      "Commissions",
      (row) => {
        const cid = pick(row, "commande_id", "id_commande", "order_id").trim();
        const type = normalizeKey(pick(row, "type_commission", "type"));
        const comm = pick(row, "commercial_id", "id_commercial", "beneficiaire_id").trim();
        const role = normalizeKey(
          pick(row, "role_beneficiaire", "rôle_bénéficiaire", "beneficiaire", "bénéficiaire")
        );
        if (cid) return `cmd:${cid}::${type}::${comm}::${role}`;
        const commId = pick(row, "commission_id", "id_commission", "id").trim();
        return commId ? `id:${commId}` : "";
      },
      apply
    )
  );

  return reports;
}
