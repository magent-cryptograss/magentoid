import { describe, expect, it } from "vitest";
import { FIRST_LINES, LINE_CHARS, MoodFeed, plain, type Turn } from "./moodFeed";

const turn = (id: string, text = `line ${id}`, sender = "justin"): Turn => ({
  id,
  sender,
  is_human: sender === "justin",
  created_at: "2026-11-06T17:20:00Z",
  text,
});

/** A Mood that answers the way magenta does: the newest few, or everything after an id. */
function mood(turns: Turn[]) {
  const asked: (string | undefined)[] = [];
  const read = async (_slug: string, after?: string) => {
    asked.push(after);
    if (!after) return turns.slice(-FIRST_LINES);
    const i = turns.findIndex((t) => t.id === after);
    return i < 0 ? turns : turns.slice(i + 1); // an unknown id is "everything", as magenta has it
  };
  return { turns, asked, read };
}

describe("listening to a Mood", () => {
  it("starts with the newest few lines, then hears only what's new", async () => {
    const m = mood(["1", "2", "3", "4", "5", "6"].map((id) => turn(id)));
    const feed = new MoodFeed(m.read);

    expect((await feed.newLines("magentoid")).map((l) => l.id)).toEqual(["3", "4", "5", "6"]);
    expect(await feed.newLines("magentoid")).toEqual([]);

    m.turns.push(turn("7"));
    expect((await feed.newLines("magentoid")).map((l) => l.id)).toEqual(["7"]);
    expect(m.asked).toEqual([undefined, "6", "6"]);
  });

  it("never shows a line twice, even when magenta answers with everything", async () => {
    const m = mood([turn("1"), turn("2")]);
    const feed = new MoodFeed(async (slug, after) => (after ? [turn("1"), turn("2"), turn("3")] : m.read(slug)));
    await feed.newLines("magentoid");
    expect((await feed.newLines("magentoid")).map((l) => l.id)).toEqual(["3"]);
  });

  it("starts over on a road it was told to forget", async () => {
    const m = mood([turn("1"), turn("2")]);
    const feed = new MoodFeed(m.read);
    await feed.newLines("magentoid");
    feed.forget("magentoid");
    expect((await feed.newLines("magentoid")).map((l) => l.id)).toEqual(["1", "2"]);
  });

  it("leaves out a message with nothing in it to say aloud", async () => {
    const feed = new MoodFeed(mood([turn("1", "<silent>nothing to add</silent>", "re"), turn("2", "hi")]).read);
    expect((await feed.newLines("magentoid")).map((l) => l.text)).toEqual(["hi"]);
  });
});

describe("a message as one line", () => {
  it("keeps the words of links and drops the markup", () => {
    expect(plain("**It's up:** see [the game](https://x.example) and [[Cryptograss:Magentoid (contemplation)|the design]], `npm test`."))
      .toBe("It's up: see the game and the design, npm test.");
  });

  it("keeps a tag that's quoted in code as words", () => {
    expect(plain("Real catch: a `<silent>` message's reason was leaking.")).toBe("Real catch: a ‹silent› message's reason was leaking.");
  });

  it("drops the blocks written for the machinery", () => {
    expect(plain("Handing it off.\n\n```handoff\nto: connectome\n---\nstuff\n```\nDone.")).toBe("Handing it off. Done.");
  });

  it("puts a list on one line", () => {
    expect(plain("Two things:\n- one\n- two")).toBe("Two things: one two");
  });

  it("cuts a long message, without cutting an emoji in half", () => {
    const line = plain("🎻".repeat(LINE_CHARS + 10));
    expect([...line].length).toBe(LINE_CHARS);
    expect(line.endsWith("🎻…")).toBe(true);
  });
});
