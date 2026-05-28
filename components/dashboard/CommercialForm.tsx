"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { Commercial, Manager, Role, StatutCommercial } from "@/lib/types";

export default function CommercialForm({
  initial,
  managers,
  mode,
}: {
  initial?: Commercial;
  managers: Manager[];
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    prenom: initial?.prenom ?? "",
    nom: initial?.nom ?? "",
    email: initial?.email ?? "",
    mot_de_passe_temp: initial?.mot_de_passe_temp ?? "",
    role: (initial?.role ?? "commercial") as Role,
    manager_id: initial?.manager_id ?? "",
    code_affilie: initial?.code_affilie ?? "",
    statut: (initial?.statut ?? "actif") as StatutCommercial,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const url =
        mode === "create"
          ? "/api/commerciaux"
          : `/api/commerciaux/${initial!.commercial_id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        body: JSON.stringify({
          ...form,
          manager_id: form.manager_id || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur");
      }
      // Petit délai pour absorber la latence de propagation Sheets,
      // puis on navigue et on force le refresh côté serveur.
      await new Promise((r) => setTimeout(r, 250));
      router.push("/admin/commerciaux");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Erreur inconnue");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input
          label="Prénom"
          name="prenom"
          value={form.prenom}
          onChange={(e: ChangeEvent<HTMLInputElement>) => set("prenom", e.target.value)}
          required
        />
        <Input
          label="Nom"
          name="nom"
          value={form.nom}
          onChange={(e: ChangeEvent<HTMLInputElement>) => set("nom", e.target.value)}
          required
        />
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => set("email", e.target.value)}
          required
        />
        <Input
          label="Mot de passe temporaire"
          name="mot_de_passe_temp"
          type="text"
          value={form.mot_de_passe_temp}
          onChange={(e: ChangeEvent<HTMLInputElement>) => set("mot_de_passe_temp", e.target.value)}
          required
        />
        <Select
          label="Rôle"
          name="role"
          value={form.role}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => set("role", e.target.value as Role)}
        >
          <option value="commercial">Commercial</option>
          <option value="manager">Manager</option>
          <option value="admin">Administrateur</option>
        </Select>
        <Select
          label="Manager (si commercial)"
          name="manager_id"
          value={form.manager_id ?? ""}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => set("manager_id", e.target.value || "")}
          disabled={form.role !== "commercial"}
        >
          <option value="">— Aucun —</option>
          {managers.map((m) => (
            <option key={m.manager_id} value={m.manager_id}>
              {m.prenom} {m.nom}
            </option>
          ))}
        </Select>
        <Input
          label="Code affilié"
          name="code_affilie"
          value={form.code_affilie}
          onChange={(e: ChangeEvent<HTMLInputElement>) => set("code_affilie", e.target.value)}
          required
        />
        <Select
          label="Statut"
          name="statut"
          value={form.statut}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => set("statut", e.target.value as StatutCommercial)}
        >
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
          <option value="suspendu">Suspendu</option>
        </Select>
      </div>

      <div className="flex justify-end gap-3 border-t border-gold-400/10 pt-5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : mode === "create" ? "Créer" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
