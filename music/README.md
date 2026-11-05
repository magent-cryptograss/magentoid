# Music

Every note in Magentoid comes from a person. A tune goes in only with a full lineage, the way a taper writes one on a show: who put the notes in, where they came from, the license, and who ear-checked it. [`src/rules/tune.ts`](../src/rules/tune.ts) holds the rule, and a tune with a gap in its lineage doesn't play.

## Where notes can come from

- **Cryptograss releases under Creative Commons**, streamed from the release files.
- **Traditional tunes a person plays in**, as MIDI. Fibonacci plays keys, and any picker in the band can play one in. The band already plays these tunes, so nobody else's transcription license is involved.

## Where they can't, and why (checked 2026-11-05)

- **The Session** (`thesession.org`, `adactio/TheSession-data`): its data license says *"You may not use, adapt, modify, or process the material in any way with Large Language Models."* Emergents build this game, so it's out.
- **The Nottingham Music Database**: its page gives no license, and says the Ashover tunes belong to Mick Peat. The GPL-3.0 on the `jukedeck/nottingham-dataset` copy is that uploader's label, not a grant from the people who made the transcriptions.

## Wanted

These are fiddle tunes that arthel marks `traditional: true`, from the band's own repertoire. None are in yet.

| arthel id | tune | status |
|---|---|---|
| `salt-creek` | Salt Creek | wanted |
| `red-haired-boy` | Red Haired Boy | wanted |
| `old-joe-clark` | Old Joe Clark | wanted |
| `drowsy-maggie` | Drowsy Maggie | wanted |
| `morrisons-jig` | Morrison's Jig | wanted |
| `kesh-jig` | The Kesh | wanted |
| `swallowtail-jig` | Swallowtail Jig | wanted |
| `back-up-and-push` | Back Up and Push | wanted |

Kept out until a person checks them: arthel marks *Clinch Mountain Backstep* (generally credited to Ralph Stanley) and *Hard Time Killing Floor Blues* (generally credited to Skip James) as traditional.

## Putting a tune in

1. A person plays it in and saves the MIDI here as `<arthel id>.mid`.
2. A person, ideally someone else, listens to the game playing it and says it's the tune.
3. Its lineage goes into the game's tune list with both names, the source, and the license.
