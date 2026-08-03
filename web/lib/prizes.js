// The top-3 prize pool.
//
// ⚠ SIMULATED. Nothing here touches a wallet, a contract or a balance — it is a
// display number so the board has stakes while the real economy is being built
// (github.com/nyancity-rh/nyan-economy). Every surface that shows it says so.
//
// The figure is derived from the round index rather than Math.random for two
// reasons: a random value would differ between the server render and the client
// hydration, and a pool that redraws itself every second reads as fake even for
// a mockup. One pool per ten-minute round, identical for everyone, 0.01–0.5 ETH.

export const POOL_MIN = 0.01;
export const POOL_MAX = 0.5;

/** Rank 1 / 2 / 3. Sums to 1. */
export const SPLIT = [0.5, 0.3, 0.2];

function fnv1a(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** This round's pool in ETH. Same answer for everyone, all round long. */
export function poolForRound(index) {
  const t = fnv1a(`nyan.city:round:${index}`) / 0xffffffff;
  return Number((POOL_MIN + t * (POOL_MAX - POOL_MIN)).toFixed(3));
}

/** [{ rank, pct, eth }] for the podium. */
export function prizeSplit(total) {
  return SPLIT.map((pct, i) => ({
    rank: i + 1,
    pct,
    eth: Number((total * pct).toFixed(4)),
  }));
}

/** `0.4212 ETH` → `0.4212`, `0.5000` → `0.5`. Trailing zeros read as noise. */
export function formatEth(eth) {
  return String(Number(eth));
}
