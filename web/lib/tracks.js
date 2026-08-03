// The rhythm tracks, and the moment in each one where the beat drops.
//
// `dropMs` is when the run flips into the Panic phase — the tempo doubles and
// the board gets interesting. It is per-track because it is a musical cue, not a
// timer; if you swap a file, re-time this number to its drop.
//
// ⚠ LICENSING: the five files shipped by the upstream project are commercial
// tracks the original author explicitly did not own ("Each Soundtrack completely
// belongs to the respective artist"). They are fine for local play, NOT for a
// public nyan.city deploy. Replace the mp3s in public/soundtracks/ with licensed
// or original audio and re-time `dropMs` — nothing else in the game needs to
// change.

export const TRACKS = [
  { id: "crabrave", title: "Crab Rave", src: "/soundtracks/crabrave.mp3", dropMs: 31000 },
  {
    id: "runninginthe90s",
    title: "Running in the 90s",
    src: "/soundtracks/runninginthe90s.mp3",
    dropMs: 36000,
  },
  { id: "dejavu", title: "Deja Vu", src: "/soundtracks/dejavu.mp3", dropMs: 37500 },
  { id: "gasgasgas", title: "Gas Gas Gas", src: "/soundtracks/gasgasgas.mp3", dropMs: 37500 },
  { id: "fnaf", title: "Five Nights at Freddy's 2", src: "/soundtracks/fnaf.mp3", dropMs: 41000 },
];

/** A track at random — the run should not be the same shape twice. */
export function pickTrack() {
  return TRACKS[Math.floor(Math.random() * TRACKS.length)];
}
