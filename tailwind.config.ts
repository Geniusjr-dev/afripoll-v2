import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blue: { DEFAULT: "#0B4DA2", deep: "#083B7D", soft: "#E7EFF9" },
        lime: { DEFAULT: "#8DC63F", deep: "#6FA82C", soft: "#EEF6E2" },
        ink: { DEFAULT: "#0B2647", 2: "#12263F" },
        paper: "#F5F7FA",
        surface: "#FFFFFF",
        well: "#F0F3F7",
        line: { DEFAULT: "#E2E8F0", 2: "#EEF2F6" },
        muted: { DEFAULT: "#5A6B7B", 2: "#94A3B4" },
        sidebar: { DEFAULT: "#0B2647", hover: "#123A63", active: "#0e60b0" },
        signal: "#D64545",
        gold: "#E0A32E",
      },
      fontFamily: {
        display: ["var(--font-poppins)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,38,71,.04), 0 12px 32px -16px rgba(11,38,71,.18)",
      },
      borderRadius: { xl2: "16px" },
    },
  },
  plugins: [],
};
export default config;
