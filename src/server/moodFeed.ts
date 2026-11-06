/**
 * What's being said in each road's Mood, as it's said.
 *
 * Every road is a Mood, so the game listens to it: every few seconds the
 * server asks magenta for whatever has been posted since it last asked, on
 * each road somebody is standing on, and puts the new lines in the shared
 * state. Everyone on that road sees them come in.
 *
 * The server asks, not the browsers: one question per road, however many
 * players are on it, and magenta only ever hears from one place.
 *
 * magenta's polling contract (api/moods/<slug>/turns/): `?limit=N` is the
 * newest N messages; `?after=<id>` is everything since that message.
 */

/** Where magenta lives. */
export const MAGENTA_URL = process.env.MAGENTA_URL ?? "https://magenta.cryptograss.live";

/** A message as magenta sends it: only the fields the game uses. */
export interface Turn {
  readonly id: string;
  readonly sender: string;
  readonly is_human: boolean;
  readonly created_at: string;
  readonly text: string;
}

/** A line as the game shows it. */
export interface Line {
  readonly id: string;
  readonly who: string;
  readonly human: boolean;
  readonly text: string;
  readonly at: string;
}

/** How a road's Mood is read: magenta in the real game, a stand-in in the tests. */
export type ReadTurns = (slug: string, after?: string) => Promise<readonly Turn[]>;

/** How many lines a road shows when you first arrive. */
export const FIRST_LINES = 4;
/** The longest a line gets before it's cut, in characters. */
export const LINE_CHARS = 220;

/** Ask magenta for a Mood's newest messages, or for everything since `after`. */
export const readFromMagenta: ReadTurns = async (slug, after) => {
  // magenta's limit counts everything in its timeline (steps, thoughts), not just messages, so ask for plenty.
  const query = after ? `after=${encodeURIComponent(after)}` : `limit=${FIRST_LINES * 8}`;
  const response = await fetch(`${MAGENTA_URL}/api/moods/${encodeURIComponent(slug)}/turns/?${query}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`magenta said ${response.status} for #${slug}`);
  const body = (await response.json()) as { turns?: Turn[] };
  return body.turns ?? [];
};

export class MoodFeed {
  /** The newest message seen on each road, so the next question is "anything since?". */
  private readonly newest = new Map<string, string>();

  constructor(private readonly read: ReadTurns) {}

  /** Stop following a road: next time it's asked about, start from its newest lines again. */
  forget(slug: string) {
    this.newest.delete(slug);
  }

  /**
   * What's new on a road since we last asked. The first time, that's its
   * newest few lines, so you arrive in the middle of the conversation rather
   * than to silence.
   */
  async newLines(slug: string): Promise<Line[]> {
    const after = this.newest.get(slug);
    const turns = await this.read(slug, after);
    if (turns.length > 0) this.newest.set(slug, turns[turns.length - 1].id);
    // Asked for "since", magenta can hand back the one we already have, if
    // it didn't know the id. Never show a line twice.
    const fresh = after ? turns.slice(turns.findIndex((t) => t.id === after) + 1) : turns.slice(-FIRST_LINES);
    return fresh.map(toLine).filter((line): line is Line => line !== undefined);
  }
}

/** A message as one line of speech, or nothing if there's nothing in it to say aloud. */
export function toLine(turn: Turn): Line | undefined {
  const text = plain(turn.text);
  if (!text) return undefined;
  return { id: turn.id, who: turn.sender, human: turn.is_human, text, at: turn.created_at };
}

/**
 * Markdown, as words. Code and the blocks emergents write for the machinery
 * (```handoff, ```voice, ```settings) go entirely; links keep their words;
 * tags like <silent> or <react/> go; and what's left is cut to a line.
 */
export function plain(markdown: string): string {
  // A silence's reason is for whoever opens the dot, not to be said aloud.
  if (/^\s*<silent>/.test(markdown)) return "";
  const text = markdown
    .replace(/```[\s\S]*?(```|$)/g, " ")
    // A tag written in `code` is being talked about, not used: keep it as words.
    .replace(/`([^`\n]*)`/g, (_, code: string) => code.replace(/</g, "‹").replace(/>/g, "›"))
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [words](link)
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2") // [[Page]] and [[Page|words]]
    .replace(/(\*\*|__|`)/g, "")
    .replace(/^\s*(#+|[-*]|\d+\.)\s+/gm, "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = [...text];
  return chars.length <= LINE_CHARS ? text : chars.slice(0, LINE_CHARS - 1).join("").trimEnd() + "…";
}
