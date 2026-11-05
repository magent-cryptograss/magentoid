import { Room, type Client } from "colyseus";
import { firstSlice } from "../rules/firstSlice";
import { MOVES, isMended, isNeedHeard, playRound, startSession, type Move, type Session } from "../rules/session";
import { findTrouble, isOpen, junctionFrom, seatFor, troubleAt, walk, type Trouble } from "../rules/world";
import { NEEDS } from "./needs";
import { Mending, Player, WorldState } from "./state";

const world = firstSlice;

/** How often the server moves walking players and runs countdowns, in milliseconds. */
const TICK_MS = 50;

/**
 * A browser sends a message when a key goes down or comes up, which is a few
 * a second at most. Many more than this is a broken client, or a hostile one,
 * and Colyseus disconnects it.
 */
const MAX_MESSAGES_PER_SECOND = 30;

/**
 * One shared world that everyone walks around in together.
 *
 * Clients send *requests* ("I'd like to walk right", "I play a Tune"). The
 * server checks each one against the rules and only then changes the state.
 * A client can send anything at all, so nothing it sends is trusted as-is.
 */
export class WorldRoom extends Room<{ state: WorldState }> {
  /**
   * Once somebody in a band has chosen a move, how long the others get to
   * choose theirs, in seconds. Then the round is played without them, so one
   * player who wandered off can't hold up everyone else. (Tests shorten it.)
   */
  static roundSeconds = 20;

  state = new WorldState();
  maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND;

  onCreate() {
    for (const trouble of world.troubles) {
      const mending = new Mending();
      writeSession(mending, trouble, startSession(trouble));
      this.state.mendings.set(trouble.id, mending);
    }

    this.setTimestep((ms) => this.tick(ms / 1000), TICK_MS);

    this.onMessage("walk", (client, direction: unknown) => {
      const player = this.playerOf(client);
      // NaN is a number too, and it would put the player nowhere at all.
      if (typeof direction !== "number" || !Number.isFinite(direction) || player.sittingWith) return;
      player.walking = Math.sign(direction);
    });

    this.onMessage("step", (client) => {
      const player = this.playerOf(client);
      if (player.sittingWith) return;
      const crossing = junctionFrom(world, { road: player.road, x: player.x });
      if (!crossing || !isOpen(crossing, (id) => this.isMendedNow(id))) return;
      player.road = crossing.leadsTo.road;
      player.x = crossing.leadsTo.x;
    });

    this.onMessage("sitDown", (client) => {
      const player = this.playerOf(client);
      const trouble = troubleAt(world, { road: player.road, x: player.x });
      if (!trouble || this.isMendedNow(trouble.id)) return;
      player.walking = 0;
      player.sittingWith = trouble.id;
      player.move = "";
      this.checkRound(trouble.id);
    });

    // You can change your mind until the round is played.
    this.onMessage("play", (client, move: unknown) => {
      const player = this.playerOf(client);
      if (!player.sittingWith || !isMove(move)) return;
      player.move = move;
      this.checkRound(player.sittingWith);
    });

    // "Set it down": walk away. Nothing is lost, and the round goes on without you.
    this.onMessage("getUp", (client) => {
      const player = this.playerOf(client);
      const troubleId = player.sittingWith;
      if (!troubleId) return;
      this.standUp(player, findTrouble(world, troubleId), this.bandAt(troubleId));
      this.checkRound(troubleId);
    });
  }

  onJoin(client: Client, options: { name?: unknown }) {
    const player = new Player();
    player.name = this.uniqueName(cleanName(options?.name));
    player.road = world.start.road;
    // New arrivals stand a little apart, so nobody appears on top of anybody else.
    player.x = world.start.x + (this.state.players.size % 5) * 40;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    const troubleId = this.playerOf(client).sittingWith;
    this.state.players.delete(client.sessionId);
    if (troubleId) this.checkRound(troubleId);
  }

  private tick(seconds: number) {
    this.moveWalkers(seconds);
    this.runCountdowns(seconds);
  }

  private moveWalkers(seconds: number) {
    this.state.players.forEach((player) => {
      if (player.walking === 0) return;
      player.x = walk(world, { road: player.road, x: player.x }, player.walking, seconds).x;
    });
  }

  private runCountdowns(seconds: number) {
    this.state.mendings.forEach((mending, troubleId) => {
      if (mending.countdown === 0) return;
      mending.countdown = Math.max(0, mending.countdown - seconds);
      if (mending.countdown === 0) this.finishRound(troubleId);
    });
  }

  /**
   * Whenever someone in a band chooses, sits down or gets up: play the round
   * if everyone has chosen, or start the countdown if only some have.
   */
  private checkRound(troubleId: string) {
    const mending = this.state.mendings.get(troubleId)!;
    const band = this.bandAt(troubleId);
    const chosen = band.filter((p) => p.move !== "");

    if (chosen.length === 0) mending.countdown = 0;
    else if (chosen.length === band.length) this.finishRound(troubleId);
    else if (mending.countdown === 0) mending.countdown = WorldRoom.roundSeconds;
  }

  /** Play the round with everyone who has chosen. Whoever hasn't sits this one out. */
  private finishRound(troubleId: string) {
    const trouble = findTrouble(world, troubleId);
    const mending = this.state.mendings.get(troubleId)!;
    const band = this.bandAt(troubleId);
    mending.countdown = 0;

    // Moves are kept by name. An object made with `{}` has names of its own that
    // JavaScript treats specially: give it "__proto__" and nothing is stored, and
    // a player who called themselves that would wait for their round forever.
    // An object made from null has no names but the ones we put in it.
    const moves: Record<string, Move> = Object.create(null);
    for (const player of band) if (isMove(player.move)) moves[player.name] = player.move;
    if (Object.keys(moves).length === 0) return;

    const round = playRound(readSession(mending, trouble), moves);
    writeSession(mending, trouble, round.session);
    mending.story.clear();
    mending.story.push(...round.story);

    for (const player of band) {
      // Once it's mended there's nothing left to sit with, so everyone stands up.
      if (isMended(round.session)) this.standUp(player, trouble, band);
      else player.move = "";
    }
  }

  /**
   * Stand up from a trouble, right where you sat. The screen draws a sitting
   * player in their seat, so standing anywhere else would make them jump, and
   * a whole band standing at once would land on top of the thing and each other.
   */
  private standUp(player: Player, trouble: Trouble, band: Player[]) {
    player.x = seatFor(world, trouble, band.map((p) => p.name), player.name);
    player.sittingWith = "";
    player.move = "";
  }

  private bandAt(troubleId: string): Player[] {
    return [...this.state.players.values()].filter((p) => p.sittingWith === troubleId);
  }

  private isMendedNow(troubleId: string): boolean {
    return isMended(this.state.mendings.get(troubleId)!);
  }

  private playerOf(client: Client): Player {
    return this.state.players.get(client.sessionId)!;
  }

  /** Names are how a mend is credited, so two players can't share one. */
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

/** A name as someone typed it, made safe to show to everyone else. */
function cleanName(value: unknown): string {
  if (typeof value !== "string") return "wanderer";
  const name = value
    .replace(/\p{Cc}/gu, " ") // control characters, like newlines, would break the label
    .replace(/\s+/g, " ")
    .trim();
  // Spreading a string splits it into whole characters, so an emoji isn't cut in half.
  return [...name].slice(0, 24).join("") || "wanderer";
}

/** The Session as the rules see it: the numbers from the state, and whether it needs a band from the world. */
function readSession(mending: Mending, trouble: Trouble): Session {
  return {
    discord: mending.discord,
    trust: mending.trust,
    needsBand: trouble.needsBand,
    playedBy: [...mending.playedBy],
  };
}

/** Put a Session into the shared state, where every player sees it. */
function writeSession(mending: Mending, trouble: Trouble, session: Session) {
  mending.discord = session.discord;
  mending.trust = session.trust;
  mending.playedBy.clear();
  mending.playedBy.push(...session.playedBy);
  // The need goes out only once the band has heard it. If a flat break costs
  // them the Trust, it goes quiet again until they've listened their way back.
  mending.need = isNeedHeard(session) ? NEEDS[trouble.id] : "";
}
