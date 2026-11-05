import Phaser from "phaser";
import { HEARD_AT, MOVES, type Move } from "../rules/session";
import type { Mending, Player } from "../server/state";
import { SCREEN_W } from "./scenery";

/** What each move is called on screen, and the key that plays it. */
const LABELS: Record<Move, string> = {
  listen: "1  Listen",
  tune: "2  Tune",
  backUp: "3  Back up",
  takeBreak: "4  Take a break",
};

/**
 * The panel you see while you're sitting with a trouble, the way a battle
 * screen comes up in an RPG. It only shows the state; the keys that send
 * moves live in RoadScene.
 */
export class SessionPanel {
  private readonly box: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly discordBar: Phaser.GameObjects.Rectangle;
  private readonly trustBar: Phaser.GameObjects.Rectangle;
  private readonly need: Phaser.GameObjects.Text;
  private readonly band: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const width = 560;
    const text = (y: number, size = 16) =>
      scene.add.text(20, y, "", { fontSize: `${size}px`, color: "#f4e8ff", wordWrap: { width: width - 40 } });

    this.title = text(14, 20);
    this.discordBar = scene.add.rectangle(120, 56, 0, 14, 0xff5d5d).setOrigin(0);
    this.trustBar = scene.add.rectangle(120, 80, 0, 14, 0x67d1ff).setOrigin(0);
    this.need = text(104);
    this.band = text(136);

    this.box = scene.add
      .container((SCREEN_W - width) / 2, 20, [
        scene.add.rectangle(0, 0, width, 260, 0x120a1a, 0.92).setOrigin(0).setStrokeStyle(2, 0xff67fd),
        this.title,
        text(52).setText("Discord"),
        text(76).setText("Trust"),
        this.discordBar,
        this.trustBar,
        this.need,
        this.band,
        text(204).setText(MOVES.map((m) => LABELS[m]).join("    ") + "\nEsc  Set it down"),
      ])
      .setScrollFactor(0)
      .setDepth(10)
      .setVisible(false);
  }

  /** Show the panel for `mending`, or hide it if you're not sitting with anything. */
  show(mending: Mending | undefined, band: Player[], me: Player) {
    this.box.setVisible(mending !== undefined);
    if (!mending) return;

    this.title.setText(mending.thing);
    this.discordBar.width = mending.discord * 4;
    this.trustBar.width = mending.trust * 4;
    this.need.setText(
      mending.trust >= HEARD_AT ? `It needs you to ${mending.need}.` : "Listen to it, to hear what it needs.",
    );

    const lines = band.map((p) => `${p === me ? "you" : p.name}: ${p.move ? "ready" : "choosing…"}`);
    if (mending.needsBand && band.length < 2) lines.push("This one needs a band. You can steady it alone, not finish it.");
    this.band.setText(lines.join("\n"));
  }
}
