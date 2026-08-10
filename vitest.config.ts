import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Config minimale : seule la logique pure de lib/ est testée ici (voir
 * lib/recommendation.test.ts), pas les composants React — pas besoin
 * d'environnement DOM. L'alias `@/*` reprend celui de tsconfig.json.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
