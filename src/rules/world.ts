/**
 * The world is made of roads, and every road is a Mood.
 *
 * You walk a road left and right, side-scrolling. Here and there a road meets
 * another one at a junction, and you can step "into the screen" onto it (or
 * back out). That is the whole map: roads, and the places where they meet.
 *
 * Like session.ts, this file is plain data and functions, so the server and
 * the tests can share it and the client never has to guess.
 */

export interface Road {
  /** The Mood's slug, as in magenta.cryptograss.live/moods/<id>. */
  readonly id: string;
  /** What the sign says. */
  readonly name: string;
  /** How long the road is, in pixels. */
  readonly length: number;
  /** The road's colour, as a hue from 0 to 1 around the colour wheel. Left out, one is picked from its name. */
  readonly hue?: number;
}

/** One end of a junction: a place on a road. */
export interface Place {
  readonly road: string;
  readonly x: number;
}

/** Two places, on two roads, that you can step between. */
export interface Junction {
  readonly a: Place;
  readonly b: Place;
  /**
   * The trouble that has to be mended before this junction opens, if it starts
   * out closed. Mending is shared, so once one band mends it, the way is open
   * for everybody. (Super Metroid opens doors with a bigger gun; here it's
   * leaving something better than you found it.)
   */
  readonly opensWhenMended?: string;
}

/** A junction as you see it from your end: where it leads, and what opens it. */
export interface Crossing {
  readonly leadsTo: Place;
  readonly opensWhenMended?: string;
}

/** Something out of sorts, sitting at a place, waiting for a Session. */
export interface Trouble {
  readonly id: string;
  readonly at: Place;
  /** How it's drawn. */
  readonly looks: "fiddle" | "banjo" | "chart";
  /** What is out of sorts, as a player would say it. */
  readonly thing: string;
  /** How out of sorts it is when the world starts, from 0 to 100. */
  readonly discord: number;
  readonly needsBand: boolean;
  // What it needs isn't here, on purpose. Every player's browser has a copy of
  // this file, and the need is the one thing you earn by listening. Only the
  // server knows it: see server/needs.ts.
}

/**
 * Someone who lives on a road: an emergent, at home in its Mood. Residents
 * don't play; they're there to talk to. Each one's words are its own.
 */
export interface Resident {
  readonly name: string;
  /** The resident's own colour, as a number (0xff67fd is magent's magenta). */
  readonly colour: number;
  readonly at: Place;
  /** What it says when you walk up. */
  readonly says: string;
}

export interface World {
  readonly roads: readonly Road[];
  readonly junctions: readonly Junction[];
  readonly troubles: readonly Trouble[];
  readonly residents: readonly Resident[];
  /** Where a new player appears. */
  readonly start: Place;
}

/** How close you have to stand to a junction or a trouble to use it. */
export const REACH = 48;

/** How close you have to be to hear a resident. */
export const EARSHOT = 140;

/** Pixels per second. */
export const WALK_SPEED = 220;

/** How far from a trouble its first two seats are, and how much further out each next pair sits. */
const SEAT_GAP = 70;
const ROW_GAP = 50;

export function findRoad(world: World, id: string): Road {
  const road = world.roads.find((r) => r.id === id);
  if (!road) throw new Error(`No road called "${id}"`);
  return road;
}

export function findTrouble(world: World, id: string): Trouble {
  const trouble = world.troubles.find((t) => t.id === id);
  if (!trouble) throw new Error(`No trouble called "${id}"`);
  return trouble;
}

/** Walk along a road. `direction` is -1 (left), 0 (stand still) or 1 (right). */
export function walk(world: World, at: Place, direction: number, seconds: number): Place {
  const road = findRoad(world, at.road);
  const x = at.x + Math.sign(direction) * WALK_SPEED * seconds;
  return { road: at.road, x: Math.min(road.length, Math.max(0, x)) };
}

/** If you're standing at a junction, where it leads (open or not). Otherwise undefined. */
export function junctionFrom(world: World, at: Place): Crossing | undefined {
  for (const { a, b, opensWhenMended } of world.junctions) {
    if (isNear(a, at)) return { leadsTo: b, opensWhenMended };
    if (isNear(b, at)) return { leadsTo: a, opensWhenMended };
  }
  return undefined;
}

/**
 * Whether you can step through. `isMended` answers for a trouble's id; the
 * server and the screen each ask their own copy of the state.
 */
export function isOpen(crossing: Crossing, isMended: (troubleId: string) => boolean): boolean {
  return crossing.opensWhenMended === undefined || isMended(crossing.opensWhenMended);
}

/** The trouble you're standing next to, if any. */
export function troubleAt(world: World, at: Place): Trouble | undefined {
  return world.troubles.find((t) => isNear(t.at, at));
}

/**
 * Where someone sits with a trouble, as an x on its road: the first seat to the
 * left of it, the next to the right, then further out on each side. Seats go in
 * order of name, so the server and every screen put everyone in the same seat.
 */
export function seatFor(world: World, trouble: Trouble, band: readonly string[], name: string): number {
  const seat = [...band].sort().indexOf(name);
  const side = seat % 2 === 0 ? -1 : 1;
  const row = Math.floor(seat / 2);
  const x = trouble.at.x + side * (SEAT_GAP + row * ROW_GAP);
  return Math.min(findRoad(world, trouble.at.road).length, Math.max(0, x));
}

/** The resident close enough to hear, if any. */
export function residentNear(world: World, at: Place): Resident | undefined {
  return world.residents.find((r) => isNear(r.at, at, EARSHOT));
}

function isNear(place: Place, at: Place, distance = REACH): boolean {
  return place.road === at.road && Math.abs(place.x - at.x) <= distance;
}
