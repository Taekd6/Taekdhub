import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Par défaut, environnement Node : l'essentiel des tests porte sur la logique
 * pure de lib/. Un test qui a besoin d'un navigateur simulé (hooks,
 * composants) le déclare lui-même en première ligne :
 * `// @vitest-environment jsdom` (voir hooks/use-prepahub-data.test.tsx).
 * L'alias `@/*` reprend celui de tsconfig.json.
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
    // `pnpm test:coverage` : part des lignes de lib/ et hooks/ exécutées par les tests.
    coverage: { include: ["lib/**", "hooks/**"], exclude: ["**/*.test.*"], reporter: ["text-summary", "text"] },
  },
});
