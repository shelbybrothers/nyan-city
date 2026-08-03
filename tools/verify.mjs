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
import { fileURLToPath } from "node:url";

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
  console.log("\n§5 browser");
  const { evaluate, goto, cleanup } = await cdp();

  try {
    await goto(BASE + "/");
    check(
      "landing renders the connect button",
      Boolean(await evaluate('!!document.querySelector(\'[data-testid="connect"]\')'))
    );
    check(
      "the CA chip says updating until a CA exists",
      /updating/.test(await evaluate('document.querySelector(\'[data-testid="chip-ca"]\')?.textContent || ""'))
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

    await evaluate('document.querySelector(\'[data-testid="start"]\').click()');
    await sleep(2500);
    check("the run is live", Boolean(await evaluate("window.NyanGame.running")));

    // Canvas must be painting, not just present.
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
