import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createCommercial } from "@/lib/dataSource";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const required = ["prenom", "nom", "email", "mot_de_passe_temp", "role", "code_affilie", "statut"];
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `missing_${k}` }, { status: 400 });
  }

  const created = await createCommercial({
    prenom: body.prenom,
    nom: body.nom,
    email: body.email,
    mot_de_passe_temp: body.mot_de_passe_temp,
    role: body.role,
    manager_id: body.manager_id ?? null,
    code_affilie: body.code_affilie,
    statut: body.statut,
  });

  revalidatePath("/admin/commerciaux");
  revalidatePath("/admin");
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, commercial: created });
}
