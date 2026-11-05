import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { firstSlice } from "../rules/firstSlice";
import type { Place } from "../rules/world";
import { server } from "./main";
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
});

const fiddle = firstSlice.troubles.find((t) => t.id === "lifted-bridge")!;

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
    // Nobody is left sitting with a thing that's mended.
    expect([...room.state.players.values()].every((p) => p.sittingWith === "")).toBe(true);
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
});
