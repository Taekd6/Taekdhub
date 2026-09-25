import { describe, expect, it } from "vitest";
import {
  buildErrorInsight,
  canSendToReview,
  computeErrorTrend,
  countBySubject,
  countByType,
  createErrorEntry,
  dominantType,
  ERROR_INSIGHT_MIN,
  ERROR_TEXT_MAX,
  errorLogHref,
  filterErrors,
  groupErrorsByRecency,
  linkReviewItem,
  parseErrorMemory,
  parseErrorPrefill,
  periodBounds,
  removeErrorEntry,
  reviewInputFromError,
  sourceForGradeKind,
  topType,
} from "@/lib/error-log";
import { REVIEW_TEXT_MAX, createReviewItem } from "@/lib/review-items";
import type { ErrorEntry, ErrorType } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/** Mercredi 23 septembre 2026, midi, heure locale. */
const now = new Date(2026, 8, 23, 12, 0);

let seq = 0;
function entry(overrides: Partial<ErrorEntry> = {}): ErrorEntry {
  seq += 1;
  return {
    id: `e-${seq}`,
    subject: "Physique",
    date: "2026-09-20",
    source: "colle",
    type: "calcul",
    description: "Signe oublié",
    fix: null,
    chapterId: null,
    exerciseId: null,
    reviewItemId: null,
    createdAt: `2026-09-20T18:00:${String(seq % 60).padStart(2, "0")}.000Z`,
    ...overrides,
  };
}

function many(count: number, type: ErrorType, subject: Subject = "Physique", date = "2026-09-20"): ErrorEntry[] {
  return Array.from({ length: count }, () => entry({ type, subject, date }));
}

describe("createErrorEntry — dix secondes, pas de donnée inventée", () => {
  it("date du jour par défaut, bonne idée facultative, renvois nuls", () => {
    const created = createErrorEntry({ subject: "Chimie", source: "DS", type: "lecture", description: "  Unité   oubliée " }, now);
    expect(created).toMatchObject({ subject: "Chimie", date: "2026-09-23", description: "Unité oubliée", fix: null, chapterId: null, exerciseId: null, reviewItemId: null });
  });

  it("garde la date de l'épreuve quand elle est donnée", () => {
    expect(createErrorEntry({ subject: "Chimie", source: "DS", type: "lecture", description: "x", date: "2026-09-18" }, now)?.date).toBe("2026-09-18");
  });

  it("refuse une description vide ou trop longue plutôt que de la couper", () => {
    expect(createErrorEntry({ subject: "Chimie", source: "DS", type: "lecture", description: "   " }, now)).toBeNull();
    expect(createErrorEntry({ subject: "Chimie", source: "DS", type: "lecture", description: "a".repeat(ERROR_TEXT_MAX + 1) }, now)).toBeNull();
    expect(createErrorEntry({ subject: "Chimie", source: "DS", type: "lecture", description: "ok", fix: "b".repeat(ERROR_TEXT_MAX + 1) }, now)).toBeNull();
  });

  it("une suppression retire exactement une ligne", () => {
    const list = [entry({ id: "a" }), entry({ id: "b" })];
    expect(removeErrorEntry(list, "a").map((item) => item.id)).toEqual(["b"]);
  });
});

describe("comptes par type et par matière", () => {
  it("tous les types figurent, même à zéro, triés du plus fréquent", () => {
    const counts = countByType([...many(3, "calcul"), ...many(1, "cours", "Mathématiques")]);
    expect(counts).toHaveLength(6);
    expect(counts[0]).toMatchObject({ type: "calcul", count: 3, bySubject: [{ subject: "Physique", count: 3 }] });
    expect(counts[1]).toMatchObject({ type: "cours", count: 1 });
    expect(counts.slice(2).every((row) => row.count === 0)).toBe(true);
  });

  it("pas de n°1 à égalité, ni sur une liste vide", () => {
    expect(topType([])).toBeNull();
    expect(topType([...many(2, "calcul"), ...many(2, "lecture")])).toBeNull();
    expect(topType([...many(3, "calcul"), ...many(2, "lecture")])).toEqual({ type: "calcul", count: 3, total: 5 });
  });

  it("par matière : le type dominant n'est désigné qu'à partir du seuil", () => {
    const rows = countBySubject([...many(ERROR_INSIGHT_MIN, "calcul", "Physique"), ...many(2, "cours", "Mathématiques")]);
    expect(rows.map((row) => row.subject)).toEqual(["Physique", "Mathématiques"]);
    expect(rows[0].top).toBe("calcul");
    expect(rows[1].top).toBeNull();
    expect(rows[1].byType.cours).toBe(2);
  });

  it("dominantType se tait sous le seuil", () => {
    expect(dominantType(many(ERROR_INSIGHT_MIN - 1, "calcul"))).toBeNull();
    expect(dominantType(many(ERROR_INSIGHT_MIN, "calcul"))).toBe("calcul");
  });

  it("filtre par matière et par type", () => {
    const list = [entry({ subject: "Chimie", type: "temps" }), entry({ subject: "Chimie", type: "calcul" }), entry({ subject: "Physique", type: "temps" })];
    expect(filterErrors(list, { subject: "Chimie", type: "temps" })).toHaveLength(1);
    expect(filterErrors(list, { subject: null, type: "temps" })).toHaveLength(2);
  });
});

describe("périodes et tendance — 30 jours glissants contre les 30 d'avant", () => {
  it("les fenêtres se suivent sans chevauchement", () => {
    expect(periodBounds(now)).toEqual({ from: "2026-08-25", to: "2026-09-23" });
    expect(periodBounds(now, 30, 1)).toEqual({ from: "2026-07-26", to: "2026-08-24" });
  });

  it("insuffisant quand une fenêtre est vide — un carnet qui commence n'est pas « en hausse »", () => {
    expect(computeErrorTrend(many(8, "calcul"), now).direction).toBe("insuffisant");
  });

  it("hausse, baisse, stable", () => {
    const before = (count: number) => many(count, "calcul", "Physique", "2026-08-10");
    const recent = (count: number) => many(count, "calcul", "Physique", "2026-09-10");
    expect(computeErrorTrend([...before(4), ...recent(9)], now)).toEqual({ recent: 9, previous: 4, direction: "hausse" });
    expect(computeErrorTrend([...before(9), ...recent(3)], now).direction).toBe("baisse");
    expect(computeErrorTrend([...before(6), ...recent(7)], now).direction).toBe("stable");
  });
});

describe("le constat — « ton erreur n°1 en physique ce mois-ci »", () => {
  it("formule la phrase avec le compte ET le total", () => {
    const insight = buildErrorInsight([...many(6, "calcul"), ...many(3, "lecture")], now);
    expect(insight?.text).toBe("Ton erreur n°1 en physique ce mois-ci : calcul (6 sur 9).");
  });

  it("se tait sous le seuil — honnêteté avant tout", () => {
    expect(buildErrorInsight(many(ERROR_INSIGHT_MIN - 1, "calcul"), now)).toBeNull();
  });

  it("se tait en cas d'égalité en tête", () => {
    expect(buildErrorInsight([...many(3, "calcul"), ...many(3, "lecture")], now)).toBeNull();
  });

  it("ignore ce qui est hors des 30 derniers jours", () => {
    expect(buildErrorInsight(many(10, "calcul", "Physique", "2026-07-01"), now)).toBeNull();
  });

  it("vise la matière la plus fournie, ou celle demandée", () => {
    const list = [...many(6, "calcul", "Physique"), ...many(5, "cours", "Mathématiques")];
    expect(buildErrorInsight(list, now)?.subject).toBe("Physique");
    expect(buildErrorInsight(list, now, "Mathématiques")?.text).toBe("Ton erreur n°1 en mathématiques ce mois-ci : cours (5 sur 5).");
    expect(buildErrorInsight(list, now, "Chimie")).toBeNull();
  });
});

describe("liste par récence", () => {
  it("quatre paquets, les vides disparaissent, plus récent d'abord", () => {
    const groups = groupErrorsByRecency(
      [
        entry({ id: "old", date: "2026-06-01" }),
        entry({ id: "today", date: "2026-09-23" }),
        entry({ id: "week", date: "2026-09-18" }),
        entry({ id: "week2", date: "2026-09-21" }),
      ],
      now
    );
    expect(groups.map((group) => group.key)).toEqual(["today", "week", "older"]);
    expect(groups[1].entries.map((item) => item.id)).toEqual(["week2", "week"]);
  });
});

describe("passerelles", () => {
  it("nature de note → source, sans déguiser une interro en DS", () => {
    expect(sourceForGradeKind("ds")).toBe("DS");
    expect(sourceForGradeKind("concours")).toBe("concours blanc");
    expect(sourceForGradeKind("interro")).toBe("autre");
  });

  it("pré-remplissage par l'URL : les valeurs inconnues sont ignorées", () => {
    expect(parseErrorPrefill("?source=DS&subject=Physique&date=2026-09-20")).toEqual({ source: "DS", subject: "Physique", date: "2026-09-20" });
    expect(parseErrorPrefill("?source=QCM&subject=Latin&date=demain")).toEqual({});
    expect(parseErrorPrefill(errorLogHref({ subject: "Informatique TC", source: "concours blanc" }).split("?")[1])).toEqual({
      subject: "Informatique TC",
      source: "concours blanc",
    });
    expect(errorLogHref()).toBe("/erreurs");
  });

  it("mémoire de saisie : tolère un contenu corrompu", () => {
    expect(parseErrorMemory(JSON.stringify({ subject: "Chimie", source: "DM" }))).toEqual({ subject: "Chimie", source: "DM" });
    expect(parseErrorMemory("{pas du json")).toEqual({ subject: null, source: null });
    expect(parseErrorMemory(null)).toEqual({ subject: null, source: null });
  });

  it("erreur de cours → entrée « à apprendre » valide, même sur un texte long", () => {
    const input = reviewInputFromError(entry({ type: "cours", subject: "Mathématiques", description: "d".repeat(150), fix: "f".repeat(150) }));
    expect(input.kind).toBe("à apprendre");
    expect(input.text.length).toBeLessThanOrEqual(REVIEW_TEXT_MAX);
    expect(createReviewItem(input, now)).not.toBeNull();
    expect(reviewInputFromError(entry({ description: "Déf. uniforme continuité", fix: "∀ε ∃η…" })).text).toBe("Déf. uniforme continuité → ∀ε ∃η…");
  });

  it("n'offre pas deux fois l'ajout au carnet, sauf si l'entrée a été supprimée depuis", () => {
    const list = linkReviewItem([entry({ id: "x" })], "x", "r-1");
    expect(list[0].reviewItemId).toBe("r-1");
    const review = [{ id: "r-1", subject: "Physique" as const, text: "t", kind: "à apprendre" as const, createdAt: now.toISOString(), doneAt: null }];
    expect(canSendToReview(list[0], review)).toBe(false);
    expect(canSendToReview(list[0], [])).toBe(true);
  });
});
