import { describe, expect, it } from "vitest";
import {
  DRIFT,
  FLAT_BREAK_TRUST,
  HEARD_AT,
  LISTEN_TRUST,
  STEADY,
  isMended,
  isNeedHeard,
  playRound,
  startSession,
  type Move,
  type Session,
} from "./session";

const fiddle = (): Session => startSession({ discord: 60, needsBand: true });
const banjo = (): Session => startSession({ discord: 20, needsBand: false });

/** Play the same moves round after round, and return the Session at the end. */
function playRounds(session: Session, rounds: number, moves: Record<string, Move>): Session {
  for (let i = 0; i < rounds; i++) session = playRound(session, moves).session;
  return session;
}

/** How many rounds a band takes to mend `session`, playing `opening` once and then `then` until it's done. */
function roundsToMend(session: Session, opening: Record<string, Move>[], then: Record<string, Move>): number {
  let rounds = 0;
  for (const moves of opening) {
    session = playRound(session, moves).session;
    rounds++;
  }
  while (!isMended(session) && rounds < 100) {
    session = playRound(session, then).session;
    rounds++;
  }
  return rounds;
}

describe("a Session", () => {
  it("gets a little worse each round if nobody mends it", () => {
    const after = playRound(fiddle(), { fibonacci: "listen" }).session;
    expect(after.discord).toBe(60 + DRIFT);
  });

  it("tells you what it needs once you've listened enough", () => {
    const listens = HEARD_AT / LISTEN_TRUST;
    expect(isNeedHeard(playRounds(fiddle(), listens - 1, { fibonacci: "listen" }))).toBe(false);
    expect(isNeedHeard(playRounds(fiddle(), listens, { fibonacci: "listen" }))).toBe(true);
  });

  it("rewards listening before tuning", () => {
    const cold = playRound(fiddle(), { justin: "tune" }).session;
    const warmed = playRound(playRounds(fiddle(), 2, { justin: "listen" }), { justin: "tune" }).session;
    const coldProgress = 60 - cold.discord;
    const warmProgress = 60 + 2 * DRIFT - warmed.discord;
    expect(warmProgress).toBeGreaterThan(coldProgress);
  });

  it("pays a lone player back for listening, enough to notice", () => {
    // blu's second finding: before, listening first saved a lone player one
    // round on a thing that took ten. The banjo is where people learn the game,
    // and the lesson there should be "listen first".
    const justTune = roundsToMend(banjo(), [], { justin: "tune" });
    const listenFirst = roundsToMend(banjo(), [{ justin: "listen" }, { justin: "listen" }], { justin: "tune" });
    expect(listenFirst).toBeLessThanOrEqual(justTune / 2);
    // And listening only once already helps: there's no point where listening is a trap.
    const listenOnce = roundsToMend(banjo(), [{ justin: "listen" }], { justin: "tune" });
    expect(listenOnce).toBeLessThan(justTune);
  });

  it("can be steadied alone, but not finished alone, when it needs a band", () => {
    let s = playRounds(fiddle(), 5, { fibonacci: "listen" });
    s = playRounds(s, 50, { fibonacci: "tune" });
    expect(s.discord).toBe(STEADY);
    expect(isMended(s)).toBe(false);
  });

  it("is mended by a band that listens first, and credits everyone who played", () => {
    let s = playRound(fiddle(), { fibonacci: "listen", justin: "listen" }).session;
    s = playRound(s, { fibonacci: "takeBreak", justin: "backUp", skyler: "tune" }).session;
    s = playRounds(s, 5, { fibonacci: "takeBreak", justin: "backUp" });
    expect(isMended(s)).toBe(true);
    expect(s.playedBy).toEqual(["fibonacci", "justin", "skyler"]);
  });

  it("stays mended, whatever anyone plays afterwards", () => {
    const mended: Session = { ...fiddle(), discord: 0, playedBy: ["re"] };
    expect(playRound(mended, { blu: "takeBreak" }).session).toBe(mended);
  });

  it("doesn't undo a band's work when one player is left", () => {
    const low: Session = { ...fiddle(), discord: 10, trust: 100 };
    expect(playRound(low, { fibonacci: "tune" }).session.discord).toBeLessThanOrEqual(10);
  });
});

describe("a break", () => {
  const heard = (): Session => ({ ...fiddle(), trust: HEARD_AT });

  it("lands over somebody's backing, once the tune is known", () => {
    const after = playRound(heard(), { fibonacci: "takeBreak", justin: "backUp" }).session;
    expect(after.discord).toBeLessThan(60);
  });

  it("falls flat before anybody knows the tune, and costs Trust", () => {
    const after = playRound({ ...fiddle(), trust: HEARD_AT - 1 }, { fibonacci: "takeBreak", justin: "backUp" }).session;
    expect(after.discord).toBe(60 + DRIFT);
    expect(after.trust).toBe(HEARD_AT - 1 - FLAT_BREAK_TRUST);
  });

  it("falls flat with nobody backing it", () => {
    const after = playRound(heard(), { skyler: "takeBreak" }).session;
    expect(after.trust).toBe(HEARD_AT - FLAT_BREAK_TRUST);
  });

  it("falls flat when two players take one at the same time", () => {
    const after = playRound(heard(), { fibonacci: "takeBreak", justin: "takeBreak", skyler: "backUp" }).session;
    expect(after.discord).toBe(60 + DRIFT);
  });

  it("makes listening the fastest way for a band to mend things", () => {
    // blu's simulation, kept as a test: before breaks needed the tune known,
    // a band that never listened mended the fiddle fastest.
    const neverListen = roundsToMend(fiddle(), [], { fibonacci: "takeBreak", justin: "backUp" });
    const listenFirst = roundsToMend(
      fiddle(),
      [{ fibonacci: "listen", justin: "listen" }],
      { fibonacci: "takeBreak", justin: "backUp" },
    );
    expect(listenFirst).toBeLessThan(neverListen);
  });
});

describe("the story of a round", () => {
  it("says why a break fell flat", () => {
    const { story } = playRound(fiddle(), { fibonacci: "takeBreak", justin: "backUp" });
    expect(story).toContain("fibonacci took a break, but nobody knows the tune well enough yet.");
  });

  it("says when it's mended", () => {
    const nearly: Session = { ...fiddle(), discord: 5, trust: HEARD_AT };
    const { story } = playRound(nearly, { fibonacci: "takeBreak", justin: "backUp" });
    expect(story).toEqual(["fibonacci took a break, and it landed.", "justin backed up.", "It's mended."]);
  });

  it("says when one player has done all one player can", () => {
    const steadied: Session = { ...fiddle(), discord: STEADY, trust: 100 };
    const { story } = playRound(steadied, { justin: "tune" });
    expect(story).toContain("One player can steady it, but it takes a band to finish.");
  });

  it("rewards backing a break over everyone tuning at once, however long the band listened", () => {
    const listened: Session = { ...startSession({ discord: 90, needsBand: true }), trust: 100 };
    const allTune = playRound(listened, { a: "tune", b: "tune", c: "tune" }).session;
    const aBreak = playRound(listened, { a: "takeBreak", b: "backUp", c: "backUp" }).session;
    expect(aBreak.discord).toBeLessThan(allTune.discord);
  });
});
