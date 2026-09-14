import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Seule la logique PURE est testée ici (`lib/domain`, `lib/store`, `lib/agent`) :
 * pas d'environnement DOM, donc des tests qui s'exécutent en une seconde et
 * qu'on lance à chaque changement. L'alias `@/*` reprend celui de tsconfig.json.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
