import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import { MOVES } from "../rules/session";
import { findRoad, junctionFrom, troubleAt, type World } from "../rules/world";
import type { Mending, Player, WorldState } from "../server/state";
import { SessionPanel } from "./SessionPanel";
import { GROUND_Y, SCREEN_H, SCREEN_W, colourFor, drawBackdrop, drawJunction } from "./scenery";

/**
 * The road you're standing on, and everyone on it with you.
 *
 * This scene never decides anything. Every frame it reads the shared state
 * the server sends (`room.state`) and draws it. When you press a key, it sends
 * the server a request, and the result shows up in the state a moment later.
 */
export class RoadScene extends Phaser.Scene {
  private keys!: Record<"left" | "right" | "up" | "act" | "leave" | "one" | "two" | "three" | "four", Phaser.Input.Keyboard.Key>;
  private panel!: SessionPanel;
  private hint!: Phaser.GameObjects.Text;

  /** The road we last drew, so we know when to draw a new one. */
  private drawnRoad = "";
  private scenery: Phaser.GameObjects.GameObject[] = [];
  private figures = new Map<string, Phaser.GameObjects.Container>();
  private troubles = new Map<string, Phaser.GameObjects.Container>();
  /** The last walking direction we asked for, so we only send changes. */
  private askedToWalk = 0;

  constructor(
    private readonly room: Room<any, WorldState>,
    private readonly world: World,
  ) {
    super("road");
  }

  create() {
    const keyboard = this.input.keyboard!;
    this.keys = {
      left: keyboard.addKey("LEFT"),
      right: keyboard.addKey("RIGHT"),
      up: keyboard.addKey("UP"),
      act: keyboard.addKey("SPACE"),
      leave: keyboard.addKey("ESC"),
      one: keyboard.addKey("ONE"),
      two: keyboard.addKey("TWO"),
      three: keyboard.addKey("THREE"),
      four: keyboard.addKey("FOUR"),
    };
    this.panel = new SessionPanel(this);
    this.hint = this.add
      .text(SCREEN_W / 2, 510, "", { fontSize: "16px", color: "#f4e8ff" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);
  }

  update() {
    const me = this.room.state.players?.get(this.room.sessionId);
    if (!me) return; // the first state hasn't arrived yet

    if (me.road !== this.drawnRoad) this.drawRoad(me.road);
    this.drawPlayers(me);
    this.drawTroubles();
    this.cameras.main.scrollX = me.x - SCREEN_W / 2;

    const mending = me.sittingWith ? this.room.state.mendings.get(me.sittingWith) : undefined;
    const band = [...this.room.state.players.values()].filter((p) => p.sittingWith && p.sittingWith === me.sittingWith);
    this.panel.show(mending, band, me);

    if (mending) this.handleSessionKeys(me);
    else this.handleRoadKeys(me);
  }

  private handleRoadKeys(me: Player) {
    const direction = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    if (direction !== this.askedToWalk) {
      this.room.send("walk", direction);
      this.askedToWalk = direction;
    }

    const here = { road: me.road, x: me.x };
    const junction = junctionFrom(this.world, here);
    const trouble = troubleAt(this.world, here);
    const mended = trouble && this.room.state.mendings.get(trouble.id)!.discord === 0;

    if (junction) this.hint.setText(`↑ step onto ${findRoad(this.world, junction.road).name}`);
    else if (trouble && !mended) this.hint.setText(`Space: sit down with ${trouble.thing}`);
    else this.hint.setText("← → to walk");

    if (junction && Phaser.Input.Keyboard.JustDown(this.keys.up)) this.room.send("step");
    if (trouble && !mended && Phaser.Input.Keyboard.JustDown(this.keys.act)) {
      this.room.send("sitDown");
      this.askedToWalk = 0;
    }
  }

  private handleSessionKeys(me: Player) {
    this.hint.setText(me.move ? "Waiting for the band…" : "Choose your move");
    const numberKeys = [this.keys.one, this.keys.two, this.keys.three, this.keys.four];
    numberKeys.forEach((key, i) => {
      if (Phaser.Input.Keyboard.JustDown(key)) this.room.send("play", MOVES[i]);
    });
    if (Phaser.Input.Keyboard.JustDown(this.keys.leave)) this.room.send("getUp");
  }

  /** Clear the old road and draw the new one: backdrop, junction signs, troubles. */
  private drawRoad(roadId: string) {
    for (const thing of [...this.scenery, ...this.figures.values(), ...this.troubles.values()]) thing.destroy();
    this.figures.clear();
    this.troubles.clear();

    const road = findRoad(this.world, roadId);
    this.scenery = drawBackdrop(this, road.id, road.length);
    // Keep the camera on the road: at either end, you walk toward the edge of the screen.
    this.cameras.main.setBounds(0, 0, road.length, SCREEN_H);
    for (const { a, b } of this.world.junctions) {
      if (a.road === roadId) this.scenery.push(...drawJunction(this, a.x, findRoad(this.world, b.road).name));
      if (b.road === roadId) this.scenery.push(...drawJunction(this, b.x, findRoad(this.world, a.road).name));
    }
    this.scenery.push(this.add.text(40, GROUND_Y + 30, road.name, { fontSize: "28px", color: "#ff67fd" }));
    this.drawnRoad = roadId;
  }

  /** Everyone on this road: add new arrivals, move everyone, remove anyone who left. */
  private drawPlayers(me: Player) {
    const here = new Set<string>();
    this.room.state.players.forEach((player, id) => {
      if (player.road !== me.road) return;
      here.add(id);
      const figure = this.figures.get(id) ?? this.addFigure(id, player);
      figure.x = player.x;
    });
    for (const [id, figure] of this.figures) {
      if (!here.has(id)) {
        figure.destroy();
        this.figures.delete(id);
      }
    }
  }

  /** A person: a body, a head and a name, all flat shapes. */
  private addFigure(id: string, player: Player): Phaser.GameObjects.Container {
    const colour = colourFor(player.name);
    const figure = this.add.container(player.x, GROUND_Y, [
      this.add.triangle(0, -30, -14, 30, 14, 30, 0, -10, colour),
      this.add.circle(0, -52, 10, colour),
      this.add.text(0, -80, player.name, { fontSize: "14px", color: "#f4e8ff" }).setOrigin(0.5),
    ]);
    figure.setDepth(5);
    this.figures.set(id, figure);
    return figure;
  }

  private drawTroubles() {
    this.room.state.mendings.forEach((mending, id) => {
      if (mending.road !== this.drawnRoad) return;
      const drawing = this.troubles.get(id) ?? this.addTrouble(id, mending);
      const label = drawing.getAt(drawing.length - 1) as Phaser.GameObjects.Text;
      label.setText(mending.discord === 0 ? `mended by ${mending.mendedBy.join(", ")}` : mending.thing);
      drawing.setAlpha(mending.discord === 0 ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(this.time.now / 300)));
    });
  }

  /** A fiddle: two ellipses for the body, a neck, and a label underneath. */
  private addTrouble(id: string, mending: Mending): Phaser.GameObjects.Container {
    const wood = 0xc0773a;
    const drawing = this.add.container(mending.x, GROUND_Y - 40, [
      this.add.ellipse(0, 10, 34, 26, wood),
      this.add.ellipse(0, -10, 28, 22, wood),
      this.add.rectangle(0, -40, 6, 40, 0x3a2414),
      this.add.text(0, 60, "", { fontSize: "14px", color: "#f4e8ff" }).setOrigin(0.5),
    ]);
    this.troubles.set(id, drawing);
    return drawing;
  }
}
