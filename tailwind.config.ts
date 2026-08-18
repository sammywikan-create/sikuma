import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        bkk: {
          50: "#eef7ff",
          100: "#d9ecff",
          200: "#bcdeff",
          300: "#8eccff",
          400: "#57aeff",
          500: "#2d8aff",
          600: "#1669f5",
          700: "#1052e1",
          800: "#1342b6",
          900: "#153a8f",
          950: "#112457",
        },
      },
    },
  },
  plugins: [],
};
export default config;
