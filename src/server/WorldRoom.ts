import { Room, type Client } from "colyseus";
import { firstSlice } from "../rules/firstSlice";
import { MOVES, isMended, playRound, startSession, type Move, type Session } from "../rules/session";
import { junctionFrom, troubleAt, walk } from "../rules/world";
import { Mending, Player, WorldState } from "./state";

const world = firstSlice;

/** How often the server moves walking players, in milliseconds. */
const TICK_MS = 50;

/**
 * One shared world that everyone walks around in together.
 *
 * Clients send *requests* ("I'd like to walk right", "I play a Tune"). The
 * server checks each one against the rules and only then changes the state.
 * A client can send anything at all, so nothing it sends is trusted as-is.
 */
export class WorldRoom extends Room<{ state: WorldState }> {
  state = new WorldState();

  onCreate() {
    for (const trouble of world.troubles) {
      const session = startSession(trouble.thing, trouble.need, trouble.discord, trouble.needsBand);
      const mending = new Mending();
      mending.road = trouble.at.road;
      mending.x = trouble.at.x;
      writeSession(mending, session);
      this.state.mendings.set(trouble.id, mending);
    }

    this.setTimestep((ms) => this.moveWalkers(ms / 1000), TICK_MS);

    this.onMessage("walk", (client, direction: unknown) => {
      const player = this.playerOf(client);
      if (typeof direction !== "number" || player.sittingWith) return;
      player.walking = Math.sign(direction);
    });

    this.onMessage("step", (client) => {
      const player = this.playerOf(client);
      if (player.sittingWith) return;
      const there = junctionFrom(world, { road: player.road, x: player.x });
      if (!there) return;
      player.road = there.road;
      player.x = there.x;
    });

    this.onMessage("sitDown", (client) => {
      const player = this.playerOf(client);
      const trouble = troubleAt(world, { road: player.road, x: player.x });
      if (!trouble || isMended(readSession(this.state.mendings.get(trouble.id)!))) return;
      player.walking = 0;
      player.sittingWith = trouble.id;
      player.move = "";
    });

    this.onMessage("play", (client, move: unknown) => {
      const player = this.playerOf(client);
      if (!player.sittingWith || !isMove(move)) return;
      player.move = move;
      this.playRoundIfReady(player.sittingWith);
    });

    // "Set it down": walk away. Nothing is lost, and the round goes on without you.
    this.onMessage("getUp", (client) => {
      const player = this.playerOf(client);
      const troubleId = player.sittingWith;
      player.sittingWith = "";
      player.move = "";
      if (troubleId) this.playRoundIfReady(troubleId);
    });
  }

  onJoin(client: Client, options: { name?: unknown }) {
    const player = new Player();
    player.name = this.uniqueName(cleanName(options?.name));
    player.road = world.start.road;
    player.x = world.start.x;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    const troubleId = this.playerOf(client).sittingWith;
    this.state.players.delete(client.sessionId);
    if (troubleId) this.playRoundIfReady(troubleId);
  }

  private moveWalkers(seconds: number) {
    this.state.players.forEach((player) => {
      if (player.walking === 0) return;
      player.x = walk(world, { road: player.road, x: player.x }, player.walking, seconds).x;
    });
  }

  /** A round is played once everyone sitting with the trouble has chosen a move. */
  private playRoundIfReady(troubleId: string) {
    const band = [...this.state.players.values()].filter((p) => p.sittingWith === troubleId);
    if (band.length === 0 || band.some((p) => p.move === "")) return;

    const moves: Record<string, Move> = {};
    for (const p of band) moves[p.name] = p.move as Move;

    const mending = this.state.mendings.get(troubleId)!;
    const after = playRound(readSession(mending), moves);
    writeSession(mending, after);

    for (const p of band) {
      p.move = "";
      if (isMended(after)) p.sittingWith = "";
    }
  }

  private playerOf(client: Client): Player {
    return this.state.players.get(client.sessionId)!;
  }

  /** Names are how a mend is remembered, so two players can't share one. */
  private uniqueName(wanted: string): string {
    const taken = new Set([...this.state.players.values()].map((p) => p.name));
    let name = wanted;
    for (let n = 2; taken.has(name); n++) name = `${wanted}-${n}`;
    return name;
  }
}

function isMove(value: unknown): value is Move {
  return MOVES.includes(value as Move);
}

function cleanName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().slice(0, 24) : "";
  return name || "wanderer";
}

function readSession(m: Mending): Session {
  return {
    thing: m.thing,
    need: m.need,
    discord: m.discord,
    trust: m.trust,
    needsBand: m.needsBand,
    mendedBy: [...m.mendedBy],
  };
}

function writeSession(m: Mending, s: Session) {
  m.thing = s.thing;
  m.need = s.need;
  m.discord = s.discord;
  m.trust = s.trust;
  m.needsBand = s.needsBand;
  m.mendedBy.clear();
  m.mendedBy.push(...s.mendedBy);
}
