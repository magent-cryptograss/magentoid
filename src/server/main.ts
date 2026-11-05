import { defineRoom, defineServer } from "colyseus";
import { WorldRoom } from "./WorldRoom";

/**
 * The server's front door. In development, Vite runs this for us (see
 * vite.config.ts), so the game and the server share one address.
 */
export const server = defineServer({
  rooms: {
    world: defineRoom(WorldRoom),
  },
});
