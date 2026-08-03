// nyan.city — rhythm-runner core.
//
// These four files are classic scripts, not modules, so they share one top-level
// scope: bird.js / obstacle.js / particles.js reach `canvas`, `ctx`, `gamespeed`,
// `hue`, `angle`, `frame`, `score` and `spacePresssed` by name from here. Keep the
// declarations below at top level or those files stop resolving.
//
// React owns the DOM and the menu; this file owns the loop. The bridge between
// them is `window.NyanGame` — nothing here queries React's markup or removes its
// nodes, which is what the upstream build did.

let canvas = null;
let ctx = null;
let PanicWindow = null;

let state = false;
let isDead = false;
let spacePresssed = false;
let angle = 0;
let hue = 0;
let frame = 0;
let score = 0;
let gamespeed = 2;

// Set by React from the connected wallet; the board is keyed on it.
let playerAddress = null;
let onEndCallback = null;
let onScoreCallback = null;
let reportedScore = -1;
let autopilot = false;
let rafId = 0;

const background = new Image();
background.src = "/assets/BG.png";

const bang = new Image();
bang.src = "/assets/bang.png";

function animate() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  handleObstacles();
  if (autopilot) steer();

  if (handleCollisions()) {
    isDead = true;
    state = false;
    endRun();
    return;
  }

  bird.update();
  bird.draw();

  ctx.fillStyle = "hsla(" + hue + ", 100%, 50%, 1)";
  ctx.font = "90px Georgia";
  ctx.strokeText(score, 450, 70);
  ctx.fillText(score, 450, 70);

  handleParticles();

  // One notification per pillar cleared, not one per frame — the live board
  // re-sorts on every call.
  if (score !== reportedScore) {
    reportedScore = score;
    if (typeof onScoreCallback === "function") onScoreCallback(score);
  }

  rafId = requestAnimationFrame(animate);
  angle += 0.12;
  hue += 10;
  frame++;
}

window.addEventListener("keydown", function (e) {
  if (e.code === "Space") {
    spacePresssed = true;
    // Keep the page from scrolling out from under a run.
    if (state) e.preventDefault();
  }
});

window.addEventListener("keyup", function (e) {
  if (e.code === "Space") spacePresssed = false;
});

/**
 * Watch-mode pilot. Aims at the middle of the next gap, biased a little high
 * because gravity is always winning: `flap` only nudges vy by -1 a frame while
 * the button is held, so steering late reads as steering not at all.
 */
function steer() {
  let next = null;
  for (let i = 0; i < obstaclesArray.length; i++) {
    const o = obstaclesArray[i];
    if (o.x + o.width < bird.x) continue;
    if (!next || o.x < next.x) next = o;
  }

  const gapTop = next ? next.top : canvas.height * 0.3;
  const gapBottom = next ? canvas.height - next.bottom : canvas.height * 0.7;
  const target = (gapTop + gapBottom) / 2 - 10;

  spacePresssed = bird.y + bird.height / 2 > target;
}

// ── collision ───────────────────────────────────────────────────────────────
function handleCollisions() {
  for (let i = 0; i < obstaclesArray.length; i++) {
    const o = obstaclesArray[i];
    const overlapsColumn = bird.x < o.x + o.width && bird.x + bird.width > o.x;
    const hitsTop = bird.y < o.top && bird.y + bird.height > 0;
    const hitsBottom =
      bird.y > canvas.height - o.bottom && bird.y + bird.height < canvas.height;

    if (overlapsColumn && (hitsTop || hitsBottom)) {
      ctx.drawImage(bang, bird.x, bird.y, 50, 50);
      ctx.font = "25px Georgia";
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.fillText(
        "Run over — " + score + " pts",
        canvas.width / 2,
        canvas.height / 2 - 10
      );
      ctx.textAlign = "start";
      return true;
    }
  }
  return false;
}

/** File the run, then hand control back to React for the end-of-run UI. */
function endRun() {
  cancelAnimationFrame(rafId);
  const final = score;
  submitScore(playerAddress, final);
  if (typeof onEndCallback === "function") onEndCallback(final);
}

async function submitScore(address, points) {
  if (!address) return; // an unauthenticated run is not board-worthy
  try {
    await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: address, score: points }),
    });
  } catch (err) {
    console.warn("[nyan.city] could not file that run:", err);
  }
}

// ── bridge ──────────────────────────────────────────────────────────────────
window.NyanGame = {
  /** Bind to the canvas React just rendered. Safe to call on every mount. */
  mount(canvasEl, panicEl) {
    canvas = canvasEl;
    PanicWindow = panicEl || null;
    if (!canvas) return false;
    ctx = canvas.getContext("2d");
    canvas.width = 600;
    canvas.height = 400;
    return true;
  },

  setPlayer(address) {
    playerAddress = address || null;
  },

  onEnd(cb) {
    onEndCallback = cb;
  },

  /** Fires with the new total each time a pillar is cleared. */
  onScore(cb) {
    onScoreCallback = cb;
  },

  /** Hand the controls to the pilot — watch mode only. */
  autopilot(on) {
    autopilot = Boolean(on);
    if (!autopilot) spacePresssed = false;
  },

  /** Fresh run: zero the state the four scripts share, then loop. */
  start() {
    if (!canvas || !ctx) return false;
    cancelAnimationFrame(rafId);

    state = true;
    isDead = false;
    angle = 0;
    hue = 0;
    frame = 0;
    score = 0;
    reportedScore = -1;
    gamespeed = 2;
    obstaclesArray.length = 0;
    particlesArray.length = 0;
    bird.reset();

    if (PanicWindow) PanicWindow.style.display = "none";
    animate();
    return true;
  },

  /** The drop landed: everything speeds up and the panic frame comes in. */
  enterPanic() {
    if (!state) return;
    gamespeed = 10;
    if (PanicWindow) PanicWindow.style.display = "block";
  },

  stop() {
    state = false;
    cancelAnimationFrame(rafId);
  },

  get score() {
    return score;
  },
  get running() {
    return state;
  },
};
