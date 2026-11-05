import { describe, expect, it } from "vitest";
import { firstSlice } from "./firstSlice";
import { REACH, junctionFrom, troubleAt, walk } from "./world";

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

  it("finds the trouble only on its own road", () => {
    expect(troubleAt(firstSlice, { road: "rabbithole", x: 1400 })?.id).toBe("lifted-bridge");
    expect(troubleAt(firstSlice, { road: "magentoid", x: 1400 })).toBeUndefined();
  });
});
