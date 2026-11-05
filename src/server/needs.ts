/**
 * What each trouble needs, by trouble id.
 *
 * This is the one thing in the world you have to earn: nobody hears what a
 * thing needs until they've listened to it. So it lives here, on the server,
 * and not with the rest of the world in rules/firstSlice.ts. Every player's
 * browser has a copy of that file, and anyone can read whatever is in their
 * own browser. The server sends a need along only once the band has heard it
 * (see `writeSession` in WorldRoom.ts).
 *
 * A trouble added to the world needs a line here too. A test checks.
 */
export const NEEDS: Readonly<Record<string, string>> = {
  "fifth-string": "turn the peg slowly, pressing it in a little as you go",
  "lifted-bridge": "slack the strings before you move the bridge",
  "coffee-chart": "play the bridge together until somebody remembers how it goes",
};
