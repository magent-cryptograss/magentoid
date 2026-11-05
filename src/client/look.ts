import Phaser from "phaser";

/**
 * How the game looks, in one place: the screen size, the colours of words,
 * and the lettering. Change something here and it changes everywhere.
 */

export const SCREEN_W = 960;
export const SCREEN_H = 540;
/** The height of the road surface, where everyone's feet are. */
export const GROUND_Y = 440;

/** The colour of ordinary words. */
export const INK = "#f4e8ff";
/** magenta's own colour. */
export const MAGENTA = "#ff67fd";

/** Lettering at a given size. A storybook serif, which every computer already has. */
export function lettering(size: number, more: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: `${size}px`, color: INK, ...more };
}

/** Turn a string into a number, the same number every time. */
export function hashOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** A colour for a player, picked from their name, so you can tell people apart. */
export function colourFor(name: string): number {
  return Phaser.Display.Color.HSLToColor((hashOf(name) % 360) / 360, 0.6, 0.68).color;
}
