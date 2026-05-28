// Empêche Next.js de mettre la page en cache statique :
// chaque visite refait une lecture fraîche de Google Sheets.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getManagers } from "@/lib/dataSource";
import AdminShell from "@/components/layout/AdminShell";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import CommercialForm from "@/components/dashboard/CommercialForm";

export default async function NouveauCommercial() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  const managers = await getManagers();

  return (
    <AdminShell user={session} current="/admin/commerciaux">
      <PageHeader
        eyebrow="Commerciaux"
        title="Nouveau commercial"
        description="Créez un compte. Le lien d'affiliation est généré automatiquement à partir du code."
      />
      <Card>
        <CardBody>
          <CommercialForm managers={managers} mode="create" />
        </CardBody>
      </Card>
    </AdminShell>
  );
}
