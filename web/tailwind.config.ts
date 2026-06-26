import type { Config } from "tailwindcss";

// Design tokens carried over from the prototype (docs/DESIGN_HANDOFF.md).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#070D07",
        "bg-mid": "#0D160D",
        "bg-surface": "#111A11",
        ink: "#E8E4DC",
        "ink-mid": "#A0A890",
        "ink-soft": "#5A6456",
        "ink-muted": "#3A4438",
        accent: "#4CAF50",
        "accent-bright": "#66BB6A",
        bloom: "#FFB300",
        seed: "#8D6E63",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderColor: {
        DEFAULT: "rgba(76,175,80,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
