// Empêche Next.js de mettre la page en cache statique :
// chaque visite refait une lecture fraîche de Google Sheets.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getCommissions,
  getCommandes,
  getCommercialById,
} from "@/lib/dataSource";
import { statsCommercial, matchesCommercial } from "@/lib/selectors";
import { formatEUR, formatDate, LABELS_TYPE_COMMISSION } from "@/lib/commissions";
import AppShell from "@/components/layout/AppShell";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Table, Thead, Tr, Th, Td, EmptyState } from "@/components/ui/Table";
import { StatutBadge } from "@/components/ui/Badge";
import CopyLink from "@/components/ui/CopyLink";
import { LayoutDashboard, ShoppingBag, Wallet, TrendingUp } from "lucide-react";

const NAV = [
  { href: "/commercial", label: "Tableau de bord", icon: <LayoutDashboard size={14} /> },
];

export default async function CommercialDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "commercial") {
    redirect(session.role === "admin" ? "/admin" : "/manager");
  }

  const [commissions, commandes, account] = await Promise.all([
    getCommissions(),
    getCommandes(),
    getCommercialById(session.commercial_id),
  ]);

  if (!account) redirect("/login");

  const stats = statsCommercial(account, commissions, commandes);

  const mesVentes = commandes
    .filter((c) => matchesCommercial(account, c))
    .sort((a, b) => b.date.localeCompare(a.date));

  const mesCommissions = commissions
    .filter(
      (c) =>
        c.role_beneficiaire === "commercial" && matchesCommercial(account, c)
    )
    .sort((a, b) => b.date_creation.localeCompare(a.date_creation));

  return (
    <AppShell user={session} nav={NAV} current="/commercial">
      <PageHeader
        eyebrow={`Bienvenue, ${session.prenom}`}
        title="Votre espace commercial"
        description="Suivez vos ventes, vos commissions et partagez votre lien d'affiliation."
      />

      {/* Lien affilié — l'élément le plus important pour un vendeur */}
      <div className="rise mb-8 rounded-2xl border border-gold-400/15 bg-gradient-to-br from-forest-800/60 to-forest-900/60 p-6 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold-400/80">
              Votre lien d'affiliation
            </p>
            <p className="mt-1 text-sm text-ink-300">
              Code affilié : <span className="font-mono text-gold-400">{session.code_affilie}</span>
            </p>
          </div>
        </div>
        <div className="mt-4">
          <CopyLink value={session.lien_affilie} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ventes"
          value={String(stats.nb_ventes)}
          hint="commandes apportées"
          icon={<ShoppingBag size={18} />}
          delay={0}
          accent
        />
        <StatCard
          label="À valider"
          value={formatEUR(stats.commissions_a_valider)}
          hint="en attente de validation"
          icon={<TrendingUp size={18} />}
          delay={60}
        />
        <StatCard
          label="Validées"
          value={formatEUR(stats.commissions_validees + stats.commissions_a_payer)}
          hint="prochaine vague de paiement"
          icon={<Wallet size={18} />}
          delay={120}
        />
        <StatCard
          label="Payées"
          value={formatEUR(stats.commissions_payees)}
          hint="cumul versé"
          icon={<Wallet size={18} />}
          delay={180}
        />
      </div>

      {/* Commissions */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Vos commissions</CardTitle>
            <span className="text-xs text-ink-300/70">
              {mesCommissions.length} {mesCommissions.length > 1 ? "lignes" : "ligne"}
            </span>
          </CardHeader>
          {mesCommissions.length === 0 ? (
            <EmptyState message="Pas encore de commission. Partagez votre lien pour démarrer." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Commande</Th>
                  <Th>Montant</Th>
                  <Th>Statut</Th>
                </Tr>
              </Thead>
              <tbody>
                {mesCommissions.map((c) => (
                  <Tr key={c.commission_id}>
                    <Td className="text-ink-300">{formatDate(c.date_commission)}</Td>
                    <Td>{LABELS_TYPE_COMMISSION[c.type_commission]}</Td>
                    <Td className="font-mono text-xs text-ink-300">{c.commande_id}</Td>
                    <Td className="font-medium text-gold-400">
                      {formatEUR(c.commission_vendeur)}
                    </Td>
                    <Td>
                      <StatutBadge statut={c.statut} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dernières ventes</CardTitle>
          </CardHeader>
          {mesVentes.length === 0 ? (
            <EmptyState message="Aucune vente pour le moment." />
          ) : (
            <ul className="divide-y divide-gold-400/5">
              {mesVentes.slice(0, 8).map((v) => (
                <li key={v.commande_id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink-100">{v.produit_nom}</p>
                      <p className="truncate text-xs text-ink-300/70">
                        {v.client_email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gold-400">
                        {formatEUR(v.montant)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-ink-300/60">
                        {formatDate(v.date)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
