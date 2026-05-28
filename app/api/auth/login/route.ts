import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim();
  const motDePasse = String(form.get("password") || "");

  if (!email || !motDePasse) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "missing");
    return NextResponse.redirect(url, { status: 303 });
  }

  const user = await authenticate(email, motDePasse);
  if (!user) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url, { status: 303 });
  }

  await createSession(user.commercial_id);

  const target =
    user.role === "admin" ? "/admin" :
    user.role === "manager" ? "/manager" :
    "/commercial";
  return NextResponse.redirect(new URL(target, req.url), { status: 303 });
}
