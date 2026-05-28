// ─────────────────────────────────────────────────────────────────
// GET /api/debug/statut
//
// Lit DIRECTEMENT l'onglet Commissions sans normalisation et renvoie,
// pour chaque ligne, la valeur brute de la cellule statut + son
// dump hexadécimal + la valeur normalisée par notre code.
//
// À utiliser pour comprendre pourquoi une cellule "À payer" se relit
// en "a_valider" : on voit les caractères exotiques (espace insécable,
// guillemets, zero-width...) et on adapte normalizeStatutCommission
// en conséquence.
//
// Réservé aux admins. À retirer plus tard quand tout est stable.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function spreadsheetId(): string | null {
  return process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEETS_ID || null;
}

function normalizeKey(k: string): string {
  return (k || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

const STATUT_ALIASES = ["statut", "status", "etat", "état", "statut_commission"];
const ID_ALIASES = ["commission_id", "id_commission", "id"];

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sid = spreadsheetId();
  if (!sid) {
    return NextResponse.json({ error: "GOOGLE_SHEET_ID manquant" }, { status: 500 });
  }

  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sid,
      range: "Commissions",
    });
    const values = (res.data.values || []) as string[][];
    if (values.length < 2) {
      return NextResponse.json({ ok: true, rows: [], note: "onglet vide" });
    }

    const [header, ...rows] = values;
    const normalizedHeaders = header.map(normalizeKey);

    // Localiser la colonne statut
    let statutIdx = -1;
    let statutHeader = "";
    for (const a of STATUT_ALIASES) {
      const i = normalizedHeaders.indexOf(normalizeKey(a));
      if (i !== -1) {
        statutIdx = i;
        statutHeader = header[i];
        break;
      }
    }

    // Localiser la colonne id
    let idIdx = -1;
    for (const a of ID_ALIASES) {
      const i = normalizedHeaders.indexOf(normalizeKey(a));
      if (i !== -1) {
        idIdx = i;
        break;
      }
    }

    if (statutIdx === -1) {
      return NextResponse.json({
        error: "Colonne statut introuvable",
        header_raw: header,
        header_normalized: normalizedHeaders,
        aliases_tested: STATUT_ALIASES,
      }, { status: 500 });
    }

    // Pour chaque ligne, on renvoie raw + hex + cleaned
    const dump = rows.slice(0, 30).map((r, i) => {
      const raw = r[statutIdx] ?? "";
      const id = idIdx !== -1 ? (r[idIdx] ?? "") : `line_${i + 2}`;
      const hex = Array.from(raw)
        .map((c) => c.charCodeAt(0).toString(16).padStart(4, "0"))
        .join(" ");
      const cleaned = raw
        .trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/["'`«»‘’“”]/g, "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s_\-]+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .replace(/^_+|_+$/g, "");

      return {
        line: i + 2, // 1-based dans Sheets, +1 pour le header
        id,
        raw,
        hex,
        cleaned,
        raw_length: raw.length,
      };
    });

    return NextResponse.json({
      ok: true,
      statut_column: {
        header_label: statutHeader,
        header_normalized: normalizeKey(statutHeader),
        index_0based: statutIdx,
      },
      header_full: header,
      rows_sampled: dump.length,
      total_rows: rows.length,
      rows: dump,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "fetch_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
