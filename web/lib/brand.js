// ─────────────────────────────────────────────────────────────────────────────
//  nyan.city — ONE place to edit the brand, the token and the socials.
//  Every page, chip and <head> tag below reads from here. Nothing else hardcodes
//  the ticker, the contract address or a link.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = {
  name: "nyan.city",
  ticker: "NYAN", // rendered as $NYAN everywhere
  tagline: "Ride the beat. Hold the line.",
  description:
    "A rhythm-runner on the Robinhood Chain. Dodge to the drop, climb the board, hold $NYAN.",
  url: "https://nyan.city",

  // ── socials ───────────────────────────────────────────────────────────────
  x: "https://x.com/nyancitycoin", // X / Twitter
  tg: "", // '' hides the Telegram button

  // ── token ─────────────────────────────────────────────────────────────────
  // Paste the contract address here the moment it exists. Empty string ⇒ every
  // CA chip in the UI renders "updating…" instead of a copyable address, and the
  // Buy button goes into its own "updating…" state. Nothing else to change.
  ca: "",

  // Explicit buy URL. Leave '' to derive it from the CA (see BUY_URL below).
  buy: "",
};

/** `$NYAN` — the ticker with its sigil, for display. */
export const TICKER = `$${BRAND.ticker}`;

/** `@nyancitycoin`, derived from BRAND.x so the handle is never typed twice. */
export const X_HANDLE = BRAND.x
  ? `@${BRAND.x.replace(/\/+$/, "").split("/").pop()}`
  : "";

/**
 * Where the Buy button points.
 *   1. an explicit BRAND.buy always wins
 *   2. otherwise, once a CA exists, the Robinhood-chain launchpad page for it
 *   3. otherwise '' — the UI shows "updating…" rather than a dead link
 */
export const BUY_URL =
  BRAND.buy || (BRAND.ca ? `https://ponsfamily.com/launchpad/${BRAND.ca}` : "");

/** True once there is a real contract address to copy. */
export const HAS_CA = Boolean(BRAND.ca);

/** `0x1234…cdef` — the address, shortened for a chip. */
export function shortCA(ca = BRAND.ca) {
  if (!ca) return "";
  return ca.length > 14 ? `${ca.slice(0, 6)}…${ca.slice(-4)}` : ca;
}

/** `0x1234…cdef` for any wallet address (same shape as the CA chip). */
export function shortAddress(address) {
  if (!address) return "";
  return address.length > 14
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}
