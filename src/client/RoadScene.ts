import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { MOVES, isMended, type Move } from "../rules/session";
import { findRoad, findTrouble, isOpen, junctionFrom, residentNear, seatFor, troubleAt, type Crossing, type World } from "../rules/world";
import type { Player, WorldState } from "../server/state";
import { Figure, ResidentFigure, stackNames } from "./figures";
import { GROUND_Y, MAGENTA, SCREEN_H, SCREEN_W, colourFor, lettering } from "./look";
import { JunctionDrawing, drawBackdrop } from "./scenery";
import { SessionPanel } from "./SessionPanel";
import { TroubleDrawing } from "./troubles";
import { DebugPanel } from "./DebugPanel";
import { TalkPanel } from "./TalkPanel";

/** The number keys that play each move, in the same order as MOVES. */
const MOVE_KEYS = ["ONE", "TWO", "THREE", "FOUR"];

/**
 * The road you're standing on, and everyone on it with you.
 *
 * This scene never decides anything. Every frame it reads the shared state
 * the server sends (`room.state`) and draws it. When you press a key, it sends
 * the server a request, and the result shows up in the state a moment later.
 */
export class RoadScene extends Phaser.Scene {
  private arrows!: Phaser.Types.Input.Keyboard.CursorKeys;
  private panel!: SessionPanel;
  private hint!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private debug!: DebugPanel;
  private talk!: TalkPanel;

  /** The road we last drew, so we know when to draw a new one. */
  private drawnRoad = "";
  private scenery: Phaser.GameObjects.GameObject[] = [];
  private figures = new Map<string, Figure>();
  private troubles = new Map<string, TroubleDrawing>();
  private residents: ResidentFigure[] = [];
  /** The junctions on this road, each with the way it leads from here. */
  private junctions: { drawing: JunctionDrawing; crossing: Crossing }[] = [];
  /** The last walking direction we asked for, so we only send changes. */
  private askedToWalk = 0;
  /** Each trouble's Discord as we last saw it, to notice the moment one is mended. */
  private lastDiscord = new Map<string, number>();

  constructor(
    private readonly room: Room<any, WorldState>,
    private readonly world: World,
  ) {
    super("road");
  }

  create() {
    const keyboard = this.input.keyboard!;
    this.arrows = keyboard.createCursorKeys();

    // Each press is handled the moment it happens, by what you're doing right then.
    this.onPress("UP", () => this.step());
    this.onPress("DOWN", () => this.step());
    this.onPress("SPACE", () => this.sitDown());
    this.onPress("ESC", () => this.getUp());
    MOVES.forEach((move, i) => this.onPress(MOVE_KEYS[i], () => this.play(move)));

    // If the window loses focus while you hold an arrow, the browser never says
    // the key came up, and you'd walk on forever. So let go of every key.
    this.game.events.on(Phaser.Core.Events.BLUR, () => keyboard.resetKeys());
    this.game.events.on(Phaser.Core.Events.HIDDEN, () => keyboard.resetKeys());

    this.debug = new DebugPanel(this.room, this.world, this.game);
    this.panel = new SessionPanel(this);
    this.talk = new TalkPanel(this, this.world);
    this.hint = this.add.text(SCREEN_W / 2, 515, "", lettering(17)).setOrigin(0.5).setScrollFactor(0).setDepth(10);
    this.toast = this.add
      .text(SCREEN_W / 2, 120, "", lettering(24, { color: MAGENTA, backgroundColor: "#120a1a", padding: { x: 16, y: 10 }, align: "center" }))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(11)
      .setVisible(false);
  }

  update(time: number, delta: number) {
    const me = this.me();
    if (!me) return; // the first state hasn't arrived yet

    if (me.road !== this.drawnRoad) this.drawRoad(me.road);
    this.walk(me);
    this.drawPlayers(delta);
    this.drawTroubles(time);
    for (const { drawing, crossing } of this.junctions) drawing.show(isOpen(crossing, this.isMendedNow));
    for (const resident of this.residents) {
      resident.heard(residentNear(this.world, me)?.name === resident.name);
    }
    stackNames([...this.figures.values(), ...this.residents.map((r) => r.figure)]);
    this.cameras.main.centerOnX(this.figures.get(this.room.sessionId)?.x ?? me.x);

    const trouble = me.sittingWith ? findTrouble(this.world, me.sittingWith) : undefined;
    const mending = trouble ? this.room.state.mendings.get(trouble.id) : undefined;
    this.panel.show(trouble, mending, this.bandAt(me.sittingWith), me);
    this.talk.show(me.road, this.room.state.talk?.get(me.road), !!me.sittingWith);
    this.hint.setText(this.hintFor(me));
    this.debug.update({
      me,
      drawnX: this.figures.get(this.room.sessionId)?.x,
      askedToWalk: this.askedToWalk,
      cameraX: this.cameras.main.scrollX,
    });
  }

  /** Ask the server for something. Every request goes through here, so the debug panel can count them. */
  private ask(type: string, message?: unknown) {
    this.room.send(type, message);
    this.debug.sent(type, message);
  }

  private me(): Player | undefined {
    return this.room.state.players?.get(this.room.sessionId);
  }

  /**
   * Whether a trouble is mended, as far as the latest state from the server
   * says. Written as an arrow function so it can be handed to `isOpen` as it
   * is: an ordinary method would forget which scene `this` is.
   */
  private isMendedNow = (troubleId: string): boolean => {
    const mending = this.room.state.mendings.get(troubleId);
    return mending !== undefined && isMended(mending);
  };

  /** Call `action` when `key` goes down, but not again while it's held. */
  private onPress(key: string, action: () => void) {
    this.input.keyboard!.on(`keydown-${key}`, (event: KeyboardEvent) => {
      if (!event.repeat) action();
    });
  }

  /** Walking is held, not pressed, so it's read every frame. We only tell the server when it changes. */
  private walk(me: Player) {
    const held = (this.arrows.right.isDown ? 1 : 0) - (this.arrows.left.isDown ? 1 : 0);
    // Sitting down, you're not walking, whatever you hold. Get up still holding an arrow, and off you go.
    const direction = me.sittingWith ? 0 : held;
    if (direction === this.askedToWalk) return;
    this.ask("walk", direction);
    this.askedToWalk = direction;
  }

  private step() {
    const me = this.me();
    const crossing = me && !me.sittingWith ? junctionFrom(this.world, me) : undefined;
    if (crossing && isOpen(crossing, this.isMendedNow)) this.ask("step");
  }

  private sitDown() {
    const me = this.me();
    const trouble = me && !me.sittingWith ? troubleAt(this.world, me) : undefined;
    if (trouble && !this.isMendedNow(trouble.id)) this.ask("sitDown");
  }

  private play(move: Move) {
    if (this.me()?.sittingWith) this.ask("play", move);
  }

  private getUp() {
    if (this.me()?.sittingWith) this.ask("getUp");
  }

  /** The line at the bottom of the screen: what you can do right where you are. */
  private hintFor(me: Player): string {
    if (me.sittingWith) return me.move ? "Waiting for the band…" : "Choose your move: 1, 2, 3 or 4";
    const crossing = junctionFrom(this.world, me);
    if (crossing) {
      const there = findRoad(this.world, crossing.leadsTo.road).name;
      if (isOpen(crossing, this.isMendedNow)) return `↑ step onto ${there}`;
      return `${there} is closed until ${findTrouble(this.world, crossing.opensWhenMended!).thing} is mended.`;
    }
    const trouble = troubleAt(this.world, me);
    if (trouble && !this.isMendedNow(trouble.id)) return `Space: sit down with ${trouble.thing}`;
    if (trouble) return "This one's mended.";
    return "← → to walk";
  }

  /** Clear the old road and draw the new one: backdrop, junctions, troubles, residents. */
  private drawRoad(roadId: string) {
    for (const thing of this.scenery) thing.destroy();
    const drawings = [...this.figures.values(), ...this.troubles.values(), ...this.residents, ...this.junctions.map((j) => j.drawing)];
    for (const drawing of drawings) drawing.destroy();
    this.figures.clear();
    this.troubles.clear();

    const road = findRoad(this.world, roadId);
    this.scenery = drawBackdrop(this, road);
    // Keep the camera on the road: at either end, you walk toward the edge of the screen.
    this.cameras.main.setBounds(0, 0, road.length, SCREEN_H);

    // Each junction on this road, seen from here: standing at its end, where does it lead?
    this.junctions = [];
    for (const { a, b } of this.world.junctions) {
      for (const end of [a, b]) {
        if (end.road !== roadId) continue;
        const crossing = junctionFrom(this.world, end)!;
        const drawing = new JunctionDrawing(this, end.x, findRoad(this.world, crossing.leadsTo.road).name);
        this.junctions.push({ drawing, crossing });
      }
    }
    for (const trouble of this.world.troubles) {
      if (trouble.at.road === roadId) this.troubles.set(trouble.id, new TroubleDrawing(this, trouble));
    }
    this.residents = this.world.residents.filter((r) => r.at.road === roadId).map((r) => new ResidentFigure(this, r));
    this.scenery.push(this.add.text(30, GROUND_Y + 40, road.name, lettering(28, { color: MAGENTA })));
    this.drawnRoad = roadId;
  }

  /** Everyone on this road: add new arrivals, ease everyone toward where they are, remove anyone who left. */
  private drawPlayers(delta: number) {
    const here = new Set<string>();
    this.room.state.players.forEach((player, id) => {
      if (player.road !== this.drawnRoad) return;
      here.add(id);
      const figure = this.figures.get(id) ?? this.addFigure(id, player);
      figure.easeToward(this.whereToDraw(player), delta);
    });
    for (const [id, figure] of this.figures) {
      if (here.has(id)) continue;
      figure.destroy();
      this.figures.delete(id);
    }
  }

  private addFigure(id: string, player: Player): Figure {
    const figure = new Figure(this, player.name, colourFor(player.name), player.x);
    this.figures.set(id, figure);
    return figure;
  }

  /** Where to draw a player: where they stand, or, if they're sitting with something, in their seat around it. */
  private whereToDraw(player: Player): number {
    if (!player.sittingWith) return player.x;
    const band = this.bandAt(player.sittingWith).map((p) => p.name);
    return seatFor(this.world, findTrouble(this.world, player.sittingWith), band, player.name);
  }

  private bandAt(troubleId: string): Player[] {
    if (!troubleId) return [];
    return [...this.room.state.players.values()].filter((p) => p.sittingWith === troubleId);
  }

  private drawTroubles(time: number) {
    this.room.state.mendings.forEach((mending, id) => {
      this.troubles.get(id)?.show(mending, time);
      const before = this.lastDiscord.get(id);
      if (before !== undefined && before > 0 && isMended(mending) && this.troubles.has(id)) {
        this.say(this.mendedMessage(id, [...mending.playedBy]));
      }
      this.lastDiscord.set(id, mending.discord);
    });
  }

  /** "Mended!", who played on it, and any way its mending opened. */
  private mendedMessage(troubleId: string, playedBy: string[]): string {
    const lines = [`Mended! Played on by ${playedBy.join(", ")}.`];
    for (const { a, b, opensWhenMended } of this.world.junctions) {
      if (opensWhenMended !== troubleId) continue;
      const farEnd = a.road === this.drawnRoad ? b : a;
      lines.push(`The way to ${findRoad(this.world, farEnd.road).name} is open.`);
    }
    return lines.join("\n");
  }

  /** Show a message in the middle of the screen for a few seconds. */
  private say(message: string) {
    this.toast.setText(message).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 3500, duration: 800 });
  }
}
