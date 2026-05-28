/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Force Cache-Control: no-store sur toutes les pages dashboard et
  // les routes API. Double sécurité par rapport à `export const
  // dynamic = "force-dynamic"` dans les pages — utile notamment si
  // Vercel décide quand même de mettre une réponse en bordure de CDN.
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/manager/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/commercial/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
