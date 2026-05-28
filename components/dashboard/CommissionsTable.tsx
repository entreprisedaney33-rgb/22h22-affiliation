"use client";

import { useMemo, useState, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  Commission,
  Commercial,
  StatutCommission,
} from "@/lib/types";
import {
  formatEUR,
  formatDate,
  LABELS_STATUT_COMMISSION,
  LABELS_TYPE_COMMISSION,
} from "@/lib/commissions";
import { Table, Thead, Tr, Th, Td, EmptyState } from "@/components/ui/Table";
import { StatutBadge } from "@/components/ui/Badge";
import { Select, Input } from "@/components/ui/Input";

const STATUTS: StatutCommission[] = [
  "a_valider",
  "validee",
  "a_payer",
  "payee",
  "annulee",
];

export default function CommissionsTable({
  commissions: initialCommissions,
  commerciaux,
  initialStatut,
}: {
  commissions: Commission[];
  commerciaux: Commercial[];
  initialStatut?: StatutCommission | "";
}) {
  const router = useRouter();

  // On garde les commissions en state local pour pouvoir les patcher
  // immédiatement après une mise à jour, sans dépendre d'une relecture
  // Sheets (qui peut renvoyer l'ancienne valeur pendant 1-2 secondes
  // à cause de la latence de propagation côté Google).
  const [commissions, setCommissions] = useState<Commission[]>(initialCommissions);

  // Track des patches optimistes : map<commission_id, { statut, until }>.
  // Quand le serveur renvoie de nouvelles données via router.refresh(),
  // on REFUSE d'écraser un patch optimiste tant que `until` n'est pas
  // dépassé, sauf si le serveur confirme la même valeur que le patch.
  // C'est ce qui empêche le "retour en arrière" si Google n'a pas
  // encore propagé au moment du refresh.
  const optimisticPatches = useRef<
    Map<string, { statut: StatutCommission; until: number }>
  >(new Map());

  // Si le serveur renvoie une nouvelle référence d'objet (donc Next
  // a re-fetché la page), on merge avec les patches optimistes encore
  // actifs au lieu d'écraser brutalement.
  const lastInitialRef = useRef(initialCommissions);
  if (lastInitialRef.current !== initialCommissions) {
    lastInitialRef.current = initialCommissions;
    const now = Date.now();
    const merged = initialCommissions.map((serverRow) => {
      const patch = optimisticPatches.current.get(serverRow.commission_id);
      if (!patch) return serverRow;
      // Si le patch est expiré (Google a eu largement le temps de
      // propager), on oublie le patch et on prend la valeur serveur.
      if (now > patch.until) {
        optimisticPatches.current.delete(serverRow.commission_id);
        return serverRow;
      }
      // Si le serveur confirme déjà la valeur du patch, on peut
      // aussi nettoyer.
      if (serverRow.statut === patch.statut) {
        optimisticPatches.current.delete(serverRow.commission_id);
        return serverRow;
      }
      // Sinon : le serveur n'est pas encore aligné, on garde le patch.
      return { ...serverRow, statut: patch.statut };
    });
    setCommissions(merged);
  }

  const [filtreStatut, setFiltreStatut] = useState<StatutCommission | "">(
    initialStatut ?? ""
  );
  const [filtreCommercial, setFiltreCommercial] = useState<string>("");
  const [filtreManager, setFiltreManager] = useState<string>("");
  const [filtreDebut, setFiltreDebut] = useState<string>("");
  const [filtreFin, setFiltreFin] = useState<string>("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);

  const commerciauxById = useMemo(
    () => new Map(commerciaux.map((c) => [c.commercial_id, c])),
    [commerciaux]
  );

  const managers = commerciaux.filter((c) => c.role === "manager");
  const vendeurs = commerciaux.filter((c) => c.role === "commercial");

  const filtered = useMemo(() => {
    return commissions
      .filter((c) => !filtreStatut || c.statut === filtreStatut)
      // Filtre "commercial" = on garde les lignes liées à ce vendeur,
      // qu'elles soient à son nom (rôle commercial) ou à son manager
      // (rôle manager) — la commission manager découle de SA vente.
      .filter((c) => {
        if (!filtreCommercial) return true;
        if (c.role_beneficiaire === "commercial") {
          return c.commercial_id === filtreCommercial;
        }
        // ligne manager : retrouver le vendeur via la commande
        const vendeurDeLaCommande = commissions.find(
          (cc) =>
            cc.commande_id === c.commande_id &&
            cc.role_beneficiaire === "commercial"
        );
        return vendeurDeLaCommande?.commercial_id === filtreCommercial;
      })
      .filter((c) => !filtreManager || c.manager_id === filtreManager)
      .filter((c) => !filtreDebut || c.date_creation >= filtreDebut)
      .filter((c) => !filtreFin || c.date_creation <= filtreFin)
      .sort((a, b) => b.date_creation.localeCompare(a.date_creation));
  }, [
    commissions,
    filtreStatut,
    filtreCommercial,
    filtreManager,
    filtreDebut,
    filtreFin,
  ]);

  const total = filtered.reduce((acc, c) => acc + c.commission_vendeur, 0);

  async function changeStatut(commission: Commission, statut: StatutCommission) {
    const id = commission.commission_id;
    setPendingId(id);
    setFeedback(null);
    try {
      // On envoie l'id ET le quadruplet de fallback, pour que le
      // serveur retrouve la ligne même si commission_id est imparfait.
      // Si l'id est vide (cas extrême), on route sur un placeholder
      // pour que l'URL reste valide — le serveur matchera par fallback.
      const urlId = encodeURIComponent(id || "_");
      const res = await fetch(`/api/commissions/${urlId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        body: JSON.stringify({
          statut,
          // critères de fallback
          commande_id: commission.commande_id,
          type_commission: commission.type_commission,
          commercial_id: commission.commercial_id,
          role_beneficiaire: commission.role_beneficiaire,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        const msg =
          data?.message ||
          `Échec de la mise à jour (HTTP ${res.status}).`;
        console.error("[changeStatut] échec", { id, statut, response: data });
        setFeedback({ tone: "error", message: msg });
        return;
      }

      // ─── Récupération de la commission mise à jour ──────────────
      // L'API renvoie { ok: true, commission: { ... } }. C'est cette
      // commission qu'on utilise pour patcher le state local — elle
      // contient toutes les colonnes, y compris commande_id,
      // type_commission, role_beneficiaire qui servent de clé de
      // matching tolérante.
      const payload = await res.json().catch(() => ({} as any));
      const updated = payload?.commission as Commission | undefined;

      // ─── Mise à jour LOCALE du state (optimistic, tolérante) ─────
      // Matching à 2 niveaux :
      //   1. commission_id strict — couvre 99 % des cas
      //   2. fallback sur le triplet (commande_id, type_commission,
      //      role_beneficiaire) qui identifie *fonctionnellement* une
      //      ligne unique de commission, même si l'ID a un format qui
      //      ne match pas exactement (espaces, casse, leading zeros…).
      //
      // Sans ce fallback, l'optimistic update pouvait passer à côté
      // de la bonne ligne et l'UI ne reflétait pas le changement
      // alors que le Sheet était bien à jour.
      if (updated) {
        // Enregistre le patch pour qu'il survive à un éventuel
        // router.refresh() qui partirait avec des données serveur
        // pas encore propagées. Validité : 10 secondes (large marge
        // par rapport au router.refresh() programmé à 3 s ; après
        // ça on fait confiance au serveur).
        optimisticPatches.current.set(updated.commission_id, {
          statut,
          until: Date.now() + 10_000,
        });
        setCommissions((prev) =>
          prev.map((c) =>
            c.commission_id === updated.commission_id ||
            (
              c.commande_id === updated.commande_id &&
              c.type_commission === updated.type_commission &&
              c.role_beneficiaire === updated.role_beneficiaire
            )
              ? updated
              : c
          )
        );
      } else {
        // Fallback ultra-conservateur si l'API n'a pas renvoyé la
        // commission (ne devrait pas arriver, mais au cas où).
        optimisticPatches.current.set(id, {
          statut,
          until: Date.now() + 10_000,
        });
        setCommissions((prev) =>
          prev.map((c) =>
            c.commission_id === id ? { ...c, statut } : c
          )
        );
      }

      setFeedback({
        tone: "success",
        message: `Statut mis à jour : ${LABELS_STATUT_COMMISSION[statut]}.`,
      });

      // ─── Rattrapage doux côté serveur ─────────────────────────────
      // router.refresh() à 3000 ms : laisse largement le temps à
      // Google Sheets de propager l'écriture avant que les pages
      // serveur ne soient re-rendues. Comme ça, quand l'utilisateur
      // navigue vers /admin (ou refresh manuellement), il voit la
      // bonne valeur.
      //
      // PAS de window.location.reload() : il provoquait le bug
      // "retour à l'ancienne valeur" parce qu'il déclenchait une
      // lecture Sheets pile dans la fenêtre de propagation.
      setTimeout(() => {
        router.refresh();
      }, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur réseau.";
      console.error("[changeStatut] exception", e);
      setFeedback({ tone: "error", message: msg });
    } finally {
      setPendingId(null);
    }
  }

  function resetFilters() {
    setFiltreStatut("");
    setFiltreCommercial("");
    setFiltreManager("");
    setFiltreDebut("");
    setFiltreFin("");
  }

  return (
    <div className="space-y-6">
      {/* Toast feedback (success / error) */}
      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-rose-500/30 bg-rose-500/10 text-rose-100"
          }`}
        >
          <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-current" />
          <p className="flex-1 leading-relaxed">{feedback.message}</p>
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setFeedback(null)}
            className="text-current opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="rounded-2xl border border-gold-400/10 bg-forest-800/40 p-5 backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-300">
            Filtres
          </p>
          <button
            onClick={resetFilters}
            className="text-xs text-gold-400 hover:text-gold-500"
          >
            Réinitialiser
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            label="Statut"
            value={filtreStatut}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFiltreStatut(e.target.value as StatutCommission | "")}
          >
            <option value="">Tous</option>
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {LABELS_STATUT_COMMISSION[s]}
              </option>
            ))}
          </Select>
          <Select
            label="Commercial"
            value={filtreCommercial}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFiltreCommercial(e.target.value)}
          >
            <option value="">Tous</option>
            {vendeurs.map((v) => (
              <option key={v.commercial_id} value={v.commercial_id}>
                {v.prenom} {v.nom}
              </option>
            ))}
          </Select>
          <Select
            label="Manager"
            value={filtreManager}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFiltreManager(e.target.value)}
          >
            <option value="">Tous</option>
            {managers.map((m) => (
              <option key={m.commercial_id} value={m.commercial_id}>
                {m.prenom} {m.nom}
              </option>
            ))}
          </Select>
          <Input
            label="Du"
            type="date"
            value={filtreDebut}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFiltreDebut(e.target.value)}
          />
          <Input
            label="Au"
            type="date"
            value={filtreFin}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFiltreFin(e.target.value)}
          />
        </div>
      </div>

      {/* Résumé */}
      <div className="flex flex-col gap-1 rounded-2xl border border-gold-400/10 bg-forest-800/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-300">
          <span className="text-ink-100">{filtered.length}</span> ligne
          {filtered.length > 1 ? "s" : ""}
        </p>
        <p className="text-sm text-ink-300">
          Total filtré :{" "}
          <span className="font-display text-base text-gold-400">
            {formatEUR(total)}
          </span>
        </p>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-2xl border border-gold-400/10 bg-forest-800/40 backdrop-blur-md">
        {filtered.length === 0 ? (
          <EmptyState message="Aucune commission ne correspond à ces filtres." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Créée</Th>
                <Th>Commission due</Th>
                <Th>Type</Th>
                <Th>Commande</Th>
                <Th>Abonnement</Th>
                <Th>Bénéficiaire</Th>
                <Th>Rôle</Th>
                <Th>Base</Th>
                <Th>Montant</Th>
                <Th>Manager</Th>
                <Th>Statut</Th>
              </Tr>
            </Thead>
            <tbody>
              {filtered.map((c) => {
                const benef = commerciauxById.get(c.commercial_id);
                const mgr = c.manager_id ? commerciauxById.get(c.manager_id) : null;
                const isPending = pendingId === c.commission_id;
                return (
                  <Tr key={c.commission_id}>
                    <Td className="text-xs text-ink-300">
                      {formatDate(c.date_creation)}
                    </Td>
                    <Td className="text-xs text-ink-300">
                      {formatDate(c.date_commission)}
                    </Td>
                    <Td className="text-xs">
                      {LABELS_TYPE_COMMISSION[c.type_commission]}
                    </Td>
                    <Td className="font-mono text-xs text-ink-300">
                      {c.commande_id}
                    </Td>
                    <Td className="font-mono text-xs text-ink-300">
                      {c.subscription_id ?? "—"}
                    </Td>
                    <Td>
                      {benef ? `${benef.prenom} ${benef.nom}` : c.commercial_id}
                    </Td>
                    <Td>
                      <span className="text-[10px] uppercase tracking-wider text-ink-300/70">
                        {c.role_beneficiaire}
                      </span>
                    </Td>
                    <Td className="text-xs text-ink-300">
                      {formatEUR(c.base_commission_vendeur)}
                    </Td>
                    <Td className="font-medium text-gold-400">
                      {formatEUR(c.commission_vendeur)}
                    </Td>
                    <Td className="text-xs text-ink-300">
                      {mgr ? `${mgr.prenom} ${mgr.nom}` : "—"}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <StatutBadge statut={c.statut} />
                        <select
                          aria-label="Changer le statut"
                          value={c.statut}
                          disabled={isPending}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            changeStatut(
                              c,
                              e.target.value as StatutCommission
                            )
                          }
                          className="rounded-md border border-gold-400/15 bg-forest-900/60 px-2 py-1 text-xs text-ink-100 focus:border-gold-400/40 focus:outline-none disabled:opacity-50"
                        >
                          {STATUTS.map((s) => (
                            <option key={s} value={s}>
                              {LABELS_STATUT_COMMISSION[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
