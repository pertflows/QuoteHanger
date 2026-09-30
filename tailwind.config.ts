import type { Config } from "tailwindcss";

// Palette carried over from prototype.html. Single night theme on purpose:
// this is a tool for seeing lights after dark.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0c1220",
        panel: "#141c2c",
        raise: "#1b2539",
        line: "#2a3650",
        fg: "#e9edf5",
        muted: "#93a0b8",
        bulb: "#ffc66e",
        "bulb-ink": "#2a1a00",
        ok: "#72d6a4",
        warn: "#f3a95c",
        stage: "#05080f",
      },
      fontFamily: {
        display: ["var(--f-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--f-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--f-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
