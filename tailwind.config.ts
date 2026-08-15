import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      colors: {
        "surface-canvas": "#F8F6F0",
        "surface-card": "#FFFFFF",
        "surface-muted": "#EFECE4",
        "border-subtle": "#E4DFD5",
        "border-focus": "#1A1816",
        "text-primary": "#1A1816",
        "text-secondary": "#635E59",
        "text-tertiary": "#9B948C",
        "accent-primary": "#C85A2A",
        "accent-hover": "#AD4B20",
        "accent-subtle": "#F8EFEB",
        "badge-live": "#2D6A4F",
        "badge-alert": "#B93826",
        "kds-canvas": "#141211",
        "kds-surface": "#1E1B19",
        "kds-border": "#2E2A27",
        "kds-text-primary": "#F8F6F0",
        "kds-text-secondary": "#A39C94",
      },
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "serif"],
        sans: ["var(--font-plus-jakarta-sans)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(26, 24, 22, 0.04), 0 6px 16px rgba(26, 24, 22, 0.03)",
        float: "0 8px 30px rgba(26, 24, 22, 0.08)",
      },
    },
  },
} satisfies Config;
