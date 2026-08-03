// Ten-minute rounds.
//
// The board is scoped to a round, so every ten minutes it is a fresh race rather
// than an all-time table the same three wallets sit on forever. Rounds are
// aligned to the UTC wall clock — index = floor(epoch / 10min) — which means the
// server, every player and every stream agree on when the next payout lands
// without anyone having to coordinate.

export const ROUND_MS = 10 * 60 * 1000;

export function roundIndexAt(now = Date.now()) {
  return Math.floor(now / ROUND_MS);
}

export function roundStart(index) {
  return index * ROUND_MS;
}

export function roundEnd(index) {
  return (index + 1) * ROUND_MS;
}

/** Whole seconds until this round pays out. */
export function secondsLeft(index, now = Date.now()) {
  return Math.max(0, Math.ceil((roundEnd(index) - now) / 1000));
}

/** `4:07` */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
