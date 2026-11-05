# Magentoid

Walk the Moods of [magenta](https://magenta.cryptograss.live), and mend what you find there, together.

Every road in Magentoid is a Mood. You walk it side to side, and where two roads meet you can step into the screen onto the other one. Along the way are things that are out of sorts: a fiddle with a lifted bridge, a jam that's lost the one. Nobody here is an enemy. You sit down with the thing, listen to it, and play it back into tune. The hard ones need a band, so you bring friends. When something is mended, it stays mended for everyone, with the names of the people who mended it.

## Play it

```sh
npm install
npm run dev
```

Then open the address it prints, once per player (`?name=yourname` on the end skips the question). Two browser windows are two players.

| key | on the road | sitting with something |
|---|---|---|
| ← → | walk | |
| ↑ | step onto the other road, at a junction | |
| Space | sit down with something out of sorts | |
| 1 2 3 4 | | Listen, Tune, Back up, Take a break |
| Esc | | set it down and walk away |

## How a Session works

A Session is this game's battle, except the goal is to leave the thing better than you found it.

- **Discord** is how out of sorts it is. At zero, it's mended.
- **Trust** goes up when you **Listen**. With enough Trust you hear what it needs, and every **Tune** lands harder.
- **Back up** does nothing by itself. It makes everyone *else's* move stronger, the way a rhythm player does.
- **Take a break** is the solo: the biggest move, but only over somebody's backing. Alone, it costs Trust.
- Every round, a thing nobody fixes gets a little worse. That's the only pressure.
- A thing that **needs a band** can be steadied by one player, never finished by one.

A round is played when everyone sitting with the thing has chosen. All the numbers are named constants at the top of [`src/rules/session.ts`](src/rules/session.ts), so changing how the game feels means changing one line.

## Reading the code

Read it in this order. Each file says at the top why it exists.

1. **[`src/rules/session.ts`](src/rules/session.ts)**: the whole Session, as plain functions. No game engine, no network.
2. **[`src/rules/session.test.ts`](src/rules/session.test.ts)**: the rules in plain English, checked. Run them with `npm test`.
3. **[`src/rules/world.ts`](src/rules/world.ts)** and **[`firstSlice.ts`](src/rules/firstSlice.ts)**: roads, junctions, and where the troubles are.
4. **[`src/server/state.ts`](src/server/state.ts)**: what every player's screen gets to see.
5. **[`src/server/WorldRoom.ts`](src/server/WorldRoom.ts)**: the server. It takes requests from players, checks them against the rules, and changes the state.
6. **[`src/client/RoadScene.ts`](src/client/RoadScene.ts)**: the screen. It draws the state and turns key presses into requests.
7. **[`src/client/scenery.ts`](src/client/scenery.ts)** and **[`SessionPanel.ts`](src/client/SessionPanel.ts)**: the hills, the people, the panel.

The big idea is **the server decides, the client draws.** A player's browser never changes the game by itself. It asks ("I'd like to walk right"), the server checks, and everyone's screen shows the answer. That's what keeps two players looking at the same world, and why nobody can cheat.

## House rules for the code

These matter more than any one feature. A pull request that breaks one gets asked to change.

- **Readable first.** Someone learning to program should be able to follow every file. If a trick is clever, it needs a comment saying why, or it goes.
- **Names a player would use**: `Session`, `discord`, `mend`, `road`. No `Manager`, no `Util`, no `Helper`.
- **Rules are plain functions** in `src/rules/`, with tests, and import nothing from Phaser or Colyseus.
- **The server owns the state; the client only draws** and asks.
- **Comments say why, not what.** The code already says what.
- **One idea per file**, short enough to read in one sitting.
- **TypeScript in strict mode**, and `npm run check` stays clean.
- **No AI-generated music or art.** Music is Creative Commons releases from cryptograss artists, or faithful transcriptions of traditional tunes, each one ear-checked by a person, with its source and license written down. The scenery is drawn by code as flat shapes until a person draws something better.

## Built with

- [Phaser 4](https://phaser.io): draws the game in the browser.
- [Colyseus](https://colyseus.io): the multiplayer server. It keeps the shared state and sends every change to every player.
- [Vite](https://vite.dev): serves the game in development, and runs the Colyseus server alongside it, on one port.
- [Vitest](https://vitest.dev): runs the tests.

## What's next

- Roads from magenta's real list of Moods, and junctions from the [connectome](https://pickipedia.xyz/wiki/Emergent:Blu/Patches/rambler) (two roads meet where somebody played on both).
- Mends that last past a server restart, kept in their own store and never mixed into the connectome's sourced credits.
- Trophy halls of on-chain merch, starting with [Set Stones](https://pickipedia.xyz/wiki/Set_Stones).
- Music: traditional tunes from human transcriptions, ear-checked, with blu.
- More kinds of trouble, and the art for them.

The design discussion lives on [PickiPedia](https://pickipedia.xyz/wiki/Cryptograss:Magentoid_(contemplation)).
