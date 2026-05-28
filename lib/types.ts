// ─────────────────────────────────────────────────────────────────
// Types métier — calqués sur les onglets Google Sheets existants.
// Garde ces noms en français (snake_case) pour rester aligné avec
// les colonnes du Sheet et les payloads Apps Script.
// ─────────────────────────────────────────────────────────────────

export type Role = "admin" | "manager" | "commercial";

export type StatutCommercial = "actif" | "inactif" | "suspendu";

export interface Commercial {
  commercial_id: string;
  prenom: string;
  nom: string;
  email: string;
  mot_de_passe_temp: string;  // colonne mot_de_passe_temp du Sheet
  role: Role;
  manager_id: string | null;  // null pour admin
  code_affilie: string;
  lien_affilie: string;
  statut: StatutCommercial;
  date_creation: string;      // ISO date
}

export interface Manager {
  manager_id: string;
  prenom: string;
  nom: string;
  email: string;
  taux_commission: number;    // ex. 0.20 = 20 %
}

export interface Produit {
  produit_id: string;
  nom: string;
  prix: number;
  type: "one_shot" | "abonnement";
  commission_vendeur: number;     // montant fixe versé au vendeur
  taux_manager: number;           // % du commission_vendeur reversé au manager
}

export type StatutCommande = "payee" | "remboursee" | "en_attente";

export interface Commande {
  commande_id: string;
  shopify_order_id: string;     // id Shopify — clé d'idempotence prioritaire
  shopify_order_name: string;   // ex "#1042" — lisible humain
  date: string;                 // ISO
  client_email: string;
  produit_id: string;
  produit_nom: string;
  montant: number;
  code_affilie: string;
  commercial_id: string;
  manager_id: string | null;
  statut: StatutCommande;
}

export type TypeCommission =
  | "vente_produit"
  | "vente_abonnement_j30"
  | "vente_abonnement_j60"      // pas encore automatisé — prévu
  | "vente_abonnement_recurrent"// pas encore automatisé — prévu
  | "commission_manager";

export type StatutCommission =
  | "a_valider"
  | "validee"
  | "a_payer"
  | "payee"
  | "annulee";

export type RoleBeneficiaire = "commercial" | "manager";

export interface Commission {
  commission_id: string;
  date_creation: string;        // ISO — quand la ligne a été créée
  date_commission: string;      // ISO — quand elle devient due (J+30 etc.)
  type_commission: TypeCommission;
  commande_id: string;
  subscription_id: string | null;
  commercial_id: string;        // bénéficiaire principal (vendeur ou manager)
  role_beneficiaire: RoleBeneficiaire;
  base_commission_vendeur: number; // montant vendeur qui sert de base au calcul manager
  commission_vendeur: number;      // montant versé au bénéficiaire de cette ligne
  manager_id: string | null;
  statut: StatutCommission;
}

export interface Abonnement {
  subscription_id: string;
  commande_id: string;
  client_email: string;
  date_debut: string;
  date_fin: string | null;
  statut: "actif" | "annule" | "pause";
  commercial_id: string;
  manager_id: string | null;
}

export interface Paiement {
  paiement_id: string;
  date: string;
  commercial_id: string;
  montant: number;
  methode: string;
  reference: string;
}

export interface ClicAffiliation {
  clic_id: string;
  date: string;
  code_affilie: string;
  ip: string;
  user_agent: string;
  converti: boolean;
}

// ─── Utilisateur connecté (forme exposée à l'UI) ──────────────────
export interface SessionUser {
  commercial_id: string;
  prenom: string;
  nom: string;
  email: string;
  role: Role;
  manager_id: string | null;
  code_affilie: string;
  lien_affilie: string;
}

// ─── Agrégats dashboard ───────────────────────────────────────────
export interface StatsCommercial {
  nb_ventes: number;
  commissions_a_valider: number;
  commissions_validees: number;
  commissions_a_payer: number;
  commissions_payees: number;
  total_genere: number;
}

export interface StatsEquipe {
  nb_commerciaux: number;
  nb_ventes_equipe: number;
  ca_equipe: number;
  commission_manager_totale: number;
  commission_manager_payee: number;
}

export interface StatsAdmin {
  nb_commerciaux: number;
  nb_managers: number;
  nb_commandes: number;
  ca_total: number;
  commissions_a_valider: number;
  commissions_a_payer: number;
  commissions_payees: number;
}
