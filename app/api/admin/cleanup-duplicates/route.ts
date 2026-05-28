// ─────────────────────────────────────────────────────────────────
// POST /api/admin/cleanup-duplicates
//
// Nettoie les doublons existants dans Commandes et Commissions.
//
//   - Sans body / { "confirm": false }  → DRY-RUN : montre ce qui
//     serait supprimé, ne touche à rien.
//   - { "confirm": true }               → applique réellement la
//     suppression (réécrit les onglets).
//
// ⚠️ Opération destructive. Fais une copie du Sheet avant le premier
//    run avec confirm:true. Réservé aux admins.
//
// Rappel : ceci nettoie l'EXISTANT. Pour empêcher les doublons de
// revenir, il faut aussi rendre l'écriture idempotente côté Apps
// Script (voir docs/APPS_SCRIPT_FIX.md).
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { cleanupDuplicates, SheetsError } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "unauthorized", message: "Réservé à l'administrateur." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const confirm = body?.confirm === true;

  try {
    const reports = await cleanupDuplicates(confirm);
    const totalRemoved = reports.reduce((acc, r) => acc + r.removed_rows, 0);

    if (confirm && totalRemoved > 0) {
      revalidatePath("/admin");
      revalidatePath("/admin/commissions");
      revalidatePath("/manager");
      revalidatePath("/commercial");
      revalidatePath("/", "layout");
    }

    return NextResponse.json({
      ok: true,
      mode: confirm ? "applied" : "dry_run",
      message: confirm
        ? `Nettoyage appliqué : ${totalRemoved} ligne(s) en double supprimée(s).`
        : `Simulation : ${totalRemoved} ligne(s) en double seraient supprimées. ` +
          `Renvoie { "confirm": true } pour appliquer.`,
      total_removed: totalRemoved,
      reports,
    });
  } catch (err: unknown) {
    const isSheets = err instanceof SheetsError;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cleanup-duplicates] échec", err);
    return NextResponse.json(
      { error: isSheets ? "sheets_error" : "internal_error", message },
      { status: 500 }
    );
  }
}
