import Phaser from "phaser";
import { isMended } from "../rules/session";
import type { Trouble } from "../rules/world";
import type { Mending } from "../server/state";
import { GROUND_Y, lettering } from "./look";

/**
 * A trouble on the road, drawn in flat shapes. While it's out of sorts it
 * flickers; once it's mended it holds still and glows, and its label names
 * everyone who played on it.
 */
export class TroubleDrawing {
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly shape: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, trouble: Trouble) {
    const x = trouble.at.x;
    // Drawn fully opaque, then faded with setAlpha: a circle made with alpha 0 can never be faded back in.
    this.glow = scene.add.circle(x, GROUND_Y - 40, 72, 0xffd27a).setAlpha(0).setDepth(1);
    this.shape = scene.add.container(x, GROUND_Y - 40, SHAPES[trouble.looks](scene)).setDepth(2);
    this.label = scene.add
      .text(x, GROUND_Y + 34, "", lettering(14, { wordWrap: { width: 260 }, align: "center" }))
      .setOrigin(0.5, 0)
      .setDepth(2);
  }

  show(mending: Mending, now: number) {
    const mended = isMended(mending);
    this.label.setText(mended ? `mended by ${mending.playedBy.join(", ")}` : mending.thing);
    this.glow.setAlpha(mended ? 0.22 : 0);
    this.shape.setAlpha(mended ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(now / 300)));
  }

  destroy() {
    this.glow.destroy();
    this.shape.destroy();
    this.label.destroy();
  }
}

type Shapes = (scene: Phaser.Scene) => Phaser.GameObjects.GameObject[];

const WOOD = 0xc0773a;
const DARK_WOOD = 0x3a2414;
const IVORY = 0xe8dcc0;

/** How each kind of trouble looks. Shapes are drawn around (0, 0), the middle of the thing. */
const SHAPES: Record<Trouble["looks"], Shapes> = {
  fiddle: (scene) => [
    scene.add.ellipse(0, 12, 36, 28, WOOD), // lower bout
    scene.add.ellipse(0, -10, 30, 24, WOOD), // upper bout
    scene.add.rectangle(0, -42, 6, 40, DARK_WOOD), // neck
    scene.add.circle(0, -64, 5, DARK_WOOD), // scroll
    scene.add.rectangle(4, 6, 14, 3, IVORY).setAngle(-25), // the bridge, lifted and crooked
  ],
  banjo: (scene) => [
    scene.add.rectangle(0, -46, 6, 58, DARK_WOOD), // neck
    scene.add.rectangle(0, -78, 12, 14, DARK_WOOD), // peghead
    scene.add.circle(5, -30, 3, IVORY), // the fifth-string peg, halfway up the neck
    scene.add.circle(0, 10, 22, 0x8a6a3a), // rim
    scene.add.circle(0, 10, 18, IVORY), // head
  ],
  chart: (scene) => [
    scene.add.rectangle(0, 0, 54, 70, 0xf2ecdf), // the paper
    ...[-20, -12, -4, 4, 12].map((y) => scene.add.rectangle(0, y, 44, 1, 0x555555)), // the staff
    scene.add.circle(12, -8, 13, 0x6b4226, 0.55), // the coffee
  ],
};
