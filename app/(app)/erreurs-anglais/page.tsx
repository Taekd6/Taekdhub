import { ErreursAnglais } from "@/components/erreurs-anglais/erreurs-anglais";

export const metadata = { title: "Mes erreurs d'anglais — TaekdHub" };

/**
 * Mes erreurs de thème (concours CCMP), par catégorie, avec un mode révision
 * (lib/erreurs-anglais.ts). Le contenu vient de data/erreurs-anglais.json.
 * Atteint depuis la colonne latérale et depuis le carnet d'erreurs (/erreurs).
 */
export default function ErreursAnglaisPage() {
  return <ErreursAnglais />;
}
