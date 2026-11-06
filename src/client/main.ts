import Phaser from "phaser";
import { Client } from "@colyseus/sdk";
import { firstSlice } from "../rules/firstSlice";
import { WorldState } from "../server/state";
import { SCREEN_H, SCREEN_W } from "./look";
import { RoadScene } from "./RoadScene";

/**
 * Where the game starts in the browser: find out your name, join the shared
 * world on the server, then hand the screen to the road.
 */

/** Words shown over the page when something has gone wrong. */
function sayOnPage(message: string) {
  const notice = document.getElementById("notice")!;
  notice.textContent = message;
  notice.hidden = false;
}

/** Your name: from the address (?name=…), or what you told us last time, or ask. */
function yourName(): string {
  const fromAddress = new URLSearchParams(location.search).get("name");
  if (fromAddress) return fromAddress;

  const remembered = localStorage.getItem("magentoid-name");
  if (remembered) return remembered;

  const typed = (prompt("What should we call you?") ?? "").trim();
  if (typed) localStorage.setItem("magentoid-name", typed);
  return typed;
}

// The server lives at the same address as this page (Vite runs both).
const client = new Client(location.origin);
const room = await client.joinOrCreate("world", { name: yourName() }, WorldState).catch((error) => {
  sayOnPage("Couldn't reach the game's server. If you're running it yourself, is `npm run dev` still going?");
  throw error;
});

room.onLeave(() => sayOnPage("Lost the connection to the server. Reload the page to come back."));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: SCREEN_W,
  height: SCREEN_H,
  parent: "game",
  backgroundColor: "#120a1a",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new RoadScene(room, firstSlice),
});

// Phaser fits the game to its space when the window is resized, but not when
// the space changes inside the page (opening the debug panel beside it).
// Watching the space itself catches both. refresh() fits the game to the size
// Phaser last measured, so it measures first.
new ResizeObserver(() => {
  game.scale.getParentBounds();
  game.scale.refresh();
}).observe(document.getElementById("game")!);
