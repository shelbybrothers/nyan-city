"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { TrophyIcon } from "./Icons";
import { shortAddress } from "../lib/brand";
import Payout from "./Payout";
import { formatEth } from "../lib/prizes";
import { formatCountdown, roundIndexAt, secondsLeft } from "../lib/rounds";
import style from "../styles/LiveBoard.module.css";

const TOP_N = 20;
const POLL_MS = 4000;

/**
 * The rail beside the arena: top 20, updating live.
 *
 * "Live" is two separate things stitched together —
 *   · the player's own row moves the instant a pillar is cleared, driven by
 *     `liveScore` straight off the engine, so climbing is felt, not waited for;
 *   · everyone else arrives on a poll, because a finished run is only durable
 *     once the server has it.
 * Merging the two means the rail never shows you below a score you have already
 * beaten, which is what a purely server-driven board would do for four seconds
 * at a time.
 */
export default function LiveBoard({ address, liveScore = 0, running = false }) {
  const [rows, setRows] = useState([]);
  const [pool, setPool] = useState(null);
  const [storage, setStorage] = useState(null);
  const [round, setRound] = useState(null);
  const [lastRound, setLastRound] = useState(null);
  const [left, setLeft] = useState(null);
  const timer = useRef(null);
  const skew = useRef(0);

  useEffect(() => {
    let alive = true;

    const pull = async () => {
      try {
        const res = await fetch(`/api/search?count=${TOP_N}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setRows(Array.isArray(data.scores) ? data.scores : []);
        setPool(data.pool || null);
        setStorage(data.storage || null);
        setRound(data.round || null);
        setLastRound(data.lastRound || null);
        // Tick the countdown locally against the server's clock, not the
        // browser's — a viewer with a skewed clock would otherwise see a
        // countdown that disagrees with when the payout actually fires.
        if (data.round?.now) skew.current = data.round.now - Date.now();
        if (typeof data.round?.secondsLeft === "number") setLeft(data.round.secondsLeft);
      } catch {
        /* a dropped poll is not worth surfacing — the next one is 4s away */
      }
    };

    pull();
    timer.current = setInterval(pull, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer.current);
    };
  }, []);

  // One-second tick between polls so the countdown reads as a countdown.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now() + skew.current;
      setLeft(secondsLeft(roundIndexAt(now), now));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const merged = useMemo(() => {
    const list = rows.map((r) => ({ ...r, live: false }));

    if (address) {
      const mine = list.find(
        (r) => String(r.member).toLowerCase() === address.toLowerCase()
      );
      // liveScore counts whether or not the run is still going: when it ends,
      // it holds the final total, and dropping it here would blank the row for
      // the seconds between the run finishing and the next poll landing.
      const best = Math.max(mine?.score ?? 0, liveScore);

      if (mine) {
        mine.score = best;
        mine.live = running;
      } else if (running || best > 0) {
        list.push({ member: address, score: best, live: running });
      }
    }

    return list.sort((a, b) => b.score - a.score).slice(0, TOP_N);
  }, [rows, address, liveScore, running]);

  const prizeFor = (rank) => pool?.splits?.find((s) => s.rank === rank);

  return (
    <aside className={style.rail} data-testid="live-board">
      <header className={style.head}>
        <TrophyIcon className={style.headIcon} aria-hidden="true" />
        <div>
          <h2 className={style.title}>Top {TOP_N}</h2>
          <p className={style.sub}>Live · best run per wallet</p>
        </div>
      </header>

      {pool && (
        <div className={style.pool} data-testid="prize-pool">
          <span className={style.poolLabel}>Prize pool</span>
          <span className={style.poolValue}>{formatEth(pool.total)} ETH</span>
          <span className={style.poolSplit}>
            {pool.splits
              .map((s) => `#${s.rank} ${formatEth(s.eth)}`)
              .join(" · ")}
          </span>
          <span className={style.poolClock} data-testid="round-clock">
            top 3 paid in {left == null ? "—" : formatCountdown(left)}
          </span>
          {pool.simulated && (
            <span className={style.poolNote}>simulated payout</span>
          )}
        </div>
      )}

      <ol className={style.list}>
        {merged.length === 0 && (
          <li className={style.empty}>No runs yet. Take the top spot.</li>
        )}

        {merged.map((row, i) => {
          const rank = i + 1;
          const isMe =
            Boolean(address) &&
            String(row.member).toLowerCase() === address.toLowerCase();
          const prize = prizeFor(rank);

          return (
            <li
              key={`${row.member}-${rank}`}
              className={[
                style.row,
                rank <= 3 ? style.podium : "",
                style[`rank${rank}`] || "",
                isMe ? style.me : "",
                row.live ? style.pulse : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid="board-row"
            >
              <span className={style.rank}>{rank}</span>
              <span className={style.who} title={row.member}>
                {isMe ? "you" : shortAddress(row.member)}
              </span>
              {prize && (
                <span className={style.prize}>{formatEth(prize.eth)} Ξ</span>
              )}
              <span className={style.score}>{row.score}</span>
            </li>
          );
        })}
      </ol>

      {storage === "local" && (
        <p className={style.warn} data-testid="storage-warning">
          Local board — set the Upstash keys for a shared one.
        </p>
      )}
      <Payout roundIndex={round?.index} lastRound={lastRound} />
    </aside>
  );
}
