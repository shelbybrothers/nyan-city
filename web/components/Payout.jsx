"use client";
import { useEffect, useMemo, useState } from "react";
import { TrophyIcon } from "./Icons";
import { shortAddress } from "../lib/brand";
import { formatEth } from "../lib/prizes";
import style from "../styles/Payout.module.css";

const SHOW_MS = 14000;
const CONFETTI = 46;

/**
 * The end-of-round celebration.
 *
 * It fires off `round.index` changing rather than off a local timer: the round
 * boundary is wall-clock aligned on the server, so every player and every stream
 * lands on the same moment without any of them agreeing on anything. A tab that
 * was asleep through a rollover shows the result once and then stops — hence the
 * "have I already shown this round" guard.
 */
export default function Payout({ roundIndex, lastRound }) {
  const [shown, setShown] = useState(null); // the round we are celebrating
  const [seenRound, setSeenRound] = useState(null); // the last boundary observed

  useEffect(() => {
    if (roundIndex == null) return;

    // First poll of the session: note where we are, do not celebrate a round we
    // were not here for.
    if (seenRound === null) {
      setSeenRound(roundIndex);
      return;
    }
    if (roundIndex === seenRound) return;

    setSeenRound(roundIndex);
    if (lastRound?.winners?.length) setShown(lastRound);
  }, [roundIndex, seenRound, lastRound]);

  useEffect(() => {
    if (!shown) return undefined;
    const t = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [shown]);

  // Fixed per mount: deterministic offsets beat Math.random in render, which
  // would differ between the server pass and hydration.
  const confetti = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${((i * 13) % 40) / 10}s`,
        duration: `${2.6 + ((i * 7) % 22) / 10}s`,
        hue: (i * 47) % 360,
        size: 5 + (i % 4) * 2,
      })),
    []
  );

  if (!shown) return null;

  return (
    <div className={style.wrap} role="status" data-testid="payout">
      <div className={style.confetti} aria-hidden="true">
        {confetti.map((c, i) => (
          <span
            key={i}
            className={style.bit}
            style={{
              left: c.left,
              animationDelay: c.delay,
              animationDuration: c.duration,
              background: `hsl(${c.hue} 100% 60%)`,
              width: c.size,
              height: c.size * 1.6,
            }}
          />
        ))}
      </div>

      <div className={style.card}>
        <TrophyIcon className={style.trophy} aria-hidden="true" />
        <p className={style.kicker}>Round {shown.index} paid out</p>
        <h2 className={style.title}>Congratulations</h2>
        <p className={style.total}>{formatEth(shown.total)} ETH</p>

        <ol className={style.winners}>
          {shown.winners.map((w) => (
            <li key={w.rank} className={`${style.winner} ${style[`w${w.rank}`]}`}>
              <span className={style.wrank}>#{w.rank}</span>
              <span className={style.waddr}>{shortAddress(w.member)}</span>
              <span className={style.wscore}>{w.score} pts</span>
              <span className={style.weth}>{formatEth(w.eth)} Ξ</span>
            </li>
          ))}
        </ol>

        <p className={style.note}>
          Simulated payout — the on-chain settlement lands with nyan-economy.
        </p>
      </div>
    </div>
  );
}
