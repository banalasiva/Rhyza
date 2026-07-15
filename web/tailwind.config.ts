import type { Config } from "tailwindcss";

// Design tokens carried over from the prototype (docs/DESIGN_HANDOFF.md).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Wired to CSS variables so the whole palette can switch (dark ⇄ light)
        // by re-defining the variables under `html.light` in globals.css.
        bg: "var(--bg)",
        "bg-mid": "var(--bg-mid)",
        "bg-surface": "var(--bg-surface)",
        ink: "var(--ink)",
        "ink-mid": "var(--ink-mid)",
        "ink-soft": "var(--ink-soft)",
        "ink-muted": "var(--ink-muted)",
        accent: "var(--accent)",
        "accent-bright": "var(--accent-bright)",
        bloom: "var(--bloom)",
        seed: "var(--seed)",
      },
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
    },
  },
  plugins: [],
};

export default config;
