// Empêche Next.js de mettre la page en cache statique :
// chaque visite refait une lecture fraîche de Google Sheets.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminShell from "@/components/layout/AdminShell";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { REGLES_COMMISSION, formatEUR } from "@/lib/commissions";
import { ExternalLink, AlertTriangle } from "lucide-react";

export default async function ParametresPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_URL || "https://22h22foret.fr";
  const dataSource = process.env.DATA_SOURCE || "mock";
  const sheetId = process.env.GOOGLE_SHEETS_ID || "";

  const r = REGLES_COMMISSION;
  const manager176 = r.produit_176.commission_vendeur * r.produit_176.taux_manager;

  return (
    <AdminShell user={session} current="/admin/parametres">
      <PageHeader
        eyebrow="Administration"
        title="Paramètres"
        description="Configuration du site, source de données et règles de commission."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Site Shopify */}
        <Card>
          <CardHeader>
            <CardTitle>Site Shopify</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-300/80">
                URL du site
              </p>
              <a
                href={shopifyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-2 font-mono text-sm text-gold-400 hover:underline"
              >
                {shopifyUrl}
                <ExternalLink size={14} />
              </a>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-300/80">
                Format du lien affilié
              </p>
              <p className="mt-1 font-mono text-sm text-ink-100">
                {shopifyUrl}/?ref=<span className="text-gold-400">CODE</span>
              </p>
            </div>
            <div className="rounded-lg border border-gold-400/10 bg-forest-900/40 px-4 py-3 text-xs text-ink-300">
              Pour modifier l'URL, mettez à jour la variable
              <span className="ml-1 font-mono text-gold-400">NEXT_PUBLIC_SHOPIFY_URL</span>
              {" "}dans votre fichier <span className="font-mono text-gold-400">.env.local</span>.
            </div>
          </CardBody>
        </Card>

        {/* Source de données */}
        <Card>
          <CardHeader>
            <CardTitle>Source de données</CardTitle>
            <Badge tone={dataSource === "sheets" ? "gold" : "muted"}>
              {dataSource}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-ink-300">
              {dataSource === "mock" ? (
                <>
                  Mode <span className="font-mono text-gold-400">mock</span> : les
                  données proviennent de <span className="font-mono">lib/mockData.ts</span>.
                  Les modifications (création, statuts) sont en mémoire et
                  disparaissent au redémarrage.
                </>
              ) : (
                <>
                  Mode <span className="font-mono text-gold-400">sheets</span> : les
                  données sont lues et écrites dans Google Sheets.
                </>
              )}
            </p>

            {dataSource === "sheets" && (
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-300/80">
                  Sheet ID
                </p>
                <p className="mt-1 font-mono text-xs text-ink-100">
                  {sheetId || <span className="text-rose-300">non configuré</span>}
                </p>
              </div>
            )}

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 text-amber-300" />
                <p className="text-xs text-amber-100/90">
                  Le calcul des commissions reste piloté par Apps Script côté
                  Google Sheets. Cette interface ne fait que lire et faire
                  évoluer les statuts.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Règles de commission */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Règles de commission</CardTitle>
            <span className="text-xs text-ink-300/70">
              Source : lib/commissions.ts
            </span>
          </CardHeader>
          <CardBody className="space-y-8">
            {/* Produit one-shot */}
            <section>
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <h3 className="font-display text-lg text-ink-100">
                  Coffret signature
                </h3>
                <span className="text-sm text-ink-300">
                  Vente unique · prix : <span className="text-gold-400">{formatEUR(r.produit_176.prix)}</span>
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Row label="Commission vendeur" value={formatEUR(r.produit_176.commission_vendeur)} />
                <Row
                  label={`Commission manager (${(r.produit_176.taux_manager * 100).toFixed(0)} % du vendeur)`}
                  value={formatEUR(manager176)}
                />
              </div>
            </section>

            <div className="h-px bg-gold-400/10" />

            {/* Abonnement */}
            <section>
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <h3 className="font-display text-lg text-ink-100">
                  Abonnement Forêt
                </h3>
                <span className="text-sm text-ink-300">
                  Récurrent mensuel · prix : <span className="text-gold-400">{formatEUR(r.abonnement_990.prix)}</span>
                </span>
              </div>

              <div className="space-y-3">
                {r.abonnement_990.paliers.map((p) => {
                  const mgr = p.commission_vendeur * p.taux_manager;
                  return (
                    <div
                      key={p.label}
                      className={`rounded-xl border p-4 ${
                        p.actif
                          ? "border-gold-400/15 bg-forest-900/40"
                          : "border-ink-300/10 bg-forest-900/20 opacity-70"
                      }`}
                    >
                      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-medium text-ink-100">{p.label}</p>
                        <Badge tone={p.actif ? "gold" : "muted"}>
                          {p.actif ? "Actif" : "Prévu — non automatisé"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Row label="Vendeur" value={formatEUR(p.commission_vendeur)} compact />
                        <Row
                          label={`Manager (${(p.taux_manager * 100).toFixed(0)} %)`}
                          value={formatEUR(mgr)}
                          compact
                        />
                        <Row
                          label="Déclenchement"
                          value={
                            p.delai_jours === null
                              ? "Mensuel tant que actif"
                              : `J+${p.delai_jours}`
                          }
                          compact
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg border border-gold-400/10 bg-forest-900/40 px-4 py-3 text-xs text-ink-300">
                Les paliers J+60 et le récurrent mensuel sont prévus dans le
                modèle de données mais ne sont pas encore générés
                automatiquement. Ils s'activeront depuis Apps Script sans
                modification de cette interface.
              </div>
            </section>
          </CardBody>
        </Card>
      </div>
    </AdminShell>
  );
}

function Row({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-gold-400/10 bg-forest-900/40 px-4 ${
        compact ? "py-2" : "py-3"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-ink-300/70">
        {label}
      </p>
      <p className="mt-1 font-display text-lg text-gold-400">{value}</p>
    </div>
  );
}
