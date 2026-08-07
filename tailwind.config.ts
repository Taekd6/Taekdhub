import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { colors: { canvas: "#0a0a0b", panel: "#121214", line: "#27272a", ink: "#f4f4f5", muted: "#a1a1aa", accent: "#d4f36b" } } }, plugins: [] } satisfies Config;
