import type Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { isNeedHeard } from "../rules/session";
import { EARSHOT, REACH, junctionFrom, residentNear, troubleAt, type World } from "../rules/world";
import type { Player, WorldState } from "../server/state";

/**
 * A window onto the machinery, for anyone learning how the game works.
 * Press ` (backtick), click "debug" at the top of the page, or open the
 * game with ?debug in the address.
 *
 * It's plain HTML beside the game, not part of the Phaser scene, so it can't
 * change what the scene draws, and its words stay sharp at any size.
 *
 * The thing to watch is the gap between two numbers: where the *server* says
 * you are (`x`, from room.state), and where your *browser* has drawn you
 * (`drawn x`). The server is the truth; the browser eases toward it. See
 * docs/how-its-built.md for what each line means.
 */

/** What only the scene knows, handed over every frame. */
export interface SceneView {
  me: Player;
  /** Where your figure is drawn this frame. */
  drawnX: number | undefined;
  /** The walking direction the scene last asked the server for. */
  askedToWalk: number;
  /** The left edge of what the camera shows, in road pixels. */
  cameraX: number;
}

/** How often the words are rewritten, in milliseconds. Every frame would be too fast to read. */
const REFRESH_MS = 150;
/** How often to measure the round trip to the server, in milliseconds. */
const PING_MS = 2000;

export class DebugPanel {
  private readonly box: HTMLPreElement;
  private lastWritten = 0;

  // Counted as they happen; turned into per-second rates once a second.
  private patches = 0;
  private sentThisSecond = 0;
  private patchesPerSecond = 0;
  private sentPerSecond = 0;
  private sentInAll = 0;
  private lastSent = "nothing yet";
  private pingMs: number | undefined;

  constructor(
    private readonly room: Room<any, WorldState>,
    private readonly world: World,
    private readonly game: Phaser.Game,
  ) {
    this.box = document.getElementById("debug") as HTMLPreElement;
    this.box.hidden = !new URLSearchParams(location.search).has("debug");

    window.addEventListener("keydown", (event) => {
      if (event.key === "`" && !event.repeat) this.toggle();
    });
    document.getElementById("debug-toggle")?.addEventListener("click", (event) => {
      this.toggle();
      // Let go of the button, or the next Space would press it again instead of sitting you down.
      (event.currentTarget as HTMLElement).blur();
    });

    // Each time a patch of changes arrives from the server, Colyseus calls this.
    room.onStateChange(() => this.patches++);
    setInterval(() => {
      this.patchesPerSecond = this.patches;
      this.sentPerSecond = this.sentThisSecond;
      this.patches = this.sentThisSecond = 0;
    }, 1000);
    setInterval(() => {
      if (!this.box.hidden) this.room.ping((ms) => (this.pingMs = ms));
    }, PING_MS);
  }

  toggle() {
    this.box.hidden = !this.box.hidden;
  }

  /** The scene calls this for every message it sends, so they can be counted. */
  sent(type: string, message?: unknown) {
    this.sentThisSecond++;
    this.sentInAll++;
    this.lastSent = message === undefined ? type : `${type} ${JSON.stringify(message)}`;
  }

  update(view: SceneView) {
    if (this.box.hidden || performance.now() - this.lastWritten < REFRESH_MS) return;
    this.lastWritten = performance.now();
    this.box.textContent = this.lines(view).join("\n");
  }

  private lines({ me, drawnX, askedToWalk, cameraX }: SceneView): string[] {
    const crossing = junctionFrom(this.world, me);
    const trouble = troubleAt(this.world, me);
    const resident = residentNear(this.world, me);
    const lines = [
      "MAGENTOID DEBUG  (` to hide)",
      "",
      "— frame (Phaser) —",
      `fps            ${this.game.loop.actualFps.toFixed(0)}`,
      `renderer       ${this.game.renderer.type === 2 ? "WebGL" : "Canvas"}`,
      `camera left    ${Math.round(cameraX)}`,
      "",
      "— connection (Colyseus) —",
      `room           ${this.room.roomId}`,
      `you            ${this.room.sessionId}`,
      `ping           ${this.pingMs === undefined ? "…" : `${this.pingMs} ms`}`,
      `patches in     ${this.patchesPerSecond}/s`,
      `messages out   ${this.sentPerSecond}/s, ${this.sentInAll} in all (server allows 30/s)`,
      `last sent      ${this.lastSent}`,
      "",
      "— you, as the server has it —",
      `name           ${me.name}`,
      `road           ${me.road}`,
      `x              ${me.x.toFixed(1)}`,
      `walking        ${me.walking}   (asked for ${askedToWalk})`,
      `drawn x        ${drawnX === undefined ? "—" : `${drawnX.toFixed(1)}   (gap ${(me.x - drawnX).toFixed(1)})`}`,
      `sitting with   ${me.sittingWith || "—"}`,
      `move           ${me.move || "—"}`,
      "",
      "— what's near (rules/world.ts) —",
      `junction       ${crossing ? `→ ${crossing.leadsTo.road} @ ${crossing.leadsTo.x}` : "—"}   (reach ±${REACH})`,
      `trouble        ${trouble ? trouble.id : "—"}   (reach ±${REACH})`,
      `resident       ${resident ? resident.name : "—"}   (earshot ±${EARSHOT})`,
    ];

    if (me.sittingWith) {
      const mending = this.room.state.mendings.get(me.sittingWith);
      if (mending) {
        lines.push(
          "",
          `— ${me.sittingWith} (room.state.mendings) —`,
          `discord        ${mending.discord.toFixed(1)}`,
          `trust          ${mending.trust.toFixed(1)}   (need heard: ${isNeedHeard(mending) ? "yes" : "no"})`,
          `countdown      ${mending.countdown || "—"}`,
          `played by      ${[...mending.playedBy].join(", ") || "—"}`,
        );
      }
    }

    lines.push("", "— everyone (room.state.players) —");
    this.room.state.players.forEach((p, id) => {
      const flags = [p.walking ? `walking ${p.walking}` : "", p.sittingWith ? `with ${p.sittingWith}` : "", p.move].filter(Boolean);
      lines.push(`${id === this.room.sessionId ? "*" : " "} ${p.name.padEnd(14)} ${p.road}:${Math.round(p.x)}  ${flags.join(", ")}`);
    });
    return lines;
  }
}
