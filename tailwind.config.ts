import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette 22h22 — forêt profonde, nuit, or sourd
        forest: {
          50:  "#f3f6f3",
          100: "#e3ebe3",
          200: "#c6d5c6",
          300: "#9bb69b",
          400: "#6b8f6b",
          500: "#4a724a",
          600: "#385a38",
          700: "#2c482c",
          800: "#243a24",
          900: "#1b2c1b",
          950: "#0e180e",
        },
        ink: {
          50:  "#f5f5f4",
          100: "#e7e5e2",
          200: "#cbc7c1",
          300: "#a8a299",
          400: "#857d72",
          500: "#6a6359",
          600: "#544e46",
          700: "#3f3a34",
          800: "#2a2622",
          900: "#1a1815",
          950: "#0d0c0a",
        },
        gold: {
          400: "#d4b876",
          500: "#b89858",
          600: "#967641",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(13,12,10,0.04), 0 4px 12px rgba(13,12,10,0.04)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(13,12,10,0.18)",
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
