import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  sheetsGetCommissions,
  sheetsGetCommerciaux,
  sheetsGetCommandes,
  SheetsError,
} from "@/lib/googleSheets";
import { getMockFallbackStats } from "@/lib/dataSource";

// ─────────────────────────────────────────────────────────────────
// GET /api/health/sheets
//
// Diagnostic à appeler depuis le navigateur quand un truc cloche :
//   - Es-tu connecté à Google Sheets ?
//   - Quels onglets fonctionnent ?
//   - Quel est le header de chaque onglet (utile pour ajuster
//     les alias dans lib/googleSheets.ts si une colonne manque) ?
//   - Y a-t-il des doublons de commande_id ?
//
// Réservé aux admins (les autres reçoivent 401).
// ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

interface CheckResult {
  tab: string;
  ok: boolean;
  count?: number;
  duplicates?: { commande_id: string; occurrences: number }[];
  error?: string;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const env = {
    DATA_SOURCE: process.env.DATA_SOURCE || "(auto)",
    has_GOOGLE_SHEET_ID:
      !!process.env.GOOGLE_SHEET_ID || !!process.env.GOOGLE_SHEETS_ID,
    has_GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
    has_GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
    has_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXT_PUBLIC_SHOPIFY_URL: process.env.NEXT_PUBLIC_SHOPIFY_URL || null,
  };

  const results: CheckResult[] = [];

  // Commerciaux
  try {
    const c = await sheetsGetCommerciaux();
    results.push({ tab: "Commerciaux", ok: true, count: c.length });
  } catch (err: unknown) {
    results.push({
      tab: "Commerciaux",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Commandes + check doublons par commande_id
  try {
    const cmds = await sheetsGetCommandes();
    const dup = countDuplicates(cmds.map((c) => c.commande_id));
    results.push({
      tab: "Commandes",
      ok: true,
      count: cmds.length,
      duplicates: dup,
    });
  } catch (err: unknown) {
    results.push({
      tab: "Commandes",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Commissions + check doublons par commande_id (toutes lignes)
  try {
    const comm = await sheetsGetCommissions();
    // On compte les doublons en regroupant par commande_id + role_beneficiaire
    // (une commande légitime a 2 lignes : 1 vendeur + 1 manager, donc on ne
    // veut PAS compter ces 2 lignes comme un doublon).
    const keys = comm.map(
      (c) => `${c.commande_id}::${c.role_beneficiaire}`
    );
    const dup = countDuplicates(keys);
    results.push({
      tab: "Commissions",
      ok: true,
      count: comm.length,
      duplicates: dup,
    });
  } catch (err: unknown) {
    results.push({
      tab: "Commissions",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const allOk = results.every((r) => r.ok);
  const totalDuplicates = results
    .flatMap((r) => r.duplicates || [])
    .reduce((acc, d) => acc + d.occurrences - 1, 0);

  const mockStats = getMockFallbackStats();

  return NextResponse.json({
    ok: allOk && mockStats.count === 0,
    env,
    results,
    mock_fallback: {
      count_since_boot: mockStats.count,
      last: mockStats.last
        ? {
            ...mockStats.last,
            seconds_ago: Math.round((Date.now() - mockStats.last.at) / 1000),
          }
        : null,
    },
    summary: {
      tabs_ok: results.filter((r) => r.ok).length,
      tabs_ko: results.filter((r) => !r.ok).length,
      duplicate_rows_detected: totalDuplicates,
      mock_fallbacks: mockStats.count,
    },
  });
}

function countDuplicates(keys: string[]): {
  commande_id: string;
  occurrences: number;
}[] {
  const counts = new Map<string, number>();
  for (const k of keys) {
    if (!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, n]) => n > 1)
    .map(([k, n]) => ({ commande_id: k, occurrences: n }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 20); // limite pour ne pas saturer la réponse
}
