import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Config minimale : seule la logique pure de lib/ est testée ici (voir
 * lib/storage.test.ts), pas les composants React — pas besoin
 * d'environnement DOM. L'alias `@/*` reprend celui de tsconfig.json.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // `.claude/worktrees/` héberge les copies de travail des agents Claude
    // Code : leurs tests appartiennent à un autre état du dépôt.
    exclude: ["**/node_modules/**", ".claude/**"],
  },
});
