import { ReactNode } from "react";
import AppShell from "./AppShell";
import type { SessionUser } from "@/lib/types";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Settings,
} from "lucide-react";

const ADMIN_NAV = [
  { href: "/admin", label: "Tableau de bord", icon: <LayoutDashboard size={14} /> },
  { href: "/admin/commerciaux", label: "Commerciaux", icon: <Users size={14} /> },
  { href: "/admin/commissions", label: "Commissions", icon: <Receipt size={14} /> },
  { href: "/admin/parametres", label: "Paramètres", icon: <Settings size={14} /> },
];

export default function AdminShell({
  user,
  current,
  children,
}: {
  user: SessionUser;
  current: string;
  children: ReactNode;
}) {
  return (
    <AppShell user={user} nav={ADMIN_NAV} current={current}>
      {children}
    </AppShell>
  );
}
