import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { firstSlice } from "../rules/firstSlice";
import { REACH, type Place } from "../rules/world";
import { server } from "./main";
import { NEEDS } from "./needs";
import { WorldRoom } from "./WorldRoom";

/**
 * These tests run the real server and connect real clients to it, the way
 * browsers do. They check what the rule tests can't: that the server turns
 * requests into rounds properly, with more than one player.
 */

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(server);
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  WorldRoom.roundSeconds = 20;
  // The tests never ask the real magenta: every road's Mood is quiet unless a test says otherwise.
  WorldRoom.readTurns = async () => [];
  WorldRoom.listenMs = 4000;
});

const fiddle = firstSlice.troubles.find((t) => t.id === "lifted-bridge")!;
const banjo = firstSlice.troubles.find((t) => t.id === "fifth-string")!;
const gate = firstSlice.junctions.find((j) => j.opensWhenMended === fiddle.id)!;

/** Start a world and bring players into it, by name. */
async function startWorld(...names: string[]) {
  const room = (await colyseus.createRoom("world")) as WorldRoom;
  const players = [];
  for (const name of names) players.push(await colyseus.connectTo(room, { name }));
  return { room, players };
}

/** Walking the whole way takes seconds, so the tests put players where they need to be. */
function putAt(room: WorldRoom, sessionId: string, place: Place) {
  const player = room.state.players.get(sessionId)!;
  player.road = place.road;
  player.x = place.x;
}

/** Send a request and wait until the server has dealt with it. */
async function ask(room: WorldRoom, client: { send: (type: string, message?: unknown) => void }, type: string, message?: unknown) {
  client.send(type, message);
  await room.waitForNextMessage();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("the server", () => {
  it("lets a band of two mend the fiddle, and credits them both", async () => {
    const { room, players } = await startWorld("justin", "fibonacci");
    const [justin, fibonacci] = players;
    for (const p of players) {
      putAt(room, p.sessionId, fiddle.at);
      await ask(room, p, "sitDown");
      await ask(room, p, "play", "listen");
    }

    for (let round = 0; round < 5 && room.state.mendings.get(fiddle.id)!.discord > 0; round++) {
      await ask(room, justin, "play", "backUp");
      await ask(room, fibonacci, "play", "takeBreak");
    }

    const mending = room.state.mendings.get(fiddle.id)!;
    expect(mending.discord).toBe(0);
    expect([...mending.playedBy]).toEqual(["justin", "fibonacci"]);
    expect(mending.story).toContain("It's mended.");
    // Nobody is left sitting with a thing that's mended, and everyone stands
    // up in their own seat: not on top of the fiddle, and not on each other.
    const standing = [...room.state.players.values()];
    expect(standing.every((p) => p.sittingWith === "")).toBe(true);
    expect(standing.every((p) => Math.abs(p.x - fiddle.at.x) > REACH)).toBe(true);
    expect(new Set(standing.map((p) => p.x)).size).toBe(2);
  });

  it("waits for everyone, then plays the round without whoever didn't choose", async () => {
    WorldRoom.roundSeconds = 0.2;
    const { room, players } = await startWorld("justin", "fibonacci");
    const [justin, fibonacci] = players;
    for (const p of players) {
      putAt(room, p.sessionId, fiddle.at);
      await ask(room, p, "sitDown");
    }

    await ask(room, justin, "play", "listen");
    const mending = room.state.mendings.get(fiddle.id)!;
    expect(mending.countdown).toBeGreaterThan(0);
    expect(mending.trust).toBe(0);

    await wait(500);
    expect(mending.trust).toBe(20);
    expect([...mending.playedBy]).toEqual(["justin"]);
    expect(room.state.players.get(fibonacci.sessionId)!.sittingWith).toBe(fiddle.id);
  });

  it("doesn't let a player who leaves hold up the round", async () => {
    const { room, players } = await startWorld("justin", "fibonacci");
    const [justin, fibonacci] = players;
    for (const p of players) {
      putAt(room, p.sessionId, fiddle.at);
      await ask(room, p, "sitDown");
    }
    await ask(room, justin, "play", "listen");

    await fibonacci.leave();
    await wait(100);
    expect(room.state.mendings.get(fiddle.id)!.trust).toBe(20);
  });

  it("keeps what a thing needs to itself until the band has heard it", async () => {
    const { room, players } = await startWorld("justin", "fibonacci");
    const mending = room.state.mendings.get(fiddle.id)!;
    for (const p of players) {
      putAt(room, p.sessionId, fiddle.at);
      await ask(room, p, "sitDown");
    }
    expect(mending.need).toBe("");

    for (const p of players) await ask(room, p, "play", "listen");
    expect(mending.need).toBe(NEEDS[fiddle.id]);
  });

  it("knows what every trouble needs", () => {
    for (const trouble of firstSlice.troubles) expect(NEEDS[trouble.id], trouble.id).toBeTruthy();
  });

  it("opens the way to #chartifacts once the fiddle is mended, for everybody", async () => {
    const { room, players } = await startWorld("skyler");
    const [skyler] = players;
    const player = room.state.players.get(skyler.sessionId)!;

    putAt(room, skyler.sessionId, gate.a);
    await ask(room, skyler, "step");
    expect(player.road).toBe(gate.a.road);

    room.state.mendings.get(fiddle.id)!.discord = 0; // as if a band had just mended it
    await ask(room, skyler, "step");
    expect(player.road).toBe(gate.b.road);
  });

  it("treats a name as just a name, even one that's special to JavaScript", async () => {
    const { room, players } = await startWorld("__proto__");
    const [player] = players;
    putAt(room, player.sessionId, banjo.at);
    await ask(room, player, "sitDown");
    await ask(room, player, "play", "listen");
    expect(room.state.mendings.get(banjo.id)!.trust).toBe(20);
    expect(room.state.players.get(player.sessionId)!.move).toBe("");
  });

  it("only lets you sit down where something is out of sorts", async () => {
    const { room, players } = await startWorld("skyler");
    const [skyler] = players;
    await ask(room, skyler, "sitDown");
    expect(room.state.players.get(skyler.sessionId)!.sittingWith).toBe("");
  });

  it("turns away a walk that isn't a direction", async () => {
    const { room, players } = await startWorld("skyler");
    const [skyler] = players;
    const player = room.state.players.get(skyler.sessionId)!;

    await ask(room, skyler, "walk", NaN);
    await ask(room, skyler, "walk", "left");
    expect(player.walking).toBe(0);

    await ask(room, skyler, "walk", 7);
    expect(player.walking).toBe(1);
  });

  it("gives two players with the same name different names", async () => {
    const { room } = await startWorld("fibonacci", "fibonacci");
    expect([...room.state.players.values()].map((p) => p.name)).toEqual(["fibonacci", "fibonacci-2"]);
  });

  it("tidies a name before showing it to everyone", async () => {
    const { room } = await startWorld("  rj\n\nwith   spaces ", "a".repeat(40), "");
    expect([...room.state.players.values()].map((p) => p.name)).toEqual(["rj with spaces", "a".repeat(24), "wanderer"]);
  });

  it("brings what's said in a road's Mood onto that road, and only that one", async () => {
    const said: Record<string, { id: string; sender: string; is_human: boolean; created_at: string; text: string }[]> = {
      magentoid: [{ id: "a", sender: "justin", is_human: true, created_at: "2026-11-06T17:20:00Z", text: "**live** from the Mood" }],
      rabbithole: [{ id: "b", sender: "blu", is_human: false, created_at: "2026-11-06T17:21:00Z", text: "nobody's here to hear this" }],
    };
    WorldRoom.readTurns = async (slug, after) => {
      const turns = said[slug] ?? [];
      const i = turns.findIndex((t) => t.id === after);
      return after ? turns.slice(i + 1) : turns;
    };
    WorldRoom.listenMs = 50;
    const { room } = await startWorld("justin");
    await wait(150);

    const lines = () => [...(room.state.talk.get(firstSlice.start.road)?.lines ?? [])].map((l) => `${l.who}: ${l.text}`);
    expect(lines()).toEqual(["justin: live from the Mood"]);
    // Nobody's on #rabbithole, so nobody asks it anything.
    expect(room.state.talk.has("rabbithole")).toBe(false);

    said.magentoid.push({ id: "c", sender: "magent", is_human: false, created_at: "2026-11-06T17:22:00Z", text: "and here's the next" });
    await wait(150);
    expect(lines()).toEqual(["justin: live from the Mood", "magent: and here's the next"]);
  });

  it("keeps the game going when magenta can't be reached", async () => {
    WorldRoom.readTurns = async () => {
      throw new Error("magenta is down");
    };
    WorldRoom.listenMs = 50;
    const { room, players } = await startWorld("justin");
    await wait(150);
    await ask(room, players[0], "walk", 1);
    await wait(100);
    expect(room.state.players.get(players[0].sessionId)!.x).toBeGreaterThan(firstSlice.start.x);
  });
});
