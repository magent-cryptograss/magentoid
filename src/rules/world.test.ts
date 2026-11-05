import { describe, expect, it } from "vitest";
import { firstSlice } from "./firstSlice";
import { EARSHOT, REACH, findRoad, findTrouble, isOpen, junctionFrom, residentNear, seatFor, troubleAt, walk } from "./world";

describe("the world", () => {
  it("lets you walk along a road, but not off either end", () => {
    expect(walk(firstSlice, { road: "magentoid", x: 300 }, 1, 1).x).toBeGreaterThan(300);
    expect(walk(firstSlice, { road: "magentoid", x: 10 }, -1, 10).x).toBe(0);
    expect(walk(firstSlice, { road: "magentoid", x: 2390 }, 1, 10).x).toBe(2400);
  });

  it("leads both ways through a junction", () => {
    expect(junctionFrom(firstSlice, { road: "magentoid", x: 1700 })?.leadsTo).toEqual({ road: "rabbithole", x: 500 });
    expect(junctionFrom(firstSlice, { road: "rabbithole", x: 500 + REACH })?.leadsTo).toEqual({ road: "magentoid", x: 1700 });
  });

  it("keeps a closed junction closed, from both ends, until its trouble is mended", () => {
    const nothingMended = () => false;
    const fiddleMended = (id: string) => id === "lifted-bridge";
    for (const end of [{ road: "rabbithole", x: 2000 }, { road: "chartifacts", x: 300 }]) {
      const crossing = junctionFrom(firstSlice, end)!;
      expect(isOpen(crossing, nothingMended)).toBe(false);
      expect(isOpen(crossing, fiddleMended)).toBe(true);
    }
    // A junction that never closes is open whatever is mended.
    expect(isOpen(junctionFrom(firstSlice, { road: "magentoid", x: 1700 })!, nothingMended)).toBe(true);
  });

  it("has no junction where there isn't one", () => {
    expect(junctionFrom(firstSlice, { road: "magentoid", x: 300 })).toBeUndefined();
  });

  it("finds a trouble only on its own road", () => {
    expect(troubleAt(firstSlice, { road: "rabbithole", x: 1300 })?.id).toBe("lifted-bridge");
    expect(troubleAt(firstSlice, { road: "magentoid", x: 1300 })).toBeUndefined();
  });

  it("seats a band around a trouble, in order of name, the same on every screen", () => {
    const fiddle = findTrouble(firstSlice, "lifted-bridge");
    const band = ["skyler", "justin", "fibonacci"];
    const seat = (name: string) => seatFor(firstSlice, fiddle, band, name) - fiddle.at.x;
    // In order of name: fibonacci sits to the left of it, justin to the right, and skyler further out on the left.
    expect([seat("fibonacci"), seat("justin"), seat("skyler")]).toEqual([-70, 70, -120]);
  });

  it("lets you hear a resident from further off than you can reach a trouble", () => {
    const magent = firstSlice.residents[0];
    expect(residentNear(firstSlice, { road: magent.at.road, x: magent.at.x + EARSHOT })?.name).toBe("magent");
    expect(residentNear(firstSlice, { road: magent.at.road, x: magent.at.x + EARSHOT + 1 })).toBeUndefined();
  });
});

describe("the first slice", () => {
  // Hand-written data is easy to get wrong, so check it the way a player would find it.
  it("puts everything on a road that exists, and within it", () => {
    const places = [
      firstSlice.start,
      ...firstSlice.junctions.flatMap((j) => [j.a, j.b]),
      ...firstSlice.troubles.map((t) => t.at),
      ...firstSlice.residents.map((r) => r.at),
    ];
    for (const place of places) {
      const road = findRoad(firstSlice, place.road);
      expect(place.x).toBeGreaterThanOrEqual(0);
      expect(place.x).toBeLessThanOrEqual(road.length);
    }
  });

  it("can reach every road from the start, mending whatever opens the way", () => {
    // Keep stepping through junctions from roads we've reached, until no new
    // road turns up. A closed junction counts only once its trouble is on a
    // road we've already reached, so nothing is ever shut behind its own key.
    const reached = new Set([firstSlice.start.road]);
    const canReach = (troubleId: string) => reached.has(findTrouble(firstSlice, troubleId).at.road);
    let grew = true;
    while (grew) {
      grew = false;
      for (const { a, b, opensWhenMended } of firstSlice.junctions) {
        if (opensWhenMended && !canReach(opensWhenMended)) continue;
        for (const [from, to] of [[a, b], [b, a]]) {
          if (reached.has(from.road) && !reached.has(to.road)) {
            reached.add(to.road);
            grew = true;
          }
        }
      }
    }
    expect([...reached].sort()).toEqual(firstSlice.roads.map((r) => r.id).sort());
  });

  it("only closes a junction with a trouble that exists", () => {
    for (const { opensWhenMended } of firstSlice.junctions) {
      if (opensWhenMended) expect(() => findTrouble(firstSlice, opensWhenMended)).not.toThrow();
    }
  });

  it("never puts a trouble at a junction", () => {
    // The hint line can only show one of them, so the other would be hidden.
    for (const trouble of firstSlice.troubles) {
      expect(junctionFrom(firstSlice, trouble.at)).toBeUndefined();
    }
  });

  it("gives every trouble its own id", () => {
    const ids = firstSlice.troubles.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
