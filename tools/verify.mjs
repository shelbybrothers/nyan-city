// nyan.city verification harness.
//
//   cd web && npm run verify
//
// Boots the production build on a scratch port, runs a set of invariants against
// it over HTTP, then drives a headless Chrome through the actual game — connect
// gate, engine boot, a scored run, the run-over overlay, the score landing on the
// board. Exits non-zero on the first failure with the reason.
//
// The Preview pane throttles requestAnimationFrame, so anything that has to
// *move* is checked here, in a real browser, not by looking at the pane.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const WEB = path.join(ROOT, "web");
const PORT = Number(process.env.VERIFY_PORT || 5749);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let passed = 0;
const failures = [];

// Filled in by staticChecks, read by the HTTP and browser passes.
const brandState = { ca: "", buy: "" };

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? " — " + detail : ""}`);
    console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. static invariants, no server needed ──────────────────────────────────
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(jsx?|css)$/.test(full)) out.push(full);
  }
  return out;
}

function staticChecks() {
  console.log("\n§1 source invariants");

  const brand = readFileSync(path.join(WEB, "lib", "brand.js"), "utf8");
  check("brand.js names nyan.city", brand.includes('name: "nyan.city"'));
  check("brand.js ticker is NYAN", brand.includes('ticker: "NYAN"'));
  check("brand.js X points at nyancitycoin", brand.includes("x.com/nyancitycoin"));

  // Whether a CA is set changes what several surfaces render, so read it once
  // here and let the rest of the suite branch on it.
  const caMatch = brand.match(/\n\s*ca:\s*"([^"]*)"/);
  const CA = caMatch ? caMatch[1] : "";
  const buyMatch = brand.match(/\n\s*buy:\s*"([^"]*)"/);
  const BUY = buyMatch ? buyMatch[1] : "";
  check("a CA is either a 0x address or empty", CA === "" || /^0x[0-9a-fA-F]{40}$/.test(CA), CA);
  check("a buy link is either https or empty", BUY === "" || BUY.startsWith("https://"), BUY);
  brandState.ca = CA;
  brandState.buy = BUY;

  // The whole point of lib/brand.js is that nothing else hardcodes the handle,
  // the ticker string or the contract address.
  const files = sourceFiles(WEB).filter((f) => !f.endsWith(path.join("lib", "brand.js")));
  const strays = files.filter((f) => /x\.com\/|twitter\.com\//.test(readFileSync(f, "utf8")));
  check("no file but brand.js hardcodes an X url", strays.length === 0, strays.join(", "));

  const chain = readFileSync(path.join(WEB, "lib", "chain.js"), "utf8");
  check("chain is Robinhood Chain 0x1237", chain.includes('idHex: "0x1237"') && chain.includes("id: 4663"));
  check("chain rpc is the mainnet endpoint", chain.includes("rpc.mainnet.chain.robinhood.com"));

  const wallet = readFileSync(path.join(WEB, "lib", "wallet.js"), "utf8");
  check("wallet uses raw EIP-1193", wallet.includes("eth_requestAccounts"));
  check("wallet adds the chain on 4902", wallet.includes("wallet_addEthereumChain") && wallet.includes("4902"));
  check("wallet never asks for an approval", !/eth_sendTransaction|eth_sign|personal_sign|approve\(/.test(wallet));

  // The upstream build authenticated against a self-hosted service that no
  // longer exists; nothing may reach for it again.
  const anyLocalhost8000 = files.filter((f) => readFileSync(f, "utf8").includes("localhost:8000"));
  check("the dead FastAPI auth is gone", anyLocalhost8000.length === 0, anyLocalhost8000.join(", "));

  // Emoji in the chrome reads as cheap; icons are vectors.
  // Comments are not UI. Strip them before looking, or a warning glyph in a
  // licensing note reads as an emoji button.
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const stripComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const withEmoji = files.filter((f) => emoji.test(stripComments(readFileSync(f, "utf8"))));
  check("no emoji in the UI", withEmoji.length === 0, withEmoji.join(", "));

  const globals = readFileSync(path.join(WEB, "styles", "globals.css"), "utf8");
  check("palette is the sampled navy", globals.includes("#013568"));
  check("palette is the sampled nyan green", globals.includes("#c6f403"));

  const main = readFileSync(path.join(WEB, "public", "scripts", "main.js"), "utf8");
  check("engine exposes the NyanGame bridge", main.includes("window.NyanGame"));
  check("engine does not tear out React's DOM", !main.includes("removeChild"));
}

// ── 2. HTTP invariants ──────────────────────────────────────────────────────
async function httpChecks() {
  console.log("\n§2 pages and assets");

  const landing = await fetch(BASE + "/");
  const html = await landing.text();
  check("GET / is 200", landing.status === 200, String(landing.status));
  check("landing says nyan.city", html.includes("nyan.city"));
  check("landing shows $NYAN", html.includes("$NYAN"));
  check("landing links X", html.includes("x.com/nyancitycoin"));
  check('landing offers a Buy chip', html.includes('data-testid="chip-buy"'));
  check('landing offers a CA chip', html.includes('data-testid="chip-ca"'));
  check("landing names Robinhood Chain", html.includes("Robinhood Chain"));
  check("landing links the GitHub repo", html.includes("github.com/nyancity-rh/nyan-economy"));
  check("no upstream branding survives", !/giga\s?cat|gigacat|MetaMask not found/i.test(html));
  check("og image is declared", html.includes("nyan-og.png"));

  for (const route of ["/dashboard", "/game", "/leaderboard"]) {
    const res = await fetch(BASE + route);
    check(`GET ${route} is 200`, res.status === 200, String(res.status));
  }

  console.log("\n§3 assets");
  for (const asset of [
    "/favicon.png",
    "/apple-touch-icon.png",
    "/nyan-logo.png",
    "/nyan-og.png",
    "/assets/cat.png",
    "/scripts/main.js",
    "/scripts/bird.js",
  ]) {
    const res = await fetch(BASE + asset);
    const buf = Buffer.from(await res.arrayBuffer());
    const okPng = !asset.endsWith(".png") || buf.subarray(1, 4).toString() === "PNG";
    check(`GET ${asset}`, res.status === 200 && buf.length > 0 && okPng, String(res.status));
  }

  console.log("\n§4 leaderboard api");
  const empty = await fetch(BASE + "/api/search");
  const emptyBody = await empty.json();
  check("GET /api/search is 200", empty.status === 200);
  check("search returns an array", Array.isArray(emptyBody.scores));

  const addr = "0x" + "ab".repeat(20);
  const post = await fetch(BASE + "/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, score: 4242 }),
  });
  check("POST /api/score is 201", post.status === 201, String(post.status));

  const after = await (await fetch(BASE + "/api/search")).json();
  const mine = after.scores.find((s) => s.member === addr);
  check("the run lands on the board", Boolean(mine) && mine.score === 4242);

  // A worse run must not overwrite a better one.
  await fetch(BASE + "/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, score: 5 }),
  });
  const kept = (await (await fetch(BASE + "/api/search")).json()).scores.find(
    (s) => s.member === addr
  );
  check("a worse run cannot erase a best", kept?.score === 4242, String(kept?.score));

  const bad = await fetch(BASE + "/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score: 10 }),
  });
  check("POST without an address is rejected", bad.status === 400, String(bad.status));

  const wrongVerb = await fetch(BASE + "/api/score");
  check("GET /api/score is 405", wrongVerb.status === 405, String(wrongVerb.status));

  console.log("\n§4b prize pool");
  const withPool = await (await fetch(BASE + "/api/search?count=20")).json();
  const pool = withPool.pool;
  check("search carries a pool", Boolean(pool));
  check("the pool is flagged simulated", pool?.simulated === true);
  check(
    "the pool sits in the 0.01–0.5 ETH band",
    pool?.total >= 0.01 && pool?.total <= 0.5,
    String(pool?.total)
  );
  check("three ranks are paid", pool?.splits?.length === 3);
  check(
    "the splits add up to the pool",
    Math.abs(pool.splits.reduce((n, s2) => n + s2.eth, 0) - pool.total) < 0.005
  );
  check(
    "first place pays the most",
    pool.splits[0].eth > pool.splits[1].eth && pool.splits[1].eth > pool.splits[2].eth
  );
  // Stable for the day, or the number flickers between SSR and hydration.
  const again = (await (await fetch(BASE + "/api/search")).json()).pool;
  check("the pool is stable across requests", again.total === pool.total);
  check("search can return 20 rows", (await fetch(BASE + "/api/search?count=20")).ok);

  console.log("\n§4d bot runners");
  const botted = await (await fetch(BASE + "/api/search?count=20")).json();
  const bots = botted.bots || [];
  const into = 600 - botted.round.secondsLeft;
  const expected = into < 15 ? 2 : into < 40 ? 8 : 12;
  check(
    "the board is populated with bots",
    bots.length >= expected,
    `${bots.length} at ${into}s into the round, wanted ${expected}`
  );
  check("every bot is labelled a bot", bots.every((b) => b.bot === true));
  check(
    "bot wallets look like wallets",
    bots.every((b) => /^0x[0-9a-f]{40}$/.test(b.member))
  );
  check("bot wallets are all distinct", new Set(bots.map((b) => b.member)).size === bots.length);
  // Pace-setters, not a wall: a real player has to be able to beat these.
  check(
    "bot scores stay small",
    bots.every((b) => b.score > 0 && b.score <= 40),
    `max ${Math.max(0, ...bots.map((b) => b.score))}`
  );
  // Same round, same bots — every viewer must see one board, not their own.
  const again2 = await (await fetch(BASE + "/api/search?count=20")).json();
  check(
    "the roster is identical between requests",
    JSON.stringify(again2.bots.map((b) => b.member)) ===
      JSON.stringify(bots.map((b) => b.member))
  );
  check(
    "bot scores only ever climb",
    again2.bots.every((b) => {
      const before = bots.find((x) => x.member === b.member);
      return !before || b.score >= before.score;
    })
  );
  // The whole point: a generated wallet must never be able to take a payout.
  check(
    "no bot is in the settled winners",
    !(withPool.lastRound.winners || []).some((w) => bots.some((b) => b.member === w.member))
  );
  check(
    "bots are absent from the real board",
    !botted.scores.some((row) => bots.some((b) => b.member === row.member))
  );

  console.log("\n§4c ten-minute rounds");
  const round = withPool.round;
  check("search carries a round", Boolean(round));
  check("the round is ten minutes", round?.lengthMs === 600000, String(round?.lengthMs));
  check(
    "the round is wall-clock aligned",
    round?.endsAt % 600000 === 0,
    String(round?.endsAt)
  );
  check(
    "the countdown is inside the round",
    round?.secondsLeft > 0 && round?.secondsLeft <= 600,
    String(round?.secondsLeft)
  );
  check(
    "the round index matches the clock",
    round?.index === Math.floor(round.now / 600000)
  );
  check("the previous round is settled", Array.isArray(withPool.lastRound?.winners));
  check(
    "a settled round is frozen",
    JSON.stringify(
      (await (await fetch(BASE + "/api/search")).json()).lastRound.winners
    ) === JSON.stringify(withPool.lastRound.winners)
  );
  // A run is filed against the round the server is in, not one the client names.
  const roundedPost = await fetch(BASE + "/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: addr, score: 9, round: 1 }),
  });
  const posted = await roundedPost.json();
  check("the server picks the round", posted.round === round.index, String(posted.round));
}

// ── 3. browser: the parts that have to actually move ────────────────────────
async function cdp() {
  const profile = mkdtempSync(path.join(tmpdir(), "nyan-verify-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--remote-debugging-port=9333",
      `--user-data-dir=${profile}`,
      "--autoplay-policy=no-user-gesture-required",
      "--window-size=1200,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
      target = list.find((t) => t.type === "page");
    } catch {
      /* not up yet */
    }
  }
  if (!target) throw new Error("headless Chrome never came up");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let id = 0;
  const waiting = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) {
      waiting.get(msg.id)(msg);
      waiting.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const n = ++id;
      waiting.set(n, res);
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.result?.exceptionDetails) {
      throw new Error(r.result.exceptionDetails.text + " :: " + expression.slice(0, 80));
    }
    return r.result?.result?.value;
  };

  const goto = async (url) => {
    await send("Page.navigate", { url });
    for (let i = 0; i < 80; i++) {
      await sleep(150);
      const ready = await evaluate("document.readyState");
      if (ready === "complete") return;
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");

  const cleanup = () => {
    try { ws.close(); } catch {}
    chrome.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };

  return { evaluate, goto, cleanup };
}

async function browserChecks() {
  console.log("\n§5 watch mode");
  const watchHtml = await (await fetch(BASE + "/watch")).text();
  check("GET /watch is 200", (await fetch(BASE + "/watch")).status === 200);
  check("watch mode carries the rail", watchHtml.includes('data-testid="live-board"'));
  check("landing offers the live feed", (await (await fetch(BASE + "/")).text()).includes('href="/watch"'));

  const botsSrc = readFileSync(path.join(WEB, "lib", "bots.js"), "utf8");
  check("bots are never written to the store", !/submitScore|redis|zadd/.test(botsSrc));

  const { botsAt } = await import(pathToFileURL(path.join(WEB, "lib", "bots.js")).href);
  const sample = (t) => botsAt(4242, t);
  check("the roster is pure", JSON.stringify(sample(300)) === JSON.stringify(sample(300)));
  check("the roster grows over a round", sample(560).length > sample(60).length);
  check(
    "bots climb slowly",
    Math.max(...sample(60).map((b) => b.score)) <= 12,
    `top at 60s is ${Math.max(...sample(60).map((b) => b.score))}`
  );
  check(
    "bots finish the round small",
    Math.max(...sample(600).map((b) => b.score)) <= 30,
    `top at 600s is ${Math.max(...sample(600).map((b) => b.score))}`
  );
  check(
    "bot bests never go backwards",
    sample(560).every((late) => {
      const early = sample(200).find((e) => e.member === late.member);
      return !early || late.score >= early.score;
    })
  );
  check(
    "the board keeps moving through a round",
    (() => {
      let moves = 0;
      let prev = "";
      for (let t = 0; t <= 600; t += 1) {
        const now = JSON.stringify(sample(t));
        if (t && now !== prev) moves++;
        prev = now;
      }
      return moves >= 60;
    })()
  );

  const engine = readFileSync(path.join(WEB, "public", "scripts", "main.js"), "utf8");
  check("the engine has a pilot", engine.includes("function steer(") && engine.includes("autopilot"));

  console.log("\n§6 browser");
  const { evaluate, goto, cleanup } = await cdp();

  try {
    await goto(BASE + "/");
    check(
      "landing renders the connect button",
      Boolean(await evaluate('!!document.querySelector(\'[data-testid="connect"]\')'))
    );
    const caChip = await evaluate(
      'document.querySelector(\'[data-testid="chip-ca"]\')?.textContent || ""'
    );
    check(
      brandState.ca ? "the CA chip shows the contract" : "the CA chip says updating",
      brandState.ca
        ? caChip.includes(brandState.ca.slice(0, 6)) && caChip.includes(brandState.ca.slice(-4))
        : /updating/.test(caChip),
      caChip
    );

    const buyHref = await evaluate(
      'document.querySelector(\'[data-testid="chip-buy"]\')?.href || ""'
    );
    check(
      brandState.buy ? "the Buy chip links out" : "the Buy chip says updating",
      brandState.buy ? buyHref === brandState.buy : buyHref === "",
      buyHref
    );
    check(
      "the X chip points at the right handle",
      (await evaluate('document.querySelector(\'[data-testid="chip-x"]\')?.href || ""')).includes(
        "x.com/nyancitycoin"
      )
    );
    check(
      "the logo is the source art",
      (await evaluate('document.querySelector("img")?.src || ""')).includes("nyan-logo.png")
    );

    // No session: the gated routes must bounce back to the door.
    await evaluate("localStorage.clear()");
    await goto(BASE + "/game");
    await sleep(900);
    check(
      "an unauthenticated /game redirects home",
      new URL(await evaluate("location.href")).pathname === "/"
    );

    // With a session, the engine has to boot and a run has to score.
    const player = "0x" + "cd".repeat(20);
    await evaluate(
      `localStorage.setItem("nyan.address", ${JSON.stringify(player)});` +
        `localStorage.setItem("nyan.session", String(Date.now())); true`
    );
    await goto(BASE + "/game");

    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      await sleep(200);
      ready = Boolean(await evaluate("!!(window.NyanGame && (window.__nyanParts||0) >= 3)"));
    }
    check("the engine boots", ready);
    check(
      "the engine knows the player",
      Boolean(await evaluate('!!document.querySelector(\'[data-testid="game-address"]\')'))
    );

    check(
      "the live board is beside the arena",
      Boolean(await evaluate('!!document.querySelector(\'[data-testid="live-board"]\')'))
    );

    const railRows = await evaluate(
      'document.querySelectorAll(\'[data-testid="live-board"] li\').length'
    );
    check("the rail fills up with runners", railRows >= 3, `${railRows} rows`);
    // The flag stays in the API — the payout logic reads it — but no row is
    // labelled in the UI.
    check(
      "no row is labelled a bot",
      !/\bbot\b/i.test(
        await evaluate('document.querySelector(\'[data-testid="live-board"]\').textContent')
      )
    );
    // The rail recomputes the roster on a one-second tick rather than waiting on
    // the four-second poll. The countdown rides that same tick, so watching it
    // move proves the loop is live without racing an unpredictable new best.
    const clock = () =>
      evaluate('document.querySelector(\'[data-testid="round-clock"]\')?.textContent || ""');
    const t0 = await clock();
    let ticked = false;
    for (let i = 0; i < 6 && !ticked; i++) {
      await sleep(500);
      ticked = (await clock()) !== t0;
    }
    check("the rail counts in realtime", ticked, `${t0} -> ${await clock()}`);

    // Outside the top 20 your row must still be reachable. Pin the field full of
    // pace-setters above a zero-score player and the pinned row has to appear.
    const you = await evaluate(`(() => {
      const el = document.querySelector('[data-testid="you-pinned"]');
      return el ? el.textContent : null;
    })()`);
    check("the player always has a standing strip", Boolean(you), String(you));
    check("the strip carries a rank", /#\d+\/\d+/.test(you || ""), String(you));
    check(
      "the strip says what the money costs",
      /to the money|paid/.test(you || ""),
      String(you)
    );
    check(
      "the prize pool is on the rail",
      /ETH/.test(
        await evaluate('document.querySelector(\'[data-testid="prize-pool"]\')?.textContent || ""')
      )
    );

    await evaluate('document.querySelector(\'[data-testid="start"]\').click()');
    await sleep(2500);
    check("the run is live", Boolean(await evaluate("window.NyanGame.running")));

    // The player's own row has to appear and climb while the run is going, not
    // only once the score has been posted.
    const rowNow = () =>
      evaluate(`(() => {
        const rows = [...document.querySelectorAll('[data-testid="live-board"] li')];
        const me = rows.find((r) => r.textContent.includes("you"));
        return me ? Number(me.textContent.match(/(\\d+)\\s*$/)?.[1] ?? -1) : -1;
      })()`);

    check("the player appears on the live board mid-run", (await rowNow()) >= 0);

    // An untouched bird dies on the first pillar it reaches, before it can score
    // — so proving the rail climbs by playing well is not a test, it is luck.
    // Push the engine's counter instead: what is under test is the wiring from
    // the engine's per-pillar callback through React to the rail, not whether
    // this harness can play a rhythm game.
    await evaluate("score = 7");
    let climbed = -1;
    for (let i = 0; i < 12 && climbed < 7; i++) {
      await sleep(250);
      climbed = await rowNow();
    }
    check("the live board climbs as pillars are cleared", climbed >= 7, `row shows ${climbed}`);

    const painted = await evaluate(`(() => {
      const c = document.getElementById("canvas1");
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) lit++;
      return lit;
    })()`);
    check("the canvas is being drawn to", painted > 1000, `${painted} lit pixels`);

    // Drive it into the ceiling to end the run deterministically.
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }))');
    await sleep(6000);
    await evaluate('window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }))');
    await sleep(1500);

    const over = await evaluate('!!document.querySelector(\'[data-testid="run-over"]\')');
    check("a crash ends the run and shows the overlay", Boolean(over));

    // The row used to blank out here, between the run ending and the next poll.
    check("the row survives the run ending", (await rowNow()) >= 0);

    // Watch mode: no wallet, no menu, and it puts itself back on its feet.
    await evaluate("localStorage.clear()");
    await goto(BASE + "/watch?clean=1");
    await sleep(3500);
    check(
      "watch mode starts itself",
      Boolean(await evaluate("!!(window.NyanGame && window.NyanGame.running)"))
    );
    check(
      "watch mode shows no menu",
      !(await evaluate('!!document.querySelector(\'[data-testid="menu"]\')'))
    );
    check(
      "clean mode drops the chrome",
      !(await evaluate('!!document.querySelector(\'[data-testid="token-bar"]\')'))
    );

    // The pilot has to survive longer than a bird nobody is flying, and score.
    await sleep(9000);
    const flown = await evaluate("window.NyanGame.score");
    check("the pilot clears pillars", flown >= 2, `score ${flown}`);

    const boardAfter = await (await fetch(BASE + "/api/search?count=25")).json();
    check(
      "a watch run never reaches the board",
      !boardAfter.scores.some((s2) => String(s2.member).toLowerCase().includes("null")),
      JSON.stringify(boardAfter.scores.slice(0, 3))
    );

    if (over) {
      const board = await (await fetch(BASE + "/api/search?count=25")).json();
      check(
        "the finished run reaches the board",
        board.scores.some((s) => s.member === player),
        JSON.stringify(board.scores.slice(0, 3))
      );
    }
  } finally {
    cleanup();
  }
}

// ── run ─────────────────────────────────────────────────────────────────────
console.log("nyan.city — verify");

staticChecks();

console.log("\nbuilding…");
const built = spawnSync("npm", ["run", "build"], { cwd: WEB, encoding: "utf8" });
if (built.status !== 0) {
  console.error(built.stdout?.slice(-3000) || "", built.stderr?.slice(-3000) || "");
  console.error("\nbuild failed — nothing further to verify");
  process.exit(1);
}
check("production build succeeds", true);

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  cwd: WEB,
  stdio: "ignore",
});

let up = false;
for (let i = 0; i < 80 && !up; i++) {
  await sleep(250);
  try {
    up = (await fetch(BASE + "/")).ok;
  } catch {
    /* still booting */
  }
}

try {
  if (!up) throw new Error(`server never answered on ${BASE}`);
  await httpChecks();
  await browserChecks();
} catch (err) {
  failures.push(`harness: ${err.message}`);
} finally {
  server.kill();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("all green");
