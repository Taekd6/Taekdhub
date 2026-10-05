import { describe, expect, it } from "vitest";
import { isAppleMobile, pushSupport, vapidKeyBytes } from "@/lib/push-client";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const full = { hasPushManager: true, hasNotification: true, hasServiceWorker: true };

describe("pushSupport — l'appareil peut-il recevoir des notifications ?", () => {
  it("iPhone dans Safari : il faut d'abord installer l'app sur l'écran d'accueil", () => {
    expect(pushSupport({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false, ...full })).toBe("installer");
    expect(pushSupport({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true, ...full })).toBe("ok");
  });

  it("un iPad qui se présente comme un Mac est reconnu à son écran tactile", () => {
    expect(isAppleMobile(MAC, 5)).toBe(true);
    expect(isAppleMobile(MAC, 0)).toBe(false);
  });

  it("ordinateur : oui si le navigateur sait faire, non sinon", () => {
    expect(pushSupport({ userAgent: MAC, maxTouchPoints: 0, standalone: false, ...full })).toBe("ok");
    expect(pushSupport({ userAgent: MAC, maxTouchPoints: 0, standalone: false, ...full, hasPushManager: false })).toBe("non");
  });
});

describe("vapidKeyBytes", () => {
  it("décode le base64 « url » sans remplissage", () => {
    expect([...vapidKeyBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});
