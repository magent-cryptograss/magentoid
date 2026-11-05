import { describe, expect, it } from "vitest";
import { canPlay, gapsIn, type Tune } from "./tune";

// The names and block are made up for the test; no real tune has a lineage yet.
const saltCreek = (): Tune => ({
  id: "salt-creek",
  title: "Salt Creek",
  kind: "traditional",
  notesBy: "fibonacci",
  source: "played in on keys, block 26,400,000",
  license: "CC-BY-SA-4.0",
  earCheckedBy: "justin",
  file: "salt-creek.mid",
});

describe("a tune's lineage", () => {
  it("plays when every link is there", () => {
    expect(gapsIn(saltCreek())).toEqual([]);
    expect(canPlay(saltCreek())).toBe(true);
  });

  it("doesn't play until a person has ear-checked it", () => {
    const tune = { ...saltCreek(), earCheckedBy: "" };
    expect(canPlay(tune)).toBe(false);
    expect(gapsIn(tune)).toEqual(["nobody has ear-checked it"]);
  });

  it("refuses notes put in by an emergent", () => {
    const tune = { ...saltCreek(), notesBy: "Magent" };
    expect(gapsIn(tune)).toEqual(["Magent is an emergent, and the notes have to come from a person"]);
  });

  it("refuses an emergent's ear-check", () => {
    expect(canPlay({ ...saltCreek(), earCheckedBy: "blu" })).toBe(false);
  });

  it("refuses notes from The Session, whose license bars LLM processing", () => {
    const tune = { ...saltCreek(), source: "https://thesession.org/tunes/1234" };
    expect(canPlay(tune)).toBe(false);
  });

  it("refuses notes from the Nottingham database, which states no license", () => {
    expect(canPlay({ ...saltCreek(), source: "Nottingham Music Database, reels" })).toBe(false);
  });

  it("doesn't refuse a tune just because it was played in Nottingham", () => {
    expect(canPlay({ ...saltCreek(), source: "played in at a session in Nottingham, block 26,400,000" })).toBe(true);
  });

  it("names every gap at once, so one look shows the whole fix", () => {
    const tune = { ...saltCreek(), license: "", file: " " };
    expect(gapsIn(tune)).toEqual(["it has no license", "it has no file"]);
  });
});
