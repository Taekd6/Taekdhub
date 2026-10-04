import { describe, expect, it } from "vitest";
import type { AppAlert } from "@/lib/alerts";
import { planPush } from "@/lib/push-plan";

const at = (hour: number, day = 5) => new Date(2026, 9, day, hour, 0);

const alert = (id: string, level: AppAlert["level"]): AppAlert => ({ id: `${id}:2026-10-05`, level, title: `Titre ${id}`, body: `Corps ${id}.`, href: `/${id}`, action: "Go" });

describe("planPush — une notification utile, jamais une rafale", () => {
  it("envoie la plus importante, dit combien d'autres attendent, et la retient", () => {
    const plan = planPush([alert("echeance:w1", "urgent"), alert("soir", "attention"), alert("revoir", "info")], {}, at(18));
    expect(plan.notification).toEqual({ title: "Titre echeance:w1", body: "Corps echeance:w1. (+ 1 autre dans TaekdHub)", url: "/echeance:w1", tag: "echeance:w1" });
    expect(Object.keys(plan.sent)).toEqual(["echeance:w1:2026-10-05"]);
  });

  it("jamais deux fois la même : au passage suivant, la suivante", () => {
    const alerts = [alert("echeance:w1", "urgent"), alert("soir", "attention")];
    const first = planPush(alerts, {}, at(18));
    const second = planPush(alerts, first.sent, at(19));
    expect(second.notification?.title).toBe("Titre soir");
    expect(planPush(alerts, second.sent, at(20)).notification).toBeNull();
  });

  it("une simple info ne sonne pas", () => {
    expect(planPush([alert("revoir", "info")], {}, at(18)).notification).toBeNull();
  });

  it("rien la nuit, de 22 h à 8 h", () => {
    const alerts = [alert("echeance:w1", "urgent")];
    expect(planPush(alerts, {}, at(22)).notification).toBeNull();
    expect(planPush(alerts, {}, at(7)).notification).toBeNull();
    expect(planPush(alerts, {}, at(8)).notification).not.toBeNull();
  });

  it("oublie les envois des jours précédents", () => {
    const old = { "echeance:w1:2026-10-04": "2026-10-04T10:00:00.000Z" };
    expect(planPush([], old, at(10)).sent).toEqual({});
  });
});
