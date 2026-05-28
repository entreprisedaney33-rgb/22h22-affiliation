import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "22h22 Affiliation",
  description: "Plateforme privée d'affiliation 22h22 — vendeurs, managers, administration.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
