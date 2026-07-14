import type { Config } from "tailwindcss";

// Modern dark theme tokens (server rail → channel sidebar → chat pane → member list).
// Deep blue-black surfaces with a vivid indigo/violet accent, used consistently
// across every component — changing these values re-themes the whole app.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral surfaces, darkest → lightest
        rail: "#0b0c14", // server rail (far left)
        sidebar: "#12141d", // channel sidebar / member list
        chat: "#171923", // main chat pane
        elevated: "#20222e", // hovered/elevated surfaces, modals
        accent: "#6d5efc", // vivid indigo-violet
        "accent-hover": "#5b4fe0",
        "accent-2": "#22d3ee", // cyan companion, used in gradients/highlights
        online: "#2dd4a7",
        offline: "#5b6272",
        danger: "#fb5477",
        "text-normal": "#eef0f5",
        "text-muted": "#8b91a3",
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #6d5efc 0%, #8b5cf6 55%, #22d3ee 150%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(109,94,252,0.35), 0 6px 24px -6px rgba(109,94,252,0.45)",
        soft: "0 12px 36px -12px rgba(0,0,0,0.65)",
      },
    },
  },
  plugins: [],
} satisfies Config;
