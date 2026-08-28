import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const config = [
  // `scripts/**` (outil de build Node, pas du code applicatif) et
  // `service-worker/**` (tourne dans le contexte global d'un service worker
  // — `self`, `caches`, `clients` — pas dans le navigateur ni React : les
  // règles Next/React n'ont pas de sens ici).
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "scripts/**", "service-worker/**", "public/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
