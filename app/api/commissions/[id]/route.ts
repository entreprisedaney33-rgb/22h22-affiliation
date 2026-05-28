import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { updateCommissionStatut } from "@/lib/dataSource";
import { SheetsError } from "@/lib/googleSheets";
import type { StatutCommission } from "@/lib/types";

// Cette route mute des données : elle ne doit JAMAIS être cachée.
export const dynamic = "force-dynamic";

const STATUTS: StatutCommission[] = [
  "a_valider", "validee", "a_payer", "payee", "annulee",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "unauthorized", message: "Action réservée à l'administrateur." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const statut = body?.statut as StatutCommission;

  // Critères de fallback envoyés par le client : si commission_id ne
  // matche pas une ligne exactement (format imparfait), on retrouve la
  // ligne via ce quadruplet fonctionnel.
  const fallback = {
    commande_id: typeof body?.commande_id === "string" ? body.commande_id : undefined,
    type_commission: typeof body?.type_commission === "string" ? body.type_commission : undefined,
    commercial_id: typeof body?.commercial_id === "string" ? body.commercial_id : undefined,
    role_beneficiaire: typeof body?.role_beneficiaire === "string" ? body.role_beneficiaire : undefined,
  };

  if (!STATUTS.includes(statut)) {
    return NextResponse.json(
      {
        error: "invalid_statut",
        message: `Statut "${statut}" invalide. Attendu : ${STATUTS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  try {
    const updated = await updateCommissionStatut(id, statut, fallback);
    if (!updated) {
      // Cas mode mock uniquement (l'écriture Sheets lance une SheetsError détaillée).
      return NextResponse.json(
        {
          error: "not_found",
          message: `Commission "${id}" introuvable.`,
        },
        { status: 404 }
      );
    }

    // Invalider TOUS les rendus serveur qui dépendent des commissions,
    // pour que la prochaine navigation/refresh récupère bien les
    // nouvelles données depuis Google Sheets et pas un cache Next.
    revalidatePath("/admin");
    revalidatePath("/admin/commissions");
    revalidatePath("/manager");
    revalidatePath("/commercial");
    // layout = true → invalide aussi les layouts englobants
    revalidatePath("/", "layout");

    return NextResponse.json({ ok: true, commission: updated });
  } catch (err: unknown) {
    // Log serveur visible dans les logs Vercel (Functions → Logs)
    console.error(
      "[PATCH /api/commissions/:id] échec update statut",
      { commission_id: id, statut, error: err }
    );

    const isSheets = err instanceof SheetsError;
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json(
      {
        error: isSheets ? "sheets_error" : "internal_error",
        message,
      },
      { status: 500 }
    );
  }
}
