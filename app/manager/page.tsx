// Empêche Next.js de mettre la page en cache statique :
// chaque visite refait une lecture fraîche de Google Sheets.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getCommerciaux,
  getCommissions,
  getCommandes,
  getCommercialById,
} from "@/lib/dataSource";
import { statsManager, classementEquipe, equipeOf, matchesCommercial } from "@/lib/selectors";
import { formatEUR, formatDate } from "@/lib/commissions";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, Thead, Tr, Th, Td, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LayoutDashboard, Users, ShoppingBag, Wallet, Crown } from "lucide-react";

const NAV = [
  { href: "/manager", label: "Équipe", icon: <LayoutDashboard size={14} /> },
];

export default async function ManagerDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "manager") {
    redirect(session.role === "admin" ? "/admin" : "/commercial");
  }

  const [commerciaux, commissions, commandes, managerAccount] = await Promise.all([
    getCommerciaux(),
    getCommissions(),
    getCommandes(),
    getCommercialById(session.commercial_id),
  ]);

  if (!managerAccount) redirect("/login");

  const stats = statsManager(managerAccount, commerciaux, commissions, commandes);
  const classement = classementEquipe(managerAccount, commerciaux, commandes);
  const equipe = equipeOf(managerAccount, commerciaux);

  const idsEquipe = new Set(equipe.map((c) => c.commercial_id));
  const ventesEquipe = commandes
    .filter((c) =>
      equipe.some((vendeur) => matchesCommercial(vendeur, c))
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const commerciauxById = new Map(commerciaux.map((c) => [c.commercial_id, c]));

  return (
    <AppShell user={session} nav={NAV} current="/manager">
      <PageHeader
        eyebrow={`Manager — ${session.prenom}`}
        title="Pilotage d'équipe"
        description="Vue d'ensemble des performances de vos commerciaux."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Commerciaux"
          value={String(stats.nb_commerciaux)}
          hint="dans votre équipe"
          icon={<Users size={18} />}
          delay={0}
          accent
        />
        <StatCard
          label="Ventes équipe"
          value={String(stats.nb_ventes_equipe)}
          hint="commandes payées"
          icon={<ShoppingBag size={18} />}
          delay={60}
        />
        <StatCard
          label="CA équipe"
          value={formatEUR(stats.ca_equipe)}
          hint="encaissé sur Shopify"
          icon={<Wallet size={18} />}
          delay={120}
        />
        <StatCard
          label="Votre commission"
          value={formatEUR(stats.commission_manager_totale)}
          hint={`${formatEUR(stats.commission_manager_payee)} déjà versés`}
          icon={<Crown size={18} />}
          delay={180}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Classement */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Classement</CardTitle>
            <span className="text-xs text-ink-300/70">par CA généré</span>
          </CardHeader>
          {classement.length === 0 ? (
            <EmptyState message="Pas encore de commercial dans votre équipe." />
          ) : (
            <ol className="divide-y divide-gold-400/5">
              {classement.map((row, idx) => (
                <li
                  key={row.commercial.commercial_id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-sm ${
                        idx === 0
                          ? "bg-gold-400 text-forest-950"
                          : idx === 1
                          ? "bg-gold-400/30 text-gold-400"
                          : idx === 2
                          ? "bg-gold-400/15 text-gold-400"
                          : "bg-forest-700/60 text-ink-300"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm text-ink-100">
                        {row.commercial.prenom} {row.commercial.nom}
                      </p>
                      <p className="text-xs text-ink-300/70">
                        {row.nb_ventes} vente{row.nb_ventes > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gold-400">{formatEUR(row.ca)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Ventes équipe */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Ventes récentes de l'équipe</CardTitle>
            <span className="text-xs text-ink-300/70">{ventesEquipe.length} commandes</span>
          </CardHeader>
          {ventesEquipe.length === 0 ? (
            <EmptyState message="Aucune vente enregistrée pour votre équipe." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Commercial</Th>
                  <Th>Produit</Th>
                  <Th>Montant</Th>
                  <Th>Statut</Th>
                </Tr>
              </Thead>
              <tbody>
                {ventesEquipe.slice(0, 12).map((v) => {
                  const c = commerciauxById.get(v.commercial_id);
                  return (
                    <Tr key={v.commande_id}>
                      <Td className="text-ink-300">{formatDate(v.date)}</Td>
                      <Td>
                        {c ? `${c.prenom} ${c.nom}` : "—"}
                      </Td>
                      <Td className="max-w-[200px] truncate">{v.produit_nom}</Td>
                      <Td className="font-medium text-gold-400">
                        {formatEUR(v.montant)}
                      </Td>
                      <Td>
                        <Badge tone={v.statut === "payee" ? "gold" : "muted"}>
                          {v.statut === "payee"
                            ? "Payée"
                            : v.statut === "remboursee"
                            ? "Remboursée"
                            : "En attente"}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
