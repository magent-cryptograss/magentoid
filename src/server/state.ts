import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * The shared state: everything every player's screen needs to see.
 *
 * Colyseus watches these objects and sends each change to every player
 * automatically. Only the server ever writes to them. A player's client
 * reads them and draws; when the player does something, the client *asks*
 * the server (see WorldRoom.ts), and the server decides.
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

/** One trouble, and how its Session is going. Mirrors `Session` in rules/session.ts. */
export const Mending = schema(
  {
    thing: t.string().default(""),
    need: t.string().default(""),
    discord: t.number().default(0),
    trust: t.number().default(0),
    needsBand: t.boolean().default(false),
    mendedBy: t.array("string"),
    road: t.string().default(""),
    x: t.number().default(0),
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
