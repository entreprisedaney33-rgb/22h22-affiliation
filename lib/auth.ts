// ─────────────────────────────────────────────────────────────────
// Auth MVP — cookie httpOnly signé contenant l'id du commercial.
//
// Mapping login (onglet Commerciaux du Sheet) :
//   - email             → colonne email
//   - mot de passe      → colonne mot_de_passe_temp
//   - autorisé          → uniquement si statut == "actif"
//
// Le mot de passe n'est PAS hashé (le Sheet est en clair). À durcir
// avant prod : bcrypt + rotation des secrets.
// ─────────────────────────────────────────────────────────────────

import { cookies } from "next/headers";
import crypto from "crypto";
import { getCommercialByEmail, getCommercialById } from "./dataSource";
import type { Commercial, SessionUser } from "./types";

const COOKIE_NAME = "h22_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

function secret(): string {
  // On accepte les deux noms : NEXTAUTH_SECRET (officiel sur Vercel)
  // ou AUTH_SECRET (legacy). En dev sans aucun des deux on a un
  // fallback bruyant — à éviter en prod.
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "dev-secret-change-me"
  );
}

function sign(value: string): string {
  const hmac = crypto.createHmac("sha256", secret()).update(value).digest("hex");
  return `${value}.${hmac}`;
}

function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", secret()).update(value).digest("hex");
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return value;
}

export function toSessionUser(c: Commercial): SessionUser {
  return {
    commercial_id: c.commercial_id,
    prenom: c.prenom,
    nom: c.nom,
    email: c.email,
    role: c.role,
    manager_id: c.manager_id,
    code_affilie: c.code_affilie,
    lien_affilie: c.lien_affilie,
  };
}

export async function authenticate(
  email: string,
  motDePasse: string
): Promise<Commercial | null> {
  const user = await getCommercialByEmail(email);
  if (!user) return null;
  // Statut doit être actif (notre type est déjà normalisé en lowercase
  // par le mapping Sheets ou les mocks).
  if (user.statut !== "actif") return null;
  // Comparaison stricte sur le mot de passe temporaire.
  if ((user.mot_de_passe_temp || "").trim() !== (motDePasse || "").trim()) {
    return null;
  }
  return user;
}

export async function createSession(commercial_id: string) {
  const c = await cookies();
  c.set(COOKIE_NAME, sign(commercial_id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroySession() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const commercial_id = verify(raw);
  if (!commercial_id) return null;
  const user = await getCommercialById(commercial_id);
  if (!user || user.statut !== "actif") return null;
  return toSessionUser(user);
}

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}
