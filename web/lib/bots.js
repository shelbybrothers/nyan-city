// Bot runners, so the board is never an empty room.
//
// They are pure functions of (round index, wall-clock) — no state, no storage,
// no writes. That matters three ways:
//   · every viewer and every stream sees exactly the same bots at the same
//     scores, without anything being synchronised;
//   · the client can recompute them every second for smooth ticking instead of
//     waiting on a poll;
//   · they never touch the leaderboard store, so a bot cannot take a payout off
//     a real wallet. Settlement reads the store; bots are not in it.
//
// Every row they produce carries `bot: true`, and the UI labels it. A board that
// pays ETH must not quietly pass fake wallets off as opponents.

const BOT_COUNT = 22;

/** Small deterministic PRNG — same seed, same sequence, everywhere. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function walletFrom(rnd) {
  let out = "0x";
  for (let i = 0; i < 40; i++) out += "0123456789abcdef"[Math.floor(rnd() * 16)];
  return out;
}

/**
 * The roster for a round. Fixed wallets, fixed skill, fixed start times — only
 * the clock moves.
 */
export function rosterForRound(roundIndex, count = BOT_COUNT) {
  const roster = [];
  for (let i = 0; i < count; i++) {
    const rnd = mulberry32(hash(`nyan.city:bot:${roundIndex}:${i}`));
    roster.push({
      member: walletFrom(rnd),
      // What a great run looks like for this one. The long tail is what makes a
      // board read as real: mostly middling players, one or two who can play.
      ceiling: Math.round(9 + Math.pow(rnd(), 1.9) * 86),
      // Seconds into the round before its first run. Most are already racing
      // when the round opens — they were playing the last one — or the board
      // sits nearly empty for the first minute of every round. The rest trickle
      // in so newcomers keep arriving all the way through.
      startsAt: Math.round(i % 10 < 7 ? rnd() * 12 : 30 + rnd() * 380),
      // Seconds between runs.
      every: 3 + rnd() * 6,
    });
  }
  return roster;
}

const MAX_ATTEMPTS = 240;

/**
 * The roster's board position at a moment in the round.
 *
 * Each bot plays repeatedly and the board keeps its best, exactly like a real
 * wallet — so a score is the running maximum over its attempts so far. That is
 * what makes the rail move: bests land as discrete jumps at unpredictable
 * moments, whereas a smooth curve towards a fixed peak flattens out after a
 * couple of minutes and the board goes visibly dead for the rest of the round.
 *
 * Still a pure function of (round, seconds): same inputs, same board, for every
 * viewer, with no state anywhere.
 */
export function botsAt(roundIndex, secondsIntoRound, count = BOT_COUNT) {
  return rosterForRound(roundIndex, count)
    .map((b) => {
      const active = secondsIntoRound - b.startsAt;
      if (active <= 0) return null; // has not had a run yet

      const attempts = Math.min(MAX_ATTEMPTS, Math.floor(active / b.every) + 1);
      let best = 0;
      for (let k = 0; k < attempts; k++) {
        const rnd = mulberry32(hash(`${roundIndex}:${b.member}:run:${k}`));
        // Runs improve as they warm up, and most are worse than their ceiling.
        const warm = 0.45 + 0.55 * Math.min(1, k / 9);
        const run = Math.max(1, Math.round(Math.pow(rnd(), 1.55) * b.ceiling * warm));
        if (run > best) best = run;
      }

      return best > 0 ? { member: b.member, score: best, bot: true } : null;
    })
    .filter(Boolean);
}

export { BOT_COUNT };
