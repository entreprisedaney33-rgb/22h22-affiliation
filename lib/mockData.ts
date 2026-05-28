import type {
  Commercial,
  Manager,
  Produit,
  Commande,
  Commission,
  Abonnement,
  Paiement,
  ClicAffiliation,
} from "./types";

const SHOPIFY = process.env.NEXT_PUBLIC_SHOPIFY_URL || "https://22h22foret.fr";
const lien = (code: string) => `${SHOPIFY}/?ref=${code}`;

// ─── Managers ────────────────────────────────────────────────────
export const mockManagers: Manager[] = [
  {
    manager_id: "MGR001",
    prenom: "Camille",
    nom: "Lefèvre",
    email: "camille@22h22foret.fr",
    taux_commission: 0.20,
  },
  {
    manager_id: "MGR002",
    prenom: "Julien",
    nom: "Morel",
    email: "julien@22h22foret.fr",
    taux_commission: 0.20,
  },
];

// ─── Comptes (commerciaux + managers + admin dans la même table) ──
// Le rôle distingue. C'est ce que ton Sheet "Commerciaux" fait déjà.
export const mockCommerciaux: Commercial[] = [
  // Admin
  {
    commercial_id: "ADM001",
    prenom: "Admin",
    nom: "22h22",
    email: "admin@22h22foret.fr",
    mot_de_passe_temp: "admin",
    role: "admin",
    manager_id: null,
    code_affilie: "admin22",
    lien_affilie: lien("admin22"),
    statut: "actif",
    date_creation: "2025-01-15",
  },
  // Manager 1 (en tant que compte commercial pour le login)
  {
    commercial_id: "MGR001",
    prenom: "Camille",
    nom: "Lefèvre",
    email: "camille@22h22foret.fr",
    mot_de_passe_temp: "camille",
    role: "manager",
    manager_id: null,
    code_affilie: "camille22",
    lien_affilie: lien("camille22"),
    statut: "actif",
    date_creation: "2025-01-20",
  },
  // Manager 2
  {
    commercial_id: "MGR002",
    prenom: "Julien",
    nom: "Morel",
    email: "julien@22h22foret.fr",
    mot_de_passe_temp: "julien",
    role: "manager",
    manager_id: null,
    code_affilie: "julien22",
    lien_affilie: lien("julien22"),
    statut: "actif",
    date_creation: "2025-02-01",
  },
  // Commerciaux équipe Camille
  {
    commercial_id: "COM001",
    prenom: "Paul",
    nom: "Dubois",
    email: "paul@22h22foret.fr",
    mot_de_passe_temp: "paul",
    role: "commercial",
    manager_id: "MGR001",
    code_affilie: "paul22",
    lien_affilie: lien("paul22"),
    statut: "actif",
    date_creation: "2025-02-10",
  },
  {
    commercial_id: "COM002",
    prenom: "Sophie",
    nom: "Marchand",
    email: "sophie@22h22foret.fr",
    mot_de_passe_temp: "sophie",
    role: "commercial",
    manager_id: "MGR001",
    code_affilie: "sophie22",
    lien_affilie: lien("sophie22"),
    statut: "actif",
    date_creation: "2025-02-18",
  },
  {
    commercial_id: "COM003",
    prenom: "Léa",
    nom: "Bernard",
    email: "lea@22h22foret.fr",
    mot_de_passe_temp: "lea",
    role: "commercial",
    manager_id: "MGR001",
    code_affilie: "lea22",
    lien_affilie: lien("lea22"),
    statut: "actif",
    date_creation: "2025-03-05",
  },
  // Commerciaux équipe Julien
  {
    commercial_id: "COM004",
    prenom: "Thomas",
    nom: "Roux",
    email: "thomas@22h22foret.fr",
    mot_de_passe_temp: "thomas",
    role: "commercial",
    manager_id: "MGR002",
    code_affilie: "thomas22",
    lien_affilie: lien("thomas22"),
    statut: "actif",
    date_creation: "2025-02-22",
  },
  {
    commercial_id: "COM005",
    prenom: "Inès",
    nom: "Petit",
    email: "ines@22h22foret.fr",
    mot_de_passe_temp: "ines",
    role: "commercial",
    manager_id: "MGR002",
    code_affilie: "ines22",
    lien_affilie: lien("ines22"),
    statut: "inactif",
    date_creation: "2025-03-12",
  },
];

// ─── Produits ────────────────────────────────────────────────────
export const mockProduits: Produit[] = [
  {
    produit_id: "PRD176",
    nom: "Coffret signature 22h22",
    prix: 176,
    type: "one_shot",
    commission_vendeur: 50,
    taux_manager: 0.20,
  },
  {
    produit_id: "ABO990",
    nom: "Abonnement Forêt",
    prix: 9.90,
    type: "abonnement",
    commission_vendeur: 10,
    taux_manager: 0.20,
  },
];

// ─── Commandes ───────────────────────────────────────────────────
// Mix produit / abonnement, dates étalées sur les 2 derniers mois.
export const mockCommandes: Commande[] = [
  { commande_id: "CMD1001", shopify_order_id: "550001001", shopify_order_name: "#1001", date: "2026-05-20T10:24:00Z", client_email: "marie.d@gmail.com",   produit_id: "PRD176", produit_nom: "Coffret signature 22h22", montant: 176,  code_affilie: "paul22",   commercial_id: "COM001", manager_id: "MGR001", statut: "payee" },
  { commande_id: "CMD1002", shopify_order_id: "550001002", shopify_order_name: "#1002", date: "2026-05-19T16:11:00Z", client_email: "antoine.b@yahoo.fr",  produit_id: "ABO990", produit_nom: "Abonnement Forêt",        montant: 9.90, code_affilie: "paul22",   commercial_id: "COM001", manager_id: "MGR001", statut: "payee" },
  { commande_id: "CMD1003", shopify_order_id: "550001003", shopify_order_name: "#1003", date: "2026-05-18T09:02:00Z", client_email: "fanny.l@gmail.com",   produit_id: "PRD176", produit_nom: "Coffret signature 22h22", montant: 176,  code_affilie: "sophie22", commercial_id: "COM002", manager_id: "MGR001", statut: "payee" },
  { commande_id: "CMD1004", shopify_order_id: "550001004", shopify_order_name: "#1004", date: "2026-05-17T14:48:00Z", client_email: "j.morand@outlook.fr", produit_id: "PRD176", produit_nom: "Coffret signature 22h22", montant: 176,  code_affilie: "thomas22", commercial_id: "COM004", manager_id: "MGR002", statut: "payee" },
  { commande_id: "CMD1005", shopify_order_id: "550001005", shopify_order_name: "#1005", date: "2026-05-15T11:30:00Z", client_email: "lou.t@gmail.com",     produit_id: "ABO990", produit_nom: "Abonnement Forêt",        montant: 9.90, code_affilie: "lea22",    commercial_id: "COM003", manager_id: "MGR001", statut: "payee" },
  { commande_id: "CMD1006", shopify_order_id: "550001006", shopify_order_name: "#1006", date: "2026-05-12T08:15:00Z", client_email: "ph.roux@gmail.com",   produit_id: "PRD176", produit_nom: "Coffret signature 22h22", montant: 176,  code_affilie: "paul22",   commercial_id: "COM001", manager_id: "MGR001", statut: "payee" },
  { commande_id: "CMD1007", shopify_order_id: "550001007", shopify_order_name: "#1007", date: "2026-05-10T19:05:00Z", client_email: "elise.k@gmail.com",   produit_id: "PRD176", produit_nom: "Coffret signature 22h22", montant: 176,  code_affilie: "thomas22", commercial_id: "COM004", manager_id: "MGR002", statut: "remboursee" },
  { commande_id: "CMD1008", shopify_order_id: "550001008", shopify_order_name: "#1008", date: "2026-05-08T12:22:00Z", client_email: "noemie.r@gmail.com",  produit_id: "ABO990", produit_nom: "Abonnement Forêt",        montant: 9.90, code_affilie: "sophie22", commercial_id: "COM002", manager_id: "MGR001", statut: "payee" },
  { commande_id: "CMD1009", shopify_order_id: "550001009", shopify_order_name: "#1009", date: "2026-05-05T17:44:00Z", client_email: "victor.m@gmail.com",  produit_id: "PRD176", produit_nom: "Coffret signature 22h22", montant: 176,  code_affilie: "sophie22", commercial_id: "COM002", manager_id: "MGR001", statut: "payee" },
  { commande_id: "CMD1010", shopify_order_id: "550001010", shopify_order_name: "#1010", date: "2026-05-02T13:10:00Z", client_email: "claire.j@gmail.com",  produit_id: "ABO990", produit_nom: "Abonnement Forêt",        montant: 9.90, code_affilie: "lea22",    commercial_id: "COM003", manager_id: "MGR001", statut: "payee" },
  { commande_id: "CMD1011", shopify_order_id: "550001011", shopify_order_name: "#1011", date: "2026-04-28T10:01:00Z", client_email: "yann.f@gmail.com",    produit_id: "PRD176", produit_nom: "Coffret signature 22h22", montant: 176,  code_affilie: "paul22",   commercial_id: "COM001", manager_id: "MGR001", statut: "payee" },
  { commande_id: "CMD1012", shopify_order_id: "550001012", shopify_order_name: "#1012", date: "2026-04-25T15:30:00Z", client_email: "manon.g@gmail.com",   produit_id: "PRD176", produit_nom: "Coffret signature 22h22", montant: 176,  code_affilie: "thomas22", commercial_id: "COM004", manager_id: "MGR002", statut: "payee" },
];

// ─── Commissions ─────────────────────────────────────────────────
// Pour chaque commande "payee" : 1 ligne vendeur + 1 ligne manager.
// Statuts variés pour illustrer le workflow.
export const mockCommissions: Commission[] = [
  // CMD1001 (Paul, 176 €)
  { commission_id: "C001", date_creation: "2026-05-20", date_commission: "2026-05-20", type_commission: "vente_produit", commande_id: "CMD1001", subscription_id: null, commercial_id: "COM001", role_beneficiaire: "commercial", base_commission_vendeur: 50, commission_vendeur: 50, manager_id: "MGR001", statut: "a_valider" },
  { commission_id: "C002", date_creation: "2026-05-20", date_commission: "2026-05-20", type_commission: "commission_manager", commande_id: "CMD1001", subscription_id: null, commercial_id: "MGR001", role_beneficiaire: "manager", base_commission_vendeur: 50, commission_vendeur: 10, manager_id: "MGR001", statut: "a_valider" },

  // CMD1002 (Paul, abo)
  { commission_id: "C003", date_creation: "2026-05-19", date_commission: "2026-06-18", type_commission: "vente_abonnement_j30", commande_id: "CMD1002", subscription_id: "SUB2001", commercial_id: "COM001", role_beneficiaire: "commercial", base_commission_vendeur: 10, commission_vendeur: 10, manager_id: "MGR001", statut: "a_valider" },
  { commission_id: "C004", date_creation: "2026-05-19", date_commission: "2026-06-18", type_commission: "commission_manager", commande_id: "CMD1002", subscription_id: "SUB2001", commercial_id: "MGR001", role_beneficiaire: "manager", base_commission_vendeur: 10, commission_vendeur: 2, manager_id: "MGR001", statut: "a_valider" },

  // CMD1003 (Sophie, 176)
  { commission_id: "C005", date_creation: "2026-05-18", date_commission: "2026-05-18", type_commission: "vente_produit", commande_id: "CMD1003", subscription_id: null, commercial_id: "COM002", role_beneficiaire: "commercial", base_commission_vendeur: 50, commission_vendeur: 50, manager_id: "MGR001", statut: "validee" },
  { commission_id: "C006", date_creation: "2026-05-18", date_commission: "2026-05-18", type_commission: "commission_manager", commande_id: "CMD1003", subscription_id: null, commercial_id: "MGR001", role_beneficiaire: "manager", base_commission_vendeur: 50, commission_vendeur: 10, manager_id: "MGR001", statut: "validee" },

  // CMD1004 (Thomas, 176)
  { commission_id: "C007", date_creation: "2026-05-17", date_commission: "2026-05-17", type_commission: "vente_produit", commande_id: "CMD1004", subscription_id: null, commercial_id: "COM004", role_beneficiaire: "commercial", base_commission_vendeur: 50, commission_vendeur: 50, manager_id: "MGR002", statut: "validee" },
  { commission_id: "C008", date_creation: "2026-05-17", date_commission: "2026-05-17", type_commission: "commission_manager", commande_id: "CMD1004", subscription_id: null, commercial_id: "MGR002", role_beneficiaire: "manager", base_commission_vendeur: 50, commission_vendeur: 10, manager_id: "MGR002", statut: "validee" },

  // CMD1005 (Léa, abo)
  { commission_id: "C009", date_creation: "2026-05-15", date_commission: "2026-06-14", type_commission: "vente_abonnement_j30", commande_id: "CMD1005", subscription_id: "SUB2002", commercial_id: "COM003", role_beneficiaire: "commercial", base_commission_vendeur: 10, commission_vendeur: 10, manager_id: "MGR001", statut: "a_valider" },
  { commission_id: "C010", date_creation: "2026-05-15", date_commission: "2026-06-14", type_commission: "commission_manager", commande_id: "CMD1005", subscription_id: "SUB2002", commercial_id: "MGR001", role_beneficiaire: "manager", base_commission_vendeur: 10, commission_vendeur: 2, manager_id: "MGR001", statut: "a_valider" },

  // CMD1006 (Paul, 176) — déjà payée
  { commission_id: "C011", date_creation: "2026-05-12", date_commission: "2026-05-12", type_commission: "vente_produit", commande_id: "CMD1006", subscription_id: null, commercial_id: "COM001", role_beneficiaire: "commercial", base_commission_vendeur: 50, commission_vendeur: 50, manager_id: "MGR001", statut: "payee" },
  { commission_id: "C012", date_creation: "2026-05-12", date_commission: "2026-05-12", type_commission: "commission_manager", commande_id: "CMD1006", subscription_id: null, commercial_id: "MGR001", role_beneficiaire: "manager", base_commission_vendeur: 50, commission_vendeur: 10, manager_id: "MGR001", statut: "payee" },

  // CMD1007 (Thomas) — annulée (remboursement)
  { commission_id: "C013", date_creation: "2026-05-10", date_commission: "2026-05-10", type_commission: "vente_produit", commande_id: "CMD1007", subscription_id: null, commercial_id: "COM004", role_beneficiaire: "commercial", base_commission_vendeur: 50, commission_vendeur: 50, manager_id: "MGR002", statut: "annulee" },
  { commission_id: "C014", date_creation: "2026-05-10", date_commission: "2026-05-10", type_commission: "commission_manager", commande_id: "CMD1007", subscription_id: null, commercial_id: "MGR002", role_beneficiaire: "manager", base_commission_vendeur: 50, commission_vendeur: 10, manager_id: "MGR002", statut: "annulee" },

  // CMD1008 (Sophie, abo)
  { commission_id: "C015", date_creation: "2026-05-08", date_commission: "2026-06-07", type_commission: "vente_abonnement_j30", commande_id: "CMD1008", subscription_id: "SUB2003", commercial_id: "COM002", role_beneficiaire: "commercial", base_commission_vendeur: 10, commission_vendeur: 10, manager_id: "MGR001", statut: "validee" },
  { commission_id: "C016", date_creation: "2026-05-08", date_commission: "2026-06-07", type_commission: "commission_manager", commande_id: "CMD1008", subscription_id: "SUB2003", commercial_id: "MGR001", role_beneficiaire: "manager", base_commission_vendeur: 10, commission_vendeur: 2, manager_id: "MGR001", statut: "validee" },

  // CMD1009 (Sophie, 176) — à payer
  { commission_id: "C017", date_creation: "2026-05-05", date_commission: "2026-05-05", type_commission: "vente_produit", commande_id: "CMD1009", subscription_id: null, commercial_id: "COM002", role_beneficiaire: "commercial", base_commission_vendeur: 50, commission_vendeur: 50, manager_id: "MGR001", statut: "a_payer" },
  { commission_id: "C018", date_creation: "2026-05-05", date_commission: "2026-05-05", type_commission: "commission_manager", commande_id: "CMD1009", subscription_id: null, commercial_id: "MGR001", role_beneficiaire: "manager", base_commission_vendeur: 50, commission_vendeur: 10, manager_id: "MGR001", statut: "a_payer" },

  // CMD1010 (Léa, abo)
  { commission_id: "C019", date_creation: "2026-05-02", date_commission: "2026-06-01", type_commission: "vente_abonnement_j30", commande_id: "CMD1010", subscription_id: "SUB2004", commercial_id: "COM003", role_beneficiaire: "commercial", base_commission_vendeur: 10, commission_vendeur: 10, manager_id: "MGR001", statut: "validee" },
  { commission_id: "C020", date_creation: "2026-05-02", date_commission: "2026-06-01", type_commission: "commission_manager", commande_id: "CMD1010", subscription_id: "SUB2004", commercial_id: "MGR001", role_beneficiaire: "manager", base_commission_vendeur: 10, commission_vendeur: 2, manager_id: "MGR001", statut: "validee" },

  // CMD1011 (Paul, 176) — payée
  { commission_id: "C021", date_creation: "2026-04-28", date_commission: "2026-04-28", type_commission: "vente_produit", commande_id: "CMD1011", subscription_id: null, commercial_id: "COM001", role_beneficiaire: "commercial", base_commission_vendeur: 50, commission_vendeur: 50, manager_id: "MGR001", statut: "payee" },
  { commission_id: "C022", date_creation: "2026-04-28", date_commission: "2026-04-28", type_commission: "commission_manager", commande_id: "CMD1011", subscription_id: null, commercial_id: "MGR001", role_beneficiaire: "manager", base_commission_vendeur: 50, commission_vendeur: 10, manager_id: "MGR001", statut: "payee" },

  // CMD1012 (Thomas, 176) — payée
  { commission_id: "C023", date_creation: "2026-04-25", date_commission: "2026-04-25", type_commission: "vente_produit", commande_id: "CMD1012", subscription_id: null, commercial_id: "COM004", role_beneficiaire: "commercial", base_commission_vendeur: 50, commission_vendeur: 50, manager_id: "MGR002", statut: "payee" },
  { commission_id: "C024", date_creation: "2026-04-25", date_commission: "2026-04-25", type_commission: "commission_manager", commande_id: "CMD1012", subscription_id: null, commercial_id: "MGR002", role_beneficiaire: "manager", base_commission_vendeur: 50, commission_vendeur: 10, manager_id: "MGR002", statut: "payee" },
];

// ─── Abonnements ─────────────────────────────────────────────────
export const mockAbonnements: Abonnement[] = [
  { subscription_id: "SUB2001", commande_id: "CMD1002", client_email: "antoine.b@yahoo.fr", date_debut: "2026-05-19", date_fin: null, statut: "actif", commercial_id: "COM001", manager_id: "MGR001" },
  { subscription_id: "SUB2002", commande_id: "CMD1005", client_email: "lou.t@gmail.com",     date_debut: "2026-05-15", date_fin: null, statut: "actif", commercial_id: "COM003", manager_id: "MGR001" },
  { subscription_id: "SUB2003", commande_id: "CMD1008", client_email: "noemie.r@gmail.com",  date_debut: "2026-05-08", date_fin: null, statut: "actif", commercial_id: "COM002", manager_id: "MGR001" },
  { subscription_id: "SUB2004", commande_id: "CMD1010", client_email: "claire.j@gmail.com",  date_debut: "2026-05-02", date_fin: null, statut: "actif", commercial_id: "COM003", manager_id: "MGR001" },
];

// ─── Paiements ───────────────────────────────────────────────────
export const mockPaiements: Paiement[] = [
  { paiement_id: "PAY001", date: "2026-05-01", commercial_id: "COM001", montant: 50,  methode: "virement", reference: "VIR-2026-05-01-001" },
  { paiement_id: "PAY002", date: "2026-05-01", commercial_id: "MGR001", montant: 10,  methode: "virement", reference: "VIR-2026-05-01-002" },
  { paiement_id: "PAY003", date: "2026-05-01", commercial_id: "COM004", montant: 50,  methode: "virement", reference: "VIR-2026-05-01-003" },
  { paiement_id: "PAY004", date: "2026-05-01", commercial_id: "MGR002", montant: 10,  methode: "virement", reference: "VIR-2026-05-01-004" },
];

// ─── Clics affiliation ───────────────────────────────────────────
export const mockClics: ClicAffiliation[] = [
  { clic_id: "CLK001", date: "2026-05-20T10:20:00Z", code_affilie: "paul22",   ip: "82.13.x.x", user_agent: "Mozilla/5.0", converti: true },
  { clic_id: "CLK002", date: "2026-05-20T11:02:00Z", code_affilie: "paul22",   ip: "82.13.x.x", user_agent: "Mozilla/5.0", converti: false },
  { clic_id: "CLK003", date: "2026-05-19T08:40:00Z", code_affilie: "sophie22", ip: "78.12.x.x", user_agent: "Safari/iOS",  converti: false },
];
