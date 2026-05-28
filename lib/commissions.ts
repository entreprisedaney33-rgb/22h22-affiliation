// ─────────────────────────────────────────────────────────────────
// Règles de commission 22h22 — source unique de vérité.
//
// Ce fichier ne calcule rien à la place de Apps Script.
// Apps Script reste le moteur en prod : il écrit les commissions
// dans Google Sheets. Ici on garde les MÊMES règles pour :
//   1. Afficher la grille dans la page Paramètres
//   2. Générer des données mock cohérentes
//   3. Pouvoir simuler / recalculer côté admin si besoin
//
// Si tu changes une règle ici, change-la AUSSI dans Apps Script.
// ─────────────────────────────────────────────────────────────────

export const REGLES_COMMISSION = {
  produit_176: {
    prix: 176,
    commission_vendeur: 50,
    taux_manager: 0.20,           // 20 % de 50 € = 10 €
    delai_jours: 0,               // versé immédiatement (à validation)
  },
  abonnement_990: {
    prix: 9.90,
    paliers: [
      {
        label: "Démarrage (J+30)",
        commission_vendeur: 10,
        taux_manager: 0.20,       // 2 €
        delai_jours: 30,
        actif: true,
      },
      {
        label: "Confirmation (J+60)",
        commission_vendeur: 5,
        taux_manager: 0.20,       // 1 €
        delai_jours: 60,
        actif: false,             // pas encore automatisé
      },
      {
        label: "Récurrent mensuel",
        commission_vendeur: 1,
        taux_manager: 0.20,       // 0,20 €
        delai_jours: null,        // tous les mois tant que actif
        actif: false,             // pas encore automatisé
      },
    ],
  },
} as const;

export function commissionManager(baseVendeur: number, taux = 0.20): number {
  return Math.round(baseVendeur * taux * 100) / 100;
}

// Helper pour formatter les montants en euros (FR)
export function formatEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Libellés français pour les enums (centralisés pour cohérence UI)
export const LABELS_STATUT_COMMISSION = {
  a_valider: "À valider",
  validee: "Validée",
  a_payer: "À payer",
  payee: "Payée",
  annulee: "Annulée",
} as const;

export const LABELS_TYPE_COMMISSION = {
  vente_produit: "Vente produit",
  vente_abonnement_j30: "Abonnement J+30",
  vente_abonnement_j60: "Abonnement J+60",
  vente_abonnement_recurrent: "Abonnement récurrent",
  commission_manager: "Commission manager",
} as const;

export const LABELS_ROLE = {
  admin: "Administrateur",
  manager: "Manager",
  commercial: "Commercial",
} as const;
