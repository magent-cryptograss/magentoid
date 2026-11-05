import type { World } from "./world";

/**
 * The first slice of the world: two Moods, one junction, one trouble.
 *
 * Later the roads come from magenta's own list of Moods and the junctions
 * from the connectome (two records meet where somebody played on both).
 * For now they're written out by hand, so there's something to walk on.
 */
export const firstSlice: World = {
  roads: [
    { id: "magentoid", name: "#magentoid", length: 2400 },
    { id: "rabbithole", name: "#rabbithole", length: 2400 },
  ],
  junctions: [{ a: { road: "magentoid", x: 1700 }, b: { road: "rabbithole", x: 500 } }],
  troubles: [
    {
      id: "lifted-bridge",
      at: { road: "rabbithole", x: 1400 },
      thing: "a fiddle with a lifted bridge",
      need: "slack the strings before you move the bridge",
      discord: 60,
      needsBand: true,
    },
  ],
  start: { road: "magentoid", x: 300 },
};
