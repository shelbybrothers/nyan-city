# nyan.city — $NYAN

A rhythm-runner on the Robinhood Chain. Hold `SPACE` to climb, thread the gaps,
and hold on when the track drops into its Panic phase. Best run per wallet goes
on the board.

- **X** — [x.com/nyancitycoin](https://x.com/nyancitycoin)
- **Token** — `$NYAN`
- **Chain** — Robinhood Chain (EVM `0x1237` / 4663), ETH gas

Forked from [Seek4samurai/project-giga-cat](https://github.com/Seek4samurai/project-giga-cat) (MIT).

---

## Editing the brand

Everything user-visible — the name, the ticker, the X link, the contract address,
the buy link — lives in **[`web/lib/brand.js`](web/lib/brand.js)** and nowhere
else. `npm run verify` fails if any other file hardcodes an X URL.

```js
export const BRAND = {
  name: "nyan.city",
  ticker: "NYAN",
  x: "https://x.com/nyancitycoin",
  ca: "",   // paste the contract address here at launch
  buy: "",  // explicit buy URL; blank derives one from the CA
};
```

While `ca` is empty the CA chip and the Buy button both render **"updating…"**
instead of pointing at a dead link. Fill `ca` in and both go live everywhere —
landing, lobby, leaderboard and the in-game HUD — with no other edit.

## Wallet

Identity only. `web/lib/wallet.js` speaks raw EIP-1193 to whatever wallet is
injected: request the account, switch to Robinhood Chain (adding the network if
the wallet answers `4902`), remember the address. It never asks for a signature
server, a token approval, or a transaction. The upstream build authenticated
against a self-hosted FastAPI service that no longer exists — that whole path is
gone.

## Running it

```bash
cd web && npm install && npm run dev
```

Then <http://localhost:5740>.

### Leaderboard storage

Optional. With `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set, runs
persist in Upstash. Without them the API routes fall back to an in-process sorted
set, so a fresh clone plays and scores correctly and simply forgets on restart.
See [`.env.example`](.env.example).

## Verifying

```bash
cd web && npm run verify
```

53 checks: brand and chain invariants, a production build, every page and asset
over HTTP, the leaderboard API (including that a worse run cannot overwrite a
best), then a headless Chrome pass that boots the engine, plays a real run,
crashes it, and confirms the score reaches the board. The Preview pane throttles
`requestAnimationFrame`, so anything that has to *move* is checked there rather
than by eye.

## Brand assets

`web/public/nyan-logo.png`, `web/public/assets/cat.png` (the in-game sprite),
`favicon.png` and `apple-touch-icon.png` are all cut from one source image by
[`tools/make-assets.mjs`](tools/make-assets.mjs). The palette in
`web/styles/globals.css` — navy `#013568`, nyan green `#c6f403` — is sampled from
that same file, not eyeballed. To re-cut after changing the source:

```bash
NYAN_SRC=/path/to/nyan.png NODE_PATH=/path/to/node_modules node tools/make-assets.mjs
```

(`sharp` is a build-time tool here, deliberately not a dependency of the site.)

The OG card is rendered from [`tools/og.html`](tools/og.html) with headless
Chrome at 1200×630.

---

## Before this goes public

**The five soundtracks in `web/public/soundtracks/` are commercial tracks the
upstream author explicitly did not own** — the original README says so plainly.
They are fine for local play and a liability on a public deploy. Replace the mp3s
with licensed or original audio and re-time each `dropMs` in
[`web/lib/tracks.js`](web/lib/tracks.js); nothing else needs to change.

Nyan Cat is a character created by Christopher Torres, and the sprite here
derives from it. Worth clearing before the domain goes live.

## Deploying

Vercel, with **Root Directory** set to `web`. No environment variables are
required; add the two Upstash ones if you want the leaderboard to persist.

## Licence

MIT, as upstream. See [LICENSE](LICENSE).
