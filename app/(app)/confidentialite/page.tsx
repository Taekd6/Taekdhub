import Link from "next/link";
import { Section } from "@/components/ui/section";

export const metadata = { title: "Confidentialité — TaekdHub" };

/**
 * CONFIDENTIALITÉ — ce que TaekdHub garde, où, et comment tout effacer.
 *
 * Rédigé d'après le fonctionnement réel du code (stockage local, table
 * `user_collections`, route de suppression). PROJET : à faire relire par une
 * personne compétente, et à compléter (éditeur, contact, durées légales)
 * avant toute ouverture au public.
 */
export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-[44rem] space-y-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Confidentialité</h1>
        <p className="t-body mt-2">Ce que TaekdHub enregistre, où ça va, et comment tout effacer.</p>
      </header>

      <Section variant="panel" title="Ce qui est enregistré">
        <ul className="t-body list-disc space-y-1.5 pl-5">
          <li>Tes séances de travail, tes échéances, tes notes et tes exercices.</li>
          <li>Ton avancement dans le programme, tes cartes de révision et tes erreurs.</li>
          <li>
            Si tu les remplis, ton <strong>check-in du soir</strong> : sommeil, énergie et stress. Ce sont des données de santé déclarées par
            toi : elles ne servent qu&apos;à adapter ton plan, jamais à poser un diagnostic.
          </li>
          <li>Tes réglages (objectifs, thème, préférences).</li>
        </ul>
      </Section>

      <Section variant="panel" title="Où elles sont">
        <p className="t-body">
          Sans compte, tout reste dans ton navigateur, sur cet appareil. Avec un compte, une copie est gardée chez Supabase (base de données) pour la
          retrouver sur tes autres appareils ; l&apos;application est servie par Vercel. Chaque compte ne peut lire que ses propres données.
        </p>
      </Section>

      <Section variant="panel" title="Ce que TaekdHub ne fait pas">
        <ul className="t-body list-disc space-y-1.5 pl-5">
          <li>Aucune publicité, aucune revente de données (engagement à confirmer avant publication).</li>
        </ul>
      </Section>

      <Section variant="panel" title="Tes droits">
        <p className="t-body">
          Tu peux à tout moment <strong>exporter</strong> tes données (sauvegarde, dans Réglages), les <strong>corriger</strong> dans l&apos;application,
          et <strong>supprimer ton compte</strong> : toutes les copies en ligne sont alors effacées. Les données de cet appareil se retirent avec
          « Déconnecter et effacer cet appareil ».
        </p>
        <p className="t-meta mt-3">
          <Link href="/settings#compte" className="font-semibold text-accent underline-offset-2 hover:underline">
            Ouvrir mon compte dans les Réglages
          </Link>
        </p>
      </Section>
    </div>
  );
}
