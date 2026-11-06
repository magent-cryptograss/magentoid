/**
 * A tune's lineage: where every note in the game came from.
 *
 * Tapers write a lineage on every show they trade (SBD > DAT > CD > FLAC), so
 * anyone holding a copy can trace it back to the stage. Magentoid does the same
 * for its music, because the rule is strict: Creative Commons releases from
 * cryptograss artists, or traditional tunes that a person played in, and every
 * one ear-checked by a person. No notes made up by a machine, ours included.
 *
 * A tune with a gap in its lineage doesn't play. That's the whole rule, and
 * `gapsIn` says what the gaps are in words, so the fix is obvious.
 */

export type TuneKind = "traditional" | "cryptograss release";

export interface Tune {
  /** The tune's slug in arthel (src/data/songs_and_tunes), so the game and the band's records agree. */
  readonly id: string;
  readonly title: string;
  readonly kind: TuneKind;
  /** The person who put the notes in: who played it in, or whose recording it is. */
  readonly notesBy: string;
  /** Where the notes came from, specific enough to check: "played in on keys, block 26,345,000", or a release. */
  readonly source: string;
  /** The license the notes are under, e.g. "CC-BY-SA-4.0". */
  readonly license: string;
  /** The person who listened to what the game plays and says it's the tune. */
  readonly earCheckedBy: string;
  /** The MIDI or audio file, relative to music/. */
  readonly file: string;
}

/**
 * The emergents of cryptograss. They wire the music up, but their names can
 * never be in `notesBy` or `earCheckedBy`: that's the "no AI-slop" rule as code.
 */
export const EMERGENTS: readonly string[] = ["magent", "re", "blu"];

/**
 * Sources we can't take notes from, and why. Checked 2026-11-05 (block 26,345,721).
 * If one of these changes its terms, the reason here is where to start.
 *
 * The Session isn't here. Its license bars processing its tunes with an LLM,
 * and nothing here does: a person fetches the ABC and runs Taper
 * (pickipedia/tools), an Artificial Dumb that converts it without reading it,
 * and `notesBy` and `earCheckedBy` already refuse an emergent's name.
 * Justin, #connectome, block 26,349,551.
 */
export const REFUSED_SOURCES: readonly { readonly matches: readonly string[]; readonly why: string }[] = [
  {
    // Specific names, not just "nottingham": a tune played in at a Nottingham jam is fine.
    matches: ["Nottingham Music Database", "abc.sourceforge.net/NMD", "nottingham-dataset"],
    why: "The Nottingham Music Database states no license, and its Ashover tunes belong to Mick Peat.",
  },
];

/** Everything missing or wrong in a tune's lineage, in plain words. Empty means it can play. */
export function gapsIn(tune: Tune): string[] {
  const gaps: string[] = [];

  if (!tune.title.trim()) gaps.push("it has no title");
  if (!tune.notesBy.trim()) gaps.push("nobody is named as putting the notes in");
  if (!tune.source.trim()) gaps.push("it doesn't say where the notes came from");
  if (!tune.license.trim()) gaps.push("it has no license");
  if (!tune.earCheckedBy.trim()) gaps.push("nobody has ear-checked it");
  if (!tune.file.trim()) gaps.push("it has no file");

  if (isEmergent(tune.notesBy)) gaps.push(`${tune.notesBy} is an emergent, and the notes have to come from a person`);
  if (isEmergent(tune.earCheckedBy)) gaps.push(`${tune.earCheckedBy} is an emergent, and the ear-check has to be a person's`);

  for (const refused of REFUSED_SOURCES) {
    const source = tune.source.toLowerCase();
    if (refused.matches.some((match) => source.includes(match.toLowerCase()))) gaps.push(refused.why);
  }

  return gaps;
}

export function canPlay(tune: Tune): boolean {
  return gapsIn(tune).length === 0;
}

function isEmergent(name: string): boolean {
  return EMERGENTS.includes(name.trim().toLowerCase());
}
