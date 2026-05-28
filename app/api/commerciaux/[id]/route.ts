import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { updateCommercial } from "@/lib/dataSource";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const updated = await updateCommercial(id, {
    prenom: body.prenom,
    nom: body.nom,
    email: body.email,
    mot_de_passe_temp: body.mot_de_passe_temp,
    role: body.role,
    manager_id: body.manager_id ?? null,
    code_affilie: body.code_affilie,
    statut: body.statut,
  });

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  revalidatePath("/admin/commerciaux");
  revalidatePath("/admin");
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, commercial: updated });
}
