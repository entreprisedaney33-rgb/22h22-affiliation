// Empêche Next.js de mettre la page en cache statique :
// chaque visite refait une lecture fraîche de Google Sheets.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCommerciaux } from "@/lib/dataSource";
import { formatDate, LABELS_ROLE } from "@/lib/commissions";
import AdminShell from "@/components/layout/AdminShell";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, Thead, Tr, Th, Td, EmptyState } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";

export default async function AdminCommerciauxPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") {
    redirect(session.role === "manager" ? "/manager" : "/commercial");
  }

  const commerciaux = await getCommerciaux();
  const commerciauxById = new Map(commerciaux.map((c) => [c.commercial_id, c]));

  return (
    <AdminShell user={session} current="/admin/commerciaux">
      <PageHeader
        eyebrow="Administration"
        title="Commerciaux & Managers"
        description="Gérez les comptes, codes affiliés et affectations aux managers."
        actions={
          <Link href="/admin/commerciaux/nouveau">
            <Button>
              <Plus size={16} />
              Nouveau commercial
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{commerciaux.length} comptes</CardTitle>
        </CardHeader>
        {commerciaux.length === 0 ? (
          <EmptyState message="Aucun compte." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Nom</Th>
                <Th>Email</Th>
                <Th>Rôle</Th>
                <Th>Manager</Th>
                <Th>Code</Th>
                <Th>Statut</Th>
                <Th>Créé</Th>
                <Th>{" "}</Th>
              </Tr>
            </Thead>
            <tbody>
              {commerciaux.map((c) => {
                const mgr = c.manager_id ? commerciauxById.get(c.manager_id) : null;
                return (
                  <Tr key={c.commercial_id}>
                    <Td className="font-mono text-xs text-ink-300">
                      {c.commercial_id}
                    </Td>
                    <Td className="text-ink-100">{c.prenom} {c.nom}</Td>
                    <Td className="text-ink-300">{c.email}</Td>
                    <Td>
                      <Badge tone={c.role === "admin" ? "gold" : "neutral"}>
                        {LABELS_ROLE[c.role]}
                      </Badge>
                    </Td>
                    <Td className="text-ink-300">
                      {mgr ? `${mgr.prenom} ${mgr.nom}` : "—"}
                    </Td>
                    <Td className="font-mono text-xs text-gold-400">
                      {c.code_affilie}
                    </Td>
                    <Td>
                      <Badge tone={c.statut === "actif" ? "gold" : "muted"}>
                        {c.statut}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-ink-300/70">
                      {formatDate(c.date_creation)}
                    </Td>
                    <Td>
                      <Link href={`/admin/commerciaux/${c.commercial_id}`}>
                        <button className="rounded-full p-1.5 text-ink-300 hover:bg-forest-700/40 hover:text-ink-100">
                          <Pencil size={14} />
                        </button>
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </AdminShell>
  );
}
