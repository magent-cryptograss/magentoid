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
}

/** Something out of sorts, sitting at a place, waiting for a Session. */
export interface Trouble {
  readonly id: string;
  readonly at: Place;
  /** How it's drawn. */
  readonly looks: "fiddle" | "banjo" | "chart";
  readonly thing: string;
  readonly need: string;
  readonly discord: number;
  readonly needsBand: boolean;
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

export function findRoad(world: World, id: string): Road {
  const road = world.roads.find((r) => r.id === id);
  if (!road) throw new Error(`No road called "${id}"`);
  return road;
}

/** Walk along a road. `direction` is -1 (left), 0 (stand still) or 1 (right). */
export function walk(world: World, at: Place, direction: number, seconds: number): Place {
  const road = findRoad(world, at.road);
  const x = at.x + Math.sign(direction) * WALK_SPEED * seconds;
  return { road: at.road, x: Math.min(road.length, Math.max(0, x)) };
}

/** If you're standing at a junction, where it leads. Otherwise undefined. */
export function junctionFrom(world: World, at: Place): Place | undefined {
  for (const { a, b } of world.junctions) {
    if (isNear(a, at)) return b;
    if (isNear(b, at)) return a;
  }
  return undefined;
}

/** The trouble you're standing next to, if any. */
export function troubleAt(world: World, at: Place): Trouble | undefined {
  return world.troubles.find((t) => isNear(t.at, at));
}

/** The resident close enough to hear, if any. */
export function residentNear(world: World, at: Place): Resident | undefined {
  return world.residents.find((r) => isNear(r.at, at, EARSHOT));
}

function isNear(place: Place, at: Place, distance = REACH): boolean {
  return place.road === at.road && Math.abs(place.x - at.x) <= distance;
}
