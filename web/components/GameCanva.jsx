"use client";
import { useRouter } from "next/router";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import TokenBar from "./TokenBar";
import { ExitIcon, PlayIcon, TrophyIcon, XLogo } from "./Icons";
import { CatMark } from "./Logo";
import { BRAND, shortAddress } from "../lib/brand";
import { pickQuote } from "../lib/quotes";
import { pickTrack } from "../lib/tracks";
import style from "../styles/InGame.module.css";

// bird.js / obstacle.js / particles.js each bump window.__nyanParts once they
// have defined their half of the shared scope. main.js publishes window.NyanGame.
// The loop is only safe to start when all four have landed — they load async, so
// arrival order is not guaranteed.
const PART_COUNT = 3;

const GameCanva = ({ address }) => {
  const router = useRouter();
  const canvasRef = useRef(null);
  const panicRef = useRef(null);
  const audioRef = useRef(null);
  const dropTimer = useRef(null);

  const [engineReady, setEngineReady] = useState(false);
  const [phase, setPhase] = useState("menu"); // menu | running | over
  const [lastScore, setLastScore] = useState(0);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [quote, setQuote] = useState("");

  useEffect(() => setQuote(pickQuote()), []);

  // Poll for the engine instead of guessing at script order.
  useEffect(() => {
    let raf = 0;
    const check = () => {
      if (window.NyanGame && (window.__nyanParts || 0) >= PART_COUNT) {
        setEngineReady(true);
        return;
      }
      raf = requestAnimationFrame(check);
    };
    check();
    return () => cancelAnimationFrame(raf);
  }, []);

  const stopAudio = useCallback(() => {
    clearTimeout(dropTimer.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  // Bind the canvas and the player once the engine is up.
  useEffect(() => {
    if (!engineReady) return;
    const game = window.NyanGame;
    game.mount(canvasRef.current, panicRef.current);
    game.setPlayer(address || null);
    game.onEnd((final) => {
      stopAudio();
      setLastScore(final);
      setPhase("over");
    });

    return () => {
      game.onEnd(null);
      game.stop();
      stopAudio();
    };
  }, [engineReady, address, stopAudio]);

  const startRun = useCallback(() => {
    const game = window.NyanGame;
    if (!game?.start) {
      toast.error("The engine is still loading — one moment.");
      return;
    }

    stopAudio();
    const track = pickTrack();
    setNowPlaying(track.title);

    const audio = new Audio(track.src);
    audio.volume = 0.7;
    audioRef.current = audio;
    // The run does not wait on the audio: an autoplay refusal should cost you the
    // music, not the game. The drop is scheduled either way.
    audio.play().catch(() => {
      toast("Sound is blocked in this tab — playing without it.");
    });

    dropTimer.current = setTimeout(() => game.enterPanic(), track.dropMs);

    setLastScore(0);
    setPhase("running");
    game.start();
  }, [stopAudio]);

  const leave = useCallback(() => {
    window.NyanGame?.stop();
    stopAudio();
    router.push("/dashboard");
  }, [router, stopAudio]);

  return (
    <>
      {/* afterInteractive: the canvas exists before any of this runs. */}
      <Script src="/scripts/main.js" strategy="afterInteractive" />
      <Script src="/scripts/bird.js" strategy="afterInteractive" />
      <Script src="/scripts/particles.js" strategy="afterInteractive" />
      <Script src="/scripts/obstacle.js" strategy="afterInteractive" />

      <div className={style.stage}>
        <header className={style.hud}>
          <div className={style.hudLeft}>
            <CatMark width={68} className={style.hudMark} />
            <div>
              <h1 className={style.hudTitle}>{BRAND.name}</h1>
              <p className={style.address} data-testid="game-address">
                {address ? `Playing as ${shortAddress(address)}` : "Guest run"}
              </p>
            </div>
          </div>
          <TokenBar compact className={style.hudTokens} />
        </header>

        <div className={style.arena}>
          <canvas className={style.canvas1} id="canvas1" ref={canvasRef} />
          <div className={style.box} id="box" ref={panicRef} />

          {phase === "menu" && (
            <div className={style.overlay} data-testid="menu">
              <p className={style.quote}>&ldquo;{quote}&rdquo;</p>
              <button
                className={style.primary}
                onClick={startRun}
                disabled={!engineReady}
                data-testid="start"
              >
                <PlayIcon className={style.btnIcon} aria-hidden="true" />
                {engineReady ? "Play" : "Loading…"}
              </button>
              <p className={style.hint}>
                Hold <kbd>SPACE</kbd> to climb. The drop hits mid-track.
              </p>
              <div className={style.row}>
                <button className={style.ghost} onClick={() => router.push("/leaderboard")}>
                  <TrophyIcon className={style.btnIcon} aria-hidden="true" />
                  Leaderboard
                </button>
                <a
                  className={style.ghost}
                  href={BRAND.x}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <XLogo className={style.btnIcon} aria-hidden="true" />
                  Follow
                </a>
                <button className={style.ghost} onClick={leave}>
                  <ExitIcon className={style.btnIcon} aria-hidden="true" />
                  Lobby
                </button>
              </div>
            </div>
          )}

          {phase === "over" && (
            <div className={style.overlay} data-testid="run-over">
              <p className={style.overTitle}>Run over</p>
              <p className={style.overScore}>
                {lastScore} <span>pts</span>
              </p>
              <p className={style.hint}>
                {address
                  ? "Filed under your wallet."
                  : "Connect a wallet to get on the board."}
              </p>
              <button className={style.primary} onClick={startRun} data-testid="again">
                <PlayIcon className={style.btnIcon} aria-hidden="true" />
                Again
              </button>
              <div className={style.row}>
                <button className={style.ghost} onClick={() => router.push("/leaderboard")}>
                  <TrophyIcon className={style.btnIcon} aria-hidden="true" />
                  Leaderboard
                </button>
                <button className={style.ghost} onClick={leave}>
                  <ExitIcon className={style.btnIcon} aria-hidden="true" />
                  Lobby
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className={style.footer}>
          {phase === "running" && nowPlaying ? (
            <span className={style.track}>Now playing — {nowPlaying}</span>
          ) : (
            <span className={style.track}>Above 50 pts the track goes Panic.</span>
          )}
        </footer>
      </div>
    </>
  );
};

export default GameCanva;
