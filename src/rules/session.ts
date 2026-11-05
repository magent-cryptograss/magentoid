/**
 * A Session is what this game has instead of a battle.
 *
 * Something on the road is out of sorts: a fiddle with a lifted bridge, a jam
 * that has lost the one. It has Discord, which you bring down to mend it, and
 * Trust, which you build by listening to it first. Nobody is defeated. When
 * Discord reaches zero the thing is mended, and the names of everyone who
 * played on that last round stay on it.
 *
 * Everything in this file is plain data and plain functions: no Phaser, no
 * Colyseus. That is on purpose. The rules can be read, tested and argued about
 * without running a game.
 */

/** What you can do on your turn. Leaving ("set it down") is not a move: you just walk away. */
export type Move = "listen" | "tune" | "backUp" | "takeBreak";

export const MOVES: readonly Move[] = ["listen", "tune", "backUp", "takeBreak"];

export interface Session {
  /** What is out of sorts, as a player would say it. */
  readonly thing: string;
  /** What it needs. Players only learn this once they have listened enough. */
  readonly need: string;
  /** 0 to 100. At 0 the thing is mended. */
  readonly discord: number;
  /** 0 to 100. Trust makes every tune land harder. */
  readonly trust: number;
  /** A thing that needs a band can be steadied alone, but not finished alone. */
  readonly needsBand: boolean;
  /** Who played on the round that mended it. Empty until then. */
  readonly mendedBy: readonly string[];
}

/** Each round, a thing nobody fixes gets a little worse. This is the only pressure. */
export const DRIFT = 4;
/** How much Trust one Listen earns. */
export const LISTEN_TRUST = 20;
/** A Tune always does this much, and more with Trust. */
export const TUNE_BASE = 5;
/** A break (a solo) is the big move, but it only lands over somebody's rhythm. */
export const BREAK_POWER = 25;
/** A break with nobody backing it costs Trust: you showed off. */
export const LONELY_BREAK_TRUST = 10;
/** Each player backing you up makes your Tune or break this much stronger (0.5 = half again). */
export const BACKING_BONUS = 0.5;
/** How low one player can bring a thing that needs a band. */
export const STEADY = 20;
/** Trust at which a player has listened enough to hear what the thing needs. */
export const HEARD_AT = 40;

export function startSession(thing: string, need: string, discord: number, needsBand: boolean): Session {
  return { thing, need, discord, trust: 0, needsBand, mendedBy: [] };
}

export function isMended(session: Session): boolean {
  return session.discord === 0;
}

export function isNeedHeard(session: Session): boolean {
  return session.trust >= HEARD_AT;
}

/**
 * Play one round. `moves` holds every player's choice for this round, by name.
 * Returns a new Session; the old one is left alone, so a round can be replayed
 * or compared in a test.
 */
export function playRound(session: Session, moves: Readonly<Record<string, Move>>): Session {
  if (isMended(session)) return session;

  const players = Object.keys(moves);
  if (players.length === 0) return session;

  let trust = session.trust;
  let mending = 0;

  for (const player of players) {
    const backers = countBackers(moves, player);
    const lift = 1 + backers * BACKING_BONUS;

    switch (moves[player]) {
      case "listen":
        trust += LISTEN_TRUST;
        break;
      case "tune":
        // Trust from earlier rounds counts, not Trust earned this same round:
        // you can't listen and act on what you heard in the same breath.
        mending += (TUNE_BASE + session.trust / 10) * lift;
        break;
      case "backUp":
        // Backing up does nothing on its own. It shows up in everyone else's lift.
        break;
      case "takeBreak":
        if (backers > 0) mending += BREAK_POWER * lift;
        else trust -= LONELY_BREAK_TRUST;
        break;
    }
  }

  // Alone with a thing that needs a band, you can hold it at STEADY but not
  // push past. (If a band already got it lower, playing alone doesn't undo that.)
  const floor = session.needsBand && players.length < 2 ? Math.min(STEADY, session.discord) : 0;
  const discord = clamp(Math.round(session.discord - mending + DRIFT), floor, 100);
  const mendedBy = discord === 0 ? players.slice().sort() : [];

  return { ...session, discord, trust: clamp(trust, 0, 100), mendedBy };
}

/** How many players other than `player` chose to back up this round. */
function countBackers(moves: Readonly<Record<string, Move>>, player: string): number {
  return Object.entries(moves).filter(([who, move]) => who !== player && move === "backUp").length;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
