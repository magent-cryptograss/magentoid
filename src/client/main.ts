import Phaser from "phaser";
import { Client } from "@colyseus/sdk";
import { firstSlice } from "../rules/firstSlice";
import { WorldState } from "../server/state";
import { RoadScene } from "./RoadScene";
import { SCREEN_H, SCREEN_W } from "./scenery";

/**
 * Where the game starts in the browser: ask your name, join the shared world
 * on the server, then hand the screen to the road.
 */
const name = new URLSearchParams(location.search).get("name") ?? prompt("What should we call you?") ?? "";

// The server lives at the same address as this page (Vite runs both).
const room = await new Client(location.origin).joinOrCreate("world", { name }, WorldState);

new Phaser.Game({
  type: Phaser.AUTO,
  width: SCREEN_W,
  height: SCREEN_H,
  parent: "game",
  backgroundColor: "#120a1a",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new RoadScene(room, firstSlice),
});
