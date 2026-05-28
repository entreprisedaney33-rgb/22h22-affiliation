import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Logo from "@/components/ui/Logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
      {/* Décor — silhouettes d'arbres en filigrane */}
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 w-full opacity-[0.08]"
        viewBox="0 0 1440 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M0 200 L60 80 L120 200 M120 200 L180 50 L240 200 M240 200 L300 100 L360 200 M360 200 L440 30 L520 200 M520 200 L600 90 L680 200 M680 200 L760 60 L840 200 M840 200 L920 110 L1000 200 M1000 200 L1080 40 L1160 200 M1160 200 L1240 95 L1320 200 M1320 200 L1380 70 L1440 200"
          stroke="rgb(212, 184, 118)"
          strokeWidth="1"
        />
      </svg>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Logo size={44} />
        </div>

        <div className="rounded-3xl border border-gold-400/15 bg-forest-900/60 p-8 shadow-card backdrop-blur-xl sm:p-10">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-gold-400/80">
              Plateforme privée
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-100">
              Connexion
            </h1>
            <p className="mt-2 text-sm text-ink-300/80">
              Accédez à votre espace d'affiliation.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {error === "invalid"
                ? "Identifiants incorrects, ou compte inactif."
                : "Veuillez renseigner votre email et votre mot de passe."}
            </div>
          )}

          <form action="/api/auth/login" method="POST" className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium uppercase tracking-wider text-ink-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="vous@22h22foret.fr"
                className="w-full rounded-lg border border-gold-400/15 bg-forest-950/60 px-3.5 py-3 text-sm text-ink-100 placeholder:text-ink-300/40 focus:border-gold-400/40 focus:outline-none focus:ring-1 focus:ring-gold-400/30"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-wider text-ink-300"
              >
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-gold-400/15 bg-forest-950/60 px-3.5 py-3 text-sm text-ink-100 placeholder:text-ink-300/40 focus:border-gold-400/40 focus:outline-none focus:ring-1 focus:ring-gold-400/30"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-full bg-gold-400 px-4 py-3 text-sm font-medium text-forest-950 transition-colors hover:bg-gold-500 active:bg-gold-600"
            >
              Se connecter
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-300/50">
          © {new Date().getFullYear()} 22h22 forêt · Tous droits réservés
        </p>
      </div>
    </div>
  );
}
