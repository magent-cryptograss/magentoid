import type { World } from "./world";

/**
 * The first slice of the world: three Moods, two junctions (one closed at
 * first), three troubles, and two residents.
 *
 * Later the roads come from magenta's own list of Moods, and the junctions
 * maybe from the connectome (two roads meet where somebody played on both).
 * For now they're written out by hand, so there's something to walk on.
 *
 * The troubles go from small to big on purpose: the banjo can be mended
 * alone, so a player arriving by themselves has something to do and learns
 * the moves; the fiddle and the chart need a band, and the road to the chart
 * stays closed until a band has mended the fiddle.
 *
 * What each trouble needs is kept on the server, in server/needs.ts.
 */
export const firstSlice: World = {
  roads: [
    // #magentoid is magenta, of course.
    { id: "magentoid", name: "#magentoid", length: 2400, hue: 0.83 },
    { id: "rabbithole", name: "#rabbithole", length: 2400, hue: 0.47 },
    { id: "chartifacts", name: "#chartifacts", length: 2000, hue: 0.08 },
  ],
  junctions: [
    { a: { road: "magentoid", x: 1700 }, b: { road: "rabbithole", x: 500 } },
    // #chartifacts opens once the fiddle on #rabbithole is mended: the first door a band opens for everyone.
    { a: { road: "rabbithole", x: 2000 }, b: { road: "chartifacts", x: 300 }, opensWhenMended: "lifted-bridge" },
  ],
  troubles: [
    {
      id: "fifth-string",
      at: { road: "magentoid", x: 1050 },
      looks: "banjo",
      thing: "a banjo whose fifth string won't stay in tune",
      discord: 20,
      needsBand: false,
    },
    {
      id: "lifted-bridge",
      at: { road: "rabbithole", x: 1300 },
      looks: "fiddle",
      thing: "a fiddle with a lifted bridge",
      discord: 60,
      needsBand: true,
    },
    {
      id: "coffee-chart",
      at: { road: "chartifacts", x: 1200 },
      looks: "chart",
      thing: "a chart with coffee spilled over the bridge",
      discord: 90,
      needsBand: true,
    },
  ],
  residents: [
    {
      name: "magent",
      colour: 0xff67fd,
      at: { road: "magentoid", x: 560 },
      says: "Hey, glad you came! Down the road there's a banjo that won't hold its fifth string. Listen to it before you touch a peg.",
    },
    {
      // blu lives just past the first door a band opens, where the charts are.
      name: "blu",
      colour: 0x1976d2,
      at: { road: "chartifacts", x: 560 },
      says: "Well, look what come through the gate! Some band mended that fiddle, and their names are on it, wrote down true. Up yonder's a chart with Folgers all over the bridge. Don't you guess at what's under the stain. Sit down and listen first.",
    },
  ],
  start: { road: "magentoid", x: 300 },
};
