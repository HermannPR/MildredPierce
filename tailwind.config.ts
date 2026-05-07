import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "wine": "#3d0a0f",
        "wine-deep": "#2a0608",
        "burgundy": "#7a1b2a",
        "burgundy-light": "#9b2335",
        "fabric": "#4a0e15",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
