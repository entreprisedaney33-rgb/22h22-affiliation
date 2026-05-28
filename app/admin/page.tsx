// Empêche Next.js de mettre la page en cache statique :
// chaque visite refait une lecture fraîche de Google Sheets.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getCommerciaux,
  getCommandes,
  getCommissions,
  getDuplicatesStats,
  getMockFallbackStats,
} from "@/lib/dataSource";
import { statsAdmin } from "@/lib/selectors";
import { formatEUR, formatDate, LABELS_TYPE_COMMISSION } from "@/lib/commissions";
import AdminShell from "@/components/layout/AdminShell";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, Thead, Tr, Th, Td } from "@/components/ui/Table";
import { StatutBadge } from "@/components/ui/Badge";
import Link from "next/link";
import Button from "@/components/ui/Button";
import {
  Users,
  Crown,
  ShoppingBag,
  Wallet,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(session.role === "manager" ? "/manager" : "/commercial");
  }

  const [commerciaux, commandes, commissions, dupStats] = await Promise.all([
    getCommerciaux(),
    getCommandes(),
    getCommissions(),
    getDuplicatesStats(),
  ]);

  // À lire APRÈS les lectures, pour savoir si l'une d'elles est retombée
  // silencieusement sur le mock (= les chiffres ne reflètent pas le Sheet).
  const mockStats = getMockFallbackStats();
  const fallbackJustHappened =
    mockStats.last !== null && Date.now() - mockStats.last.at < 30_000;

  const stats = statsAdmin(commerciaux, commandes, commissions);

  const aValider = commissions
    .filter((c) => c.statut === "a_valider")
    .sort((a, b) => b.date_creation.localeCompare(a.date_creation));

  const commerciauxById = new Map(commerciaux.map((c) => [c.commercial_id, c]));

  const totalDoublons =
    dupStats.commandes_doublons + dupStats.commissions_doublons;

  return (
    <AdminShell user={session} current="/admin">
      <PageHeader
        eyebrow="Administration"
        title="Tableau de bord"
        description="Vue consolidée de l'activité d'affiliation 22h22."
      />

      {fallbackJustHappened && (
        <div className="mb-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-300" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-rose-100">
                Affichage en mode dégradé — données mock
              </p>
              <p className="text-sm leading-relaxed text-rose-100/90">
                La lecture <span className="font-mono">{mockStats.last?.label}</span>{" "}
                de Google Sheets a échoué — Next a basculé sur des données mock
                pour ne pas casser l'affichage.
                <br />
                <span className="font-mono text-xs">{mockStats.last?.reason}</span>
                <br />
                Recharge la page dans quelques secondes. Si ça persiste,
                consulte{" "}
                <a
                  href="/api/health/sheets"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-rose-50"
                >
                  /api/health/sheets
                </a>{" "}
                et les logs Vercel (Functions → Logs).
              </p>
            </div>
          </div>
        </div>
      )}

      {totalDoublons > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-amber-100">
                Doublons détectés dans Google Sheets
              </p>
              <p className="text-sm leading-relaxed text-amber-100/80">
                {dupStats.commandes_doublons > 0 && (
                  <>
                    {dupStats.commandes_doublons} ligne{dupStats.commandes_doublons > 1 ? "s" : ""} en
                    double dans <span className="font-mono">Commandes</span>
                    {dupStats.commissions_doublons > 0 && " · "}
                  </>
                )}
                {dupStats.commissions_doublons > 0 && (
                  <>
                    {dupStats.commissions_doublons} ligne{dupStats.commissions_doublons > 1 ? "s" : ""} en
                    double dans <span className="font-mono">Commissions</span>
                  </>
                )}
                . Les dashboards les masquent automatiquement, mais il faut
                ajouter un garde-fou côté Apps Script (vérifier que la{" "}
                <span className="font-mono">commande_id</span> n'existe pas
                avant d'écrire). Détails sur{" "}
                <a
                  href="/api/health/sheets"
                  className="underline hover:text-amber-50"
                  target="_blank"
                  rel="noreferrer"
                >
                  /api/health/sheets
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Commerciaux" value={String(stats.nb_commerciaux)} icon={<Users size={18} />} delay={0} accent />
        <StatCard label="Managers"    value={String(stats.nb_managers)}    icon={<Crown size={18} />} delay={60} />
        <StatCard label="Commandes"   value={String(stats.nb_commandes)}   icon={<ShoppingBag size={18} />} delay={120} />
        <StatCard label="CA Total"    value={formatEUR(stats.ca_total)}    hint="commandes payées" icon={<Wallet size={18} />} delay={180} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="À valider" value={formatEUR(stats.commissions_a_valider)} hint="action requise" icon={<AlertCircle size={18} />} delay={240} />
        <StatCard label="À payer"   value={formatEUR(stats.commissions_a_payer)}   hint="prochaine vague" delay={300} />
        <StatCard label="Payées"    value={formatEUR(stats.commissions_payees)}    hint="cumul versé"    delay={360} />
      </div>

      {/* À valider */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Commissions à valider</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-300/70">{aValider.length} en attente</span>
              <Link href="/admin/commissions?statut=a_valider">
                <Button size="sm" variant="outline">Tout voir</Button>
              </Link>
            </div>
          </CardHeader>
          {aValider.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-ink-300/70">
              Rien à valider. ✨
            </div>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Bénéficiaire</Th>
                  <Th>Type</Th>
                  <Th>Commande</Th>
                  <Th>Montant</Th>
                  <Th>Statut</Th>
                </Tr>
              </Thead>
              <tbody>
                {aValider.slice(0, 8).map((c) => {
                  const benef = commerciauxById.get(c.commercial_id);
                  return (
                    <Tr key={c.commission_id}>
                      <Td className="text-ink-300">{formatDate(c.date_creation)}</Td>
                      <Td>
                        {benef ? `${benef.prenom} ${benef.nom}` : c.commercial_id}
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-300/60">
                          {c.role_beneficiaire}
                        </span>
                      </Td>
                      <Td>{LABELS_TYPE_COMMISSION[c.type_commission]}</Td>
                      <Td className="font-mono text-xs text-ink-300">{c.commande_id}</Td>
                      <Td className="font-medium text-gold-400">
                        {formatEUR(c.commission_vendeur)}
                      </Td>
                      <Td><StatutBadge statut={c.statut} /></Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
