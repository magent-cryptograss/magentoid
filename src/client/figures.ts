import Phaser from "phaser";
import type { Resident } from "../rules/world";
import { GROUND_Y, lettering } from "./look";

/** How far apart people can stand before their names would overlap. */
const NAME_ROOM = 70;

/**
 * A person on the road: a body, a head and a name, all flat shapes.
 * Players and residents are both drawn as Figures.
 */
export class Figure {
  private readonly body: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, name: string, colour: number, x: number) {
    this.label = scene.add.text(0, -80, name, lettering(14)).setOrigin(0.5);
    this.body = scene.add
      .container(x, GROUND_Y, [
        scene.add.triangle(0, -30, -14, 30, 14, 30, 0, -10, colour),
        scene.add.circle(0, -52, 10, colour),
        this.label,
      ])
      .setDepth(5);
  }

  get x(): number {
    return this.body.x;
  }

  /**
   * Move part of the way toward where the server says this person is. The
   * server sends positions twenty times a second; easing between them is what
   * makes walking look smooth instead of jumpy.
   */
  easeToward(x: number, deltaMs: number) {
    const gap = x - this.body.x;
    // A big jump isn't walking (they just arrived, or stepped off a road), so go straight there.
    if (Math.abs(gap) > 200) this.body.x = x;
    else this.body.x += gap * Math.min(1, deltaMs / 80);
  }

  /** Raise the name by some number of lines. */
  liftName(lines: number) {
    this.label.y = -80 - lines * 16;
  }

  destroy() {
    this.body.destroy();
  }
}

/** When people stand close together, stack their names so every one can be read. */
export function stackNames(figures: Iterable<Figure>) {
  const leftToRight = [...figures].sort((a, b) => a.x - b.x);
  let lines = 0;
  leftToRight.forEach((figure, i) => {
    const crowded = i > 0 && figure.x - leftToRight[i - 1].x < NAME_ROOM;
    lines = crowded ? lines + 1 : 0;
    figure.liftName(lines);
  });
}

/** A resident: a Figure with a soft glow in its own colour, and what it says when you come near. */
export class ResidentFigure {
  readonly name: string;
  readonly figure: Figure;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly speech: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, resident: Resident) {
    this.name = resident.name;
    this.glow = scene.add.circle(resident.at.x, GROUND_Y - 40, 46, resident.colour, 0.18).setDepth(4);
    this.figure = new Figure(scene, resident.name, resident.colour, resident.at.x);
    this.speech = scene.add
      .text(resident.at.x, GROUND_Y - 130, resident.says, lettering(15, {
        backgroundColor: "#1a1020",
        padding: { x: 10, y: 8 },
        wordWrap: { width: 300 },
      }))
      .setOrigin(0.5, 1)
      .setDepth(6)
      .setVisible(false);
  }

  /** Speak while someone is close enough to hear. */
  heard(byMe: boolean) {
    this.speech.setVisible(byMe);
  }

  destroy() {
    this.glow.destroy();
    this.figure.destroy();
    this.speech.destroy();
  }
}
