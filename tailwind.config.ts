import type { Config } from "tailwindcss";

// Discord-like dark theme tokens (server rail → channel sidebar → chat pane → member list)
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral surfaces, darkest → lightest
        rail: "#1e1f22", // server rail (far left)
        sidebar: "#2b2d31", // channel sidebar / member list
        chat: "#313338", // main chat pane
        elevated: "#383a40", // hovered/elevated surfaces
        accent: "#5865f2", // brand blurple
        "accent-hover": "#4752c4",
        online: "#23a55a",
        offline: "#80848e",
        danger: "#da373c",
        "text-normal": "#dbdee1",
        "text-muted": "#949ba4",
      },
    },
  },
  plugins: [],
} satisfies Config;
