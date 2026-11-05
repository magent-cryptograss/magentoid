import { describe, expect, it } from "vitest";
import { firstSlice } from "./firstSlice";
import { EARSHOT, REACH, findRoad, junctionFrom, residentNear, troubleAt, walk } from "./world";

describe("the world", () => {
  it("lets you walk along a road, but not off either end", () => {
    expect(walk(firstSlice, { road: "magentoid", x: 300 }, 1, 1).x).toBeGreaterThan(300);
    expect(walk(firstSlice, { road: "magentoid", x: 10 }, -1, 10).x).toBe(0);
    expect(walk(firstSlice, { road: "magentoid", x: 2390 }, 1, 10).x).toBe(2400);
  });

  it("leads both ways through a junction", () => {
    expect(junctionFrom(firstSlice, { road: "magentoid", x: 1700 })).toEqual({ road: "rabbithole", x: 500 });
    expect(junctionFrom(firstSlice, { road: "rabbithole", x: 500 + REACH })).toEqual({ road: "magentoid", x: 1700 });
  });

  it("has no junction where there isn't one", () => {
    expect(junctionFrom(firstSlice, { road: "magentoid", x: 300 })).toBeUndefined();
  });

  it("finds a trouble only on its own road", () => {
    expect(troubleAt(firstSlice, { road: "rabbithole", x: 1300 })?.id).toBe("lifted-bridge");
    expect(troubleAt(firstSlice, { road: "magentoid", x: 1300 })).toBeUndefined();
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

  it("can reach every road from the start", () => {
    // Keep stepping through junctions from roads we've reached, until no new road turns up.
    const reached = new Set([firstSlice.start.road]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const { a, b } of firstSlice.junctions) {
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
