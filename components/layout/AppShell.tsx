import { ReactNode } from "react";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import type { SessionUser } from "@/lib/types";
import { LogOut } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon?: ReactNode;
}

export default function AppShell({
  user,
  nav,
  current,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  current: string;
  children: ReactNode;
}) {
  const initiale = `${user.prenom[0] || ""}${user.nom[0] || ""}`.toUpperCase();

  return (
    <div className="relative z-10 min-h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-gold-400/10 bg-forest-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Accueil">
            <Logo />
          </Link>

          {/* Nav (desktop) */}
          <nav className="hidden gap-1 md:flex">
            {nav.map((item) => {
              const active = current === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-gold-400/15 text-gold-400"
                      : "text-ink-300 hover:bg-forest-700/40 hover:text-ink-100"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end leading-tight sm:flex">
              <span className="text-sm text-ink-100">
                {user.prenom} {user.nom}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-ink-300/70">
                {user.role === "admin"
                  ? "Administrateur"
                  : user.role === "manager"
                  ? "Manager"
                  : "Commercial"}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-400/30 bg-gold-400/10 text-xs font-medium text-gold-400">
              {initiale}
            </div>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                aria-label="Se déconnecter"
                className="rounded-full border border-gold-400/15 p-2 text-ink-300 transition-colors hover:bg-forest-700/40 hover:text-ink-100"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* Nav (mobile) */}
        <nav className="flex gap-1 overflow-x-auto border-t border-gold-400/5 px-4 py-2 md:hidden">
          {nav.map((item) => {
            const active = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-gold-400/15 text-gold-400"
                    : "text-ink-300"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-ink-300/50 sm:px-6 lg:px-8">
        22h22 Affiliation · Interface privée · ne pas diffuser
      </footer>
    </div>
  );
}
