import Phaser from "phaser";
import { MOVES, type Move } from "../rules/session";
import type { Trouble } from "../rules/world";
import type { Mending, Player } from "../server/state";
import { MAGENTA, SCREEN_W, lettering } from "./look";

/** What each move is called on screen, with the key that plays it. */
const LABELS: Record<Move, string> = {
  listen: "1 Listen",
  tune: "2 Tune",
  backUp: "3 Back up",
  takeBreak: "4 Take a break",
};

const WIDTH = 600;
const HEIGHT = 330;

/**
 * The panel you see while you're sitting with a trouble, the way a battle
 * screen comes up in an RPG. It only shows the state; the keys that send
 * moves live in RoadScene.
 */
export class SessionPanel {
  private readonly box: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly discord: Meter;
  private readonly trust: Meter;
  private readonly need: Phaser.GameObjects.Text;
  private readonly band: Phaser.GameObjects.Text;
  private readonly story: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const text = (y: number, size = 16) => scene.add.text(20, y, "", lettering(size, { wordWrap: { width: WIDTH - 40 } }));

    this.title = text(14, 21);
    this.discord = new Meter(scene, 50, "Discord", 0xff6b6b);
    this.trust = new Meter(scene, 74, "Trust", 0x67d1ff);
    this.need = text(102);
    this.band = text(136);
    this.story = text(190, 15).setColor("#d8c8e8");
    const keys = text(296, 15).setText(`${MOVES.map((m) => LABELS[m]).join("    ")}    Esc Set it down`).setColor(MAGENTA);

    this.box = scene.add
      .container((SCREEN_W - WIDTH) / 2, 16, [
        scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x120a1a, 0.94).setOrigin(0).setStrokeStyle(2, 0xff67fd),
        this.title,
        ...this.discord.parts,
        ...this.trust.parts,
        this.need,
        this.band,
        this.story,
        keys,
      ])
      .setScrollFactor(0)
      .setDepth(10)
      .setVisible(false);
  }

  /** Show the panel for the trouble you're sitting with, or hide it if you're not sitting with anything. */
  show(trouble: Trouble | undefined, mending: Mending | undefined, band: Player[], me: Player) {
    this.box.setVisible(trouble !== undefined && mending !== undefined);
    if (!trouble || !mending) return;

    this.title.setText(trouble.thing);
    this.discord.show(mending.discord);
    this.trust.show(mending.trust);
    // The server only sends the need once the band has heard it.
    this.need.setText(mending.need ? `It needs you to ${mending.need}.` : "Listen to it, to learn what it needs.");

    const who = band.map((p) => `${p === me ? "you" : p.name}: ${p.move ? "ready" : "choosing…"}`).join("   ");
    const lines = [who];
    if (mending.countdown > 0) lines.push(`The round starts in ${Math.ceil(mending.countdown)}s, with whoever's ready.`);
    if (trouble.needsBand && band.length < 2) lines.push("This one needs a band. Alone, you can steady it, not finish it.");
    this.band.setText(lines.join("\n"));

    this.story.setText(mending.story.length > 0 ? `Last round: ${mending.story.join(" ")}` : "");
  }
}

/** A labelled bar with its number beside it: a dim track, filled in to the value out of 100. */
class Meter {
  readonly parts: Phaser.GameObjects.GameObject[];
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly number: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, y: number, name: string, colour: number) {
    this.fill = scene.add.rectangle(110, y + 3, 0, 14, colour).setOrigin(0);
    this.number = scene.add.text(530, y, "", lettering(15));
    this.parts = [
      scene.add.text(20, y, name, lettering(16)),
      scene.add.rectangle(110, y + 3, 400, 14, colour, 0.18).setOrigin(0),
      this.fill,
      this.number,
    ];
  }

  show(value: number) {
    this.fill.width = value * 4;
    this.number.setText(`${value}`);
  }
}
