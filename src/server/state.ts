import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * The shared state: everything that changes while people play.
 *
 * Colyseus watches these objects and sends each change to every player
 * automatically. Only the server ever writes to them. A player's client
 * reads them and draws; when the player does something, the client *asks*
 * the server (see WorldRoom.ts), and the server decides.
 *
 * What never changes (roads, junctions, where each trouble sits) isn't here.
 * It's in the world (rules/firstSlice.ts), which the server and every client
 * already have.
 *
 * Every field has a default. A field without one starts out `undefined`, and
 * `undefined + 1` is NaN, which is how the first players walked off the map.
 */

export const Player = schema(
  {
    name: t.string().default(""),
    road: t.string().default(""),
    x: t.number().default(0),
    /** Which way they're walking: -1, 0 or 1. */
    walking: t.number().default(0),
    /** The trouble they've sat down with, or "" if none. */
    sittingWith: t.string().default(""),
    /** Their move for this round, or "" while they're still choosing. */
    move: t.string().default(""),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

/** One trouble's Session, and how its current round is going. */
export const Mending = schema(
  {
    // These mirror `Session` in rules/session.ts.
    thing: t.string().default(""),
    need: t.string().default(""),
    discord: t.number().default(0),
    trust: t.number().default(0),
    needsBand: t.boolean().default(false),
    playedBy: t.array("string"),

    /** What happened in the last round, in words. */
    story: t.array("string"),
    /** Seconds left before the round is played without whoever hasn't chosen. 0 when nobody's waiting. */
    countdown: t.number().default(0),
  },
  "Mending",
);
export type Mending = SchemaType<typeof Mending>;

export const WorldState = schema(
  {
    /** By Colyseus session id. */
    players: t.map(Player),
    /** By trouble id. */
    mendings: t.map(Mending),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
