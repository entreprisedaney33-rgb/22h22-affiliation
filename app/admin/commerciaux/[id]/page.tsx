// Empêche Next.js de mettre la page en cache statique :
// chaque visite refait une lecture fraîche de Google Sheets.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCommercialById, getManagers } from "@/lib/dataSource";
import AdminShell from "@/components/layout/AdminShell";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import CommercialForm from "@/components/dashboard/CommercialForm";

export default async function EditCommercial({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  const { id } = await params;
  const [commercial, managers] = await Promise.all([
    getCommercialById(id),
    getManagers(),
  ]);
  if (!commercial) notFound();

  return (
    <AdminShell user={session} current="/admin/commerciaux">
      <PageHeader
        eyebrow="Commerciaux"
        title={`${commercial.prenom} ${commercial.nom}`}
        description={`ID ${commercial.commercial_id} · ${commercial.email}`}
      />
      <Card>
        <CardBody>
          <CommercialForm initial={commercial} managers={managers} mode="edit" />
        </CardBody>
      </Card>
    </AdminShell>
  );
}
