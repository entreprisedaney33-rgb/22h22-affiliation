// ─────────────────────────────────────────────────────────────────
// Sélecteurs / agrégats utilisés par les dashboards.
// Pas d'I/O ici : ces fonctions prennent des données en entrée et
// renvoient des stats. Faciles à tester, faciles à recomposer.
// ─────────────────────────────────────────────────────────────────

import type {
  Commercial,
  Commande,
  Commission,
  StatsCommercial,
  StatsEquipe,
  StatsAdmin,
} from "./types";

/**
 * Résout les identifiants potentiels qu'un compte manager peut avoir
 * dans la colonne `manager_id` des autres onglets.
 *
 * Convention idéale : `manager_id` du Sheet == `commercial_id` du
 * compte manager. En cas de décalage on tolère aussi son email.
 */
export function managerIdentifiers(account: Commercial): string[] {
  const ids = new Set<string>();
  if (account.commercial_id) ids.add(account.commercial_id);
  if (account.email) ids.add(account.email.toLowerCase());
  return Array.from(ids);
}

/**
 * Idem mais pour identifier les lignes (commandes, commissions) qui
 * appartiennent à un commercial donné. Tolère :
 *   - commercial_id          → cas nominal
 *   - code_affilie           → ex. "anthony.lac"
 *   - email                  → "mr.anthony.lac@gmail.com"
 */
export function commercialIdentifiers(account: Commercial): string[] {
  const ids = new Set<string>();
  if (account.commercial_id) ids.add(account.commercial_id.toLowerCase());
  if (account.code_affilie) ids.add(account.code_affilie.toLowerCase());
  if (account.email) ids.add(account.email.toLowerCase());
  return Array.from(ids);
}

/**
 * Vrai si la ligne (commande ou commission) appartient au commercial.
 * Matche sur commercial_id ou code_affilie selon ce qui est disponible.
 */
export function matchesCommercial(
  account: Commercial,
  row: { commercial_id?: string; code_affilie?: string }
): boolean {
  const ids = commercialIdentifiers(account);
  const a = (row.commercial_id || "").toLowerCase();
  const b = (row.code_affilie || "").toLowerCase();
  return (a !== "" && ids.includes(a)) || (b !== "" && ids.includes(b));
}

/** Renvoie les commerciaux de l'équipe d'un manager (tolérant). */
export function equipeOf(
  managerAccount: Commercial,
  commerciaux: Commercial[]
): Commercial[] {
  const ids = managerIdentifiers(managerAccount).map((s) => s.toLowerCase());
  return commerciaux.filter((c) => {
    if (c.role !== "commercial") return false;
    if (!c.manager_id) return false;
    return ids.includes(c.manager_id.toLowerCase());
  });
}

export function statsCommercial(
  account: Commercial,
  commissions: Commission[],
  commandes: Commande[]
): StatsCommercial {
  const mesCommissions = commissions.filter(
    (c) =>
      c.role_beneficiaire === "commercial" && matchesCommercial(account, c)
  );
  const mesVentes = commandes.filter((c) => matchesCommercial(account, c));

  const sum = (statut: Commission["statut"]) =>
    mesCommissions
      .filter((c) => c.statut === statut)
      .reduce((acc, c) => acc + c.commission_vendeur, 0);

  return {
    nb_ventes: mesVentes.length,
    commissions_a_valider: sum("a_valider"),
    commissions_validees: sum("validee"),
    commissions_a_payer: sum("a_payer"),
    commissions_payees: sum("payee"),
    total_genere: mesCommissions
      .filter((c) => c.statut !== "annulee")
      .reduce((acc, c) => acc + c.commission_vendeur, 0),
  };
}

export function statsManager(
  managerAccount: Commercial,
  commerciaux: Commercial[],
  commissions: Commission[],
  commandes: Commande[]
): StatsEquipe {
  const equipe = equipeOf(managerAccount, commerciaux);
  const managerIds = managerIdentifiers(managerAccount).map((s) => s.toLowerCase());

  const ventesEquipe = commandes.filter(
    (c) =>
      c.statut === "payee" &&
      equipe.some((vendeur) => matchesCommercial(vendeur, c))
  );

  const commMgr = commissions.filter(
    (c) =>
      c.role_beneficiaire === "manager" &&
      managerIds.includes((c.commercial_id || "").toLowerCase())
  );

  return {
    nb_commerciaux: equipe.length,
    nb_ventes_equipe: ventesEquipe.length,
    ca_equipe: ventesEquipe.reduce((acc, c) => acc + c.montant, 0),
    commission_manager_totale: commMgr
      .filter((c) => c.statut !== "annulee")
      .reduce((acc, c) => acc + c.commission_vendeur, 0),
    commission_manager_payee: commMgr
      .filter((c) => c.statut === "payee")
      .reduce((acc, c) => acc + c.commission_vendeur, 0),
  };
}

export function statsAdmin(
  commerciaux: Commercial[],
  commandes: Commande[],
  commissions: Commission[]
): StatsAdmin {
  return {
    nb_commerciaux: commerciaux.filter((c) => c.role === "commercial").length,
    nb_managers: commerciaux.filter((c) => c.role === "manager").length,
    nb_commandes: commandes.length,
    ca_total: commandes
      .filter((c) => c.statut === "payee")
      .reduce((acc, c) => acc + c.montant, 0),
    commissions_a_valider: commissions
      .filter((c) => c.statut === "a_valider")
      .reduce((acc, c) => acc + c.commission_vendeur, 0),
    commissions_a_payer: commissions
      .filter((c) => c.statut === "a_payer")
      .reduce((acc, c) => acc + c.commission_vendeur, 0),
    commissions_payees: commissions
      .filter((c) => c.statut === "payee")
      .reduce((acc, c) => acc + c.commission_vendeur, 0),
  };
}

// Classement des commerciaux d'une équipe par CA généré.
export function classementEquipe(
  managerAccount: Commercial,
  commerciaux: Commercial[],
  commandes: Commande[]
) {
  const equipe = equipeOf(managerAccount, commerciaux);
  return equipe
    .map((c) => {
      const ventes = commandes.filter(
        (cmd) => cmd.statut === "payee" && matchesCommercial(c, cmd)
      );
      return {
        commercial: c,
        nb_ventes: ventes.length,
        ca: ventes.reduce((acc, cmd) => acc + cmd.montant, 0),
      };
    })
    .sort((a, b) => b.ca - a.ca);
}
