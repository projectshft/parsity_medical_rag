import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        copilot: {
          bg: "#1e1e1e",
          sidebar: "#252526",
          input: "#3c3c3c",
          border: "#404040",
          accent: "#0078d4",
          text: "#cccccc",
          muted: "#808080",
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;
