/**
 * A Session is what this game has instead of a battle.
 *
 * Something on the road is out of sorts: a fiddle with a lifted bridge, a jam
 * that has lost the one. It has Discord, which you bring down to mend it, and
 * Trust, which you build by listening to it. Nobody is defeated. When Discord
 * reaches zero the thing is mended, and everyone who played on it is credited,
 * the way a record credits its players.
 *
 * Everything in this file is plain data and plain functions: no Phaser, no
 * Colyseus. That is on purpose. The rules can be read, tested and argued about
 * without running a game.
 */

/** What you can do on your turn. Leaving ("set it down") is not a move: you just walk away. */
export type Move = "listen" | "tune" | "backUp" | "takeBreak";

export const MOVES: readonly Move[] = ["listen", "tune", "backUp", "takeBreak"];

/**
 * Just the numbers and the credits. What the thing is, and what it needs, live
 * with the trouble in the world (see world.ts and server/needs.ts): the rules
 * never need to read them.
 */
export interface Session {
  /** 0 to 100. At 0 the thing is mended. */
  readonly discord: number;
  /** 0 to 100. Listening builds it. Trust makes every Tune land harder, and a break needs it. */
  readonly trust: number;
  /** A thing that needs a band can be steadied alone, but not finished alone. */
  readonly needsBand: boolean;
  /**
   * Everyone who has played a round on it, in the order they first sat in.
   * Once it's mended, these are its credits.
   */
  readonly playedBy: readonly string[];
}

/** What one round did: the Session afterwards, and what happened, in words. */
export interface Round {
  readonly session: Session;
  readonly story: readonly string[];
}

/** Each round, a thing nobody fixes gets a little worse. This is the only pressure. */
export const DRIFT = 3;
/** How much Trust one Listen earns. */
export const LISTEN_TRUST = 20;
/** A Tune always does this much... */
export const TUNE_BASE = 5;
/**
 * ...plus this share of the Trust, counted only up to HEARD_AT (see the Tune in
 * `effectOf`). At a fifth, a lone player who listens first mends the banjo in
 * half the rounds. (At a tenth, blu found, listening first saved a lone player
 * one round on a thing that took ten: too little to notice.)
 */
export const TUNE_PER_TRUST = 1 / 5;
/** A break (a solo) is the big move. When it doesn't land, see `whyBreakFallsFlat`. */
export const BREAK_POWER = 25;
/** A break that doesn't land costs this much Trust. */
export const FLAT_BREAK_TRUST = 10;
/** Each player backing you up makes your Tune or break this much stronger (0.5 = half again). */
export const BACKING_BONUS = 0.5;
/** How low one player can bring a thing that needs a band. */
export const STEADY = 20;
/** Trust at which the players have listened enough to know what the thing needs. */
export const HEARD_AT = 40;

/** A fresh Session with something out of sorts: nobody has listened to it yet, and nobody has played. */
export function startSession(trouble: { readonly discord: number; readonly needsBand: boolean }): Session {
  return { discord: trouble.discord, trust: 0, needsBand: trouble.needsBand, playedBy: [] };
}

/** Takes anything with a `discord`, so the server's and the screen's copies of a Session work too. */
export function isMended(session: Pick<Session, "discord">): boolean {
  return session.discord === 0;
}

export function isNeedHeard(session: Pick<Session, "trust">): boolean {
  return session.trust >= HEARD_AT;
}

/**
 * Play one round. `moves` holds the choice of everyone playing this round, by
 * name. Returns a new Session and the story of the round; the old Session is
 * left alone, so a round can be replayed or compared in a test.
 */
export function playRound(session: Session, moves: Readonly<Record<string, Move>>): Round {
  const players = Object.keys(moves);
  if (isMended(session) || players.length === 0) return { session, story: [] };

  const effects = players.map((player) => effectOf(player, session, moves));
  const mending = sum(effects.map((effect) => effect.mending));
  const trust = clamp(session.trust + sum(effects.map((effect) => effect.trust)), 0, 100);

  // Alone with a thing that needs a band, you can hold it at STEADY but not
  // push past. (If a band already got it lower, playing alone doesn't undo that.)
  const alone = session.needsBand && players.length < 2;
  const floor = alone ? Math.min(STEADY, session.discord) : 0;
  const wouldBe = Math.round(session.discord - mending + DRIFT);
  const discord = clamp(wouldBe, floor, 100);

  const newcomers = players.filter((player) => !session.playedBy.includes(player));
  const after: Session = { ...session, discord, trust, playedBy: [...session.playedBy, ...newcomers] };

  const story = effects.map((effect) => effect.story);
  if (isMended(after)) story.push("It's mended.");
  else story.push(`Discord ${session.discord} → ${discord}.`);
  if (alone && wouldBe < floor) story.push("One player can steady it, but it takes a band to finish.");

  return { session: after, story };
}

/** What one player's move adds to the round. */
interface Effect {
  readonly mending: number;
  readonly trust: number;
  readonly story: string;
}

function effectOf(player: string, session: Session, moves: Readonly<Record<string, Move>>): Effect {
  const lift = 1 + countBackers(moves, player) * BACKING_BONUS;

  switch (moves[player]) {
    case "listen":
      return { mending: 0, trust: LISTEN_TRUST, story: `${player} listened.` };

    case "tune":
      // Trust from earlier rounds counts, not Trust earned this same round:
      // you can't listen and act on what you heard in the same breath.
      // Trust past HEARD_AT doesn't sharpen a Tune: once you know the tune,
      // more listening won't tune it better. Without this cap, a band that
      // listened long enough did better all tuning at once than backing a
      // break, and the band's big move stopped mattering (blu, round 3).
      return { mending: (TUNE_BASE + Math.min(session.trust, HEARD_AT) * TUNE_PER_TRUST) * lift, trust: 0, story: `${player} tuned.` };

    case "backUp":
      // Backing up does nothing on its own. It shows up in everyone else's lift.
      return { mending: 0, trust: 0, story: `${player} backed up.` };

    case "takeBreak": {
      const why = whyBreakFallsFlat(player, session, moves);
      if (why) return { mending: 0, trust: -FLAT_BREAK_TRUST, story: `${player} took a break, but ${why}.` };
      return { mending: BREAK_POWER * lift, trust: 0, story: `${player} took a break, and it landed.` };
    }
  }
}

/**
 * A break only lands when the music is ready for it, the way it works at a
 * jam. Returns why it falls flat, or undefined if it lands.
 */
function whyBreakFallsFlat(player: string, session: Session, moves: Readonly<Record<string, Move>>): string | undefined {
  // You don't take a break on a tune you don't know. (blu found that without
  // this, a band that never listened mended things fastest.)
  if (!isNeedHeard(session)) return "nobody knows the tune well enough yet";
  if (countBackers(moves, player) === 0) return "nobody was backing it up";
  // One break at a time. Two at once step on each other.
  if (Object.entries(moves).some(([who, move]) => who !== player && move === "takeBreak")) {
    return "it collided with another break";
  }
  return undefined;
}

/** How many players other than `player` chose to back up this round. */
function countBackers(moves: Readonly<Record<string, Move>>, player: string): number {
  return Object.entries(moves).filter(([who, move]) => who !== player && move === "backUp").length;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
