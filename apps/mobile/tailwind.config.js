/** @type {import('tailwindcss').Config} */
module.exports = {
  // Only scan mobile source; never scan apps/web (would pull web-only classes).
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Mirrors DESIGN.md (dark-first). Keep in sync with src/styles/theme.ts.
        background: "#0a0a0f",
        foreground: "#f0f0fa",
        card: "#171721",
        "card-foreground": "#f0f0fa",
        primary: "#f0f0fa",
        "primary-foreground": "#0a0a0f",
        muted: "rgba(240,240,250,0.06)",
        "muted-foreground": "rgba(240,240,250,0.65)",
        destructive: "#ff5b4f",
        success: "#22c55e",
        "success-foreground": "#0a0a0f",
        warning: "#f97316",
        "warning-foreground": "#0a0a0f",
        border: "rgba(240,240,250,0.10)",
        ring: "rgba(240,240,250,0.30)",
      },
      fontFamily: {
        sans: ["D-DIN", "Arial", "Verdana", "sans-serif"],
        mono: ["D-DIN", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
