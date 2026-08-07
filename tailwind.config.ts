import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#09090b",
        panel: "#121214",
        elevated: "#18181b",
        line: "#27272a",
        ink: "#f4f4f5",
        muted: "#a1a1aa",
        subtle: "#71717a",
        accent: {
          DEFAULT: "#d4f36b",
          dim: "rgba(212,243,107,0.12)",
          glow: "rgba(212,243,107,0.25)",
        },
      },
      borderRadius: {
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        surface: "0 12px 34px rgba(0,0,0,.16)",
        glow: "0 0 22px rgba(212,243,107,.18)",
        card: "0 1px 0 rgba(255,255,255,.04) inset, 0 12px 34px rgba(0,0,0,.16)",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      animation: {
        "fade-in": "fadeIn .4s ease-out",
        "slide-up": "slideUp .4s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
