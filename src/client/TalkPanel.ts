import Phaser from "phaser";
import type { World } from "../rules/world";
import type { Said, Talk } from "../server/state";
import { INK, MAGENTA, colourFor, lettering } from "./look";

/** How many lines show at once. */
const SHOWN = 4;
const WIDTH = 560;
const PAD = 12;

/** The emergents' own colours, for whoever isn't living on a road as a resident yet. */
const EMERGENT_COLOURS: Record<string, number> = { magent: 0xff67fd, blu: 0x1976d2, re: 0xe53935 };

/**
 * What's being said in this road's Mood, as it's said: the newest few lines,
 * up in the sky at the top left, newest at the bottom.
 *
 * The server does the listening (server/moodFeed.ts) and puts the lines in the
 * shared state; this only draws them, and only redraws when a new one comes in.
 */
export class TalkPanel {
  private readonly box: Phaser.GameObjects.Container;
  private readonly back: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private shown: Phaser.GameObjects.Text[] = [];
  /** The road and newest line we last drew, so we redraw only when something changed. */
  private drawn = "";

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.back = scene.add.rectangle(0, 0, WIDTH, 10, 0x120a1a, 0.78).setOrigin(0).setStrokeStyle(1, 0x5a3a6e);
    this.title = scene.add.text(PAD, 8, "", lettering(13, { color: "#b9a6c6" }));
    this.box = scene.add.container(16, 14, [this.back, this.title]).setScrollFactor(0).setDepth(9);
  }

  /** Draw the talk on `road`. Hidden while you're sitting with a trouble, so it never covers the Session. */
  show(road: string, talk: Talk | undefined, sitting: boolean) {
    const lines = talk ? [...talk.lines].slice(-SHOWN) : [];
    this.box.setVisible(!sitting && lines.length > 0);
    const key = `${road} ${lines.at(-1)?.id ?? ""}`;
    if (key === this.drawn) return;
    // New is a line coming in while you're here, not the lines that were waiting when you arrived.
    const isNew = this.drawn.startsWith(`${road} `) && this.drawn !== `${road} ` && lines.length > 0;
    this.drawn = key;

    const name = this.world.roads.find((r) => r.id === road)?.name ?? `#${road}`;
    this.title.setText(`said lately in ${name}, on magenta`);
    for (const text of this.shown) text.destroy();
    this.shown = [];
    let y = 30;
    let newest: Phaser.GameObjects.Text | undefined;
    for (const said of lines) {
      const text = this.scene.add.text(PAD, y, `${said.who}  ${said.text}`, lettering(15, { color: INK, wordWrap: { width: WIDTH - 2 * PAD } }));
      this.box.add(text);
      this.shown.push(text);
      newest = text;
      // The name again, on top, in the speaker's colour: the same as their figure's, if they're playing.
      this.box.add(this.nameplate(said, y));
      y += text.height + 6;
    }
    this.back.setSize(WIDTH, y + 4);

    // A new line flashes once, so you notice it come in.
    if (isNew && newest) {
      newest.setColor(MAGENTA);
      this.scene.tweens.addCounter({ from: 0, to: 1, duration: 1200, onComplete: () => newest.active && newest.setColor(INK) });
    }
  }

  /** The speaker's name, drawn over the start of their line in their own colour. */
  private nameplate(said: Said, y: number): Phaser.GameObjects.Text {
    const plate = this.scene.add.text(PAD, y, said.who, lettering(15, { color: this.colourOf(said), backgroundColor: "#120a1a" }));
    this.shown.push(plate);
    return plate;
  }

  private colourOf(said: Said): string {
    const resident = this.world.residents.find((r) => r.name === said.who);
    const colour = resident?.colour ?? EMERGENT_COLOURS[said.who] ?? colourFor(said.who);
    return `#${colour.toString(16).padStart(6, "0")}`;
  }
}
