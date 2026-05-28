// Empêche Next.js de mettre la page en cache statique :
// chaque visite refait une lecture fraîche de Google Sheets.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCommissions, getCommerciaux } from "@/lib/dataSource";
import AdminShell from "@/components/layout/AdminShell";
import PageHeader from "@/components/layout/PageHeader";
import CommissionsTable from "@/components/dashboard/CommissionsTable";
import type { StatutCommission } from "@/lib/types";

const STATUTS = new Set<StatutCommission>([
  "a_valider", "validee", "a_payer", "payee", "annulee",
]);

export default async function AdminCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  const { statut } = await searchParams;
  const initialStatut = (statut && STATUTS.has(statut as StatutCommission))
    ? (statut as StatutCommission)
    : "";

  const [commissions, commerciaux] = await Promise.all([
    getCommissions(),
    getCommerciaux(),
  ]);

  return (
    <AdminShell user={session} current="/admin/commissions">
      <PageHeader
        eyebrow="Administration"
        title="Commissions"
        description="Visualisez et faites évoluer le statut de chaque ligne de commission."
      />
      <CommissionsTable
        commissions={commissions}
        commerciaux={commerciaux}
        initialStatut={initialStatut}
      />
    </AdminShell>
  );
}
