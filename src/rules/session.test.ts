import { describe, expect, it } from "vitest";
import {
  DRIFT,
  HEARD_AT,
  LISTEN_TRUST,
  STEADY,
  isMended,
  isNeedHeard,
  playRound,
  startSession,
  type Session,
} from "./session";

const fiddle = (): Session =>
  startSession("a fiddle with a lifted bridge", "slack the strings before you move the bridge", 60, true);

describe("a Session", () => {
  it("gets a little worse each round if nobody mends it", () => {
    const after = playRound(fiddle(), { fibonacci: "listen" });
    expect(after.discord).toBe(60 + DRIFT);
  });

  it("tells you what it needs once you've listened enough", () => {
    let s = fiddle();
    expect(isNeedHeard(s)).toBe(false);
    for (let i = 0; i < HEARD_AT / LISTEN_TRUST; i++) s = playRound(s, { fibonacci: "listen" });
    expect(isNeedHeard(s)).toBe(true);
  });

  it("rewards listening before tuning", () => {
    const cold = playRound(fiddle(), { justin: "tune" });
    const warmed = playRound(playRound(playRound(fiddle(), { justin: "listen" }), { justin: "listen" }), {
      justin: "tune",
    });
    const coldProgress = 60 - cold.discord;
    const warmProgress = 60 + 2 * DRIFT - warmed.discord;
    expect(warmProgress).toBeGreaterThan(coldProgress);
  });

  it("can be steadied alone, but not finished alone, when it needs a band", () => {
    let s = fiddle();
    for (let i = 0; i < 5; i++) s = playRound(s, { fibonacci: "listen" });
    for (let i = 0; i < 50; i++) s = playRound(s, { fibonacci: "tune" });
    expect(s.discord).toBe(STEADY);
    expect(isMended(s)).toBe(false);
  });

  it("is mended by a band, and remembers who played", () => {
    let s = fiddle();
    s = playRound(s, { fibonacci: "listen", justin: "listen" });
    for (let i = 0; i < 10 && !isMended(s); i++) s = playRound(s, { fibonacci: "takeBreak", justin: "backUp" });
    expect(isMended(s)).toBe(true);
    expect(s.mendedBy).toEqual(["fibonacci", "justin"]);
  });

  it("costs trust to take a break with nobody backing you", () => {
    const s = playRound(playRound(fiddle(), { skyler: "listen" }), { skyler: "takeBreak" });
    expect(s.trust).toBe(LISTEN_TRUST - 10);
  });

  it("stays mended, whatever anyone plays afterwards", () => {
    const mended: Session = { ...fiddle(), discord: 0, mendedBy: ["re"] };
    expect(playRound(mended, { blu: "takeBreak" })).toBe(mended);
  });

  it("doesn't undo a band's work when one player is left", () => {
    const low: Session = { ...fiddle(), discord: 10, trust: 100 };
    const after = playRound(low, { fibonacci: "tune" });
    expect(after.discord).toBeLessThanOrEqual(10);
  });
});
