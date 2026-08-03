"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrophyIcon } from "./Icons";
import { shortAddress } from "../lib/brand";
import Payout from "./Payout";
import { formatEth } from "../lib/prizes";
import {
  ROUND_MS,
  formatCountdown,
  roundIndexAt,
  roundStart,
  secondsLeft,
} from "../lib/rounds";
import { botsAt } from "../lib/bots";
import style from "../styles/LiveBoard.module.css";

const TOP_N = 20;
const POLL_MS = 4000;

/**
 * The rail beside the arena: top 20, updating live.
 *
 * "Live" is three things stitched together —
 *   · your own row moves the instant a pillar is cleared, driven by `liveScore`
 *     straight off the engine, so climbing is felt rather than waited for;
 *   · the pace-setters are recomputed locally on a one-second tick from a pure
 *     function of the round, so they count up between polls instead of lurching;
 *   · other real wallets arrive on the poll, because a finished run is only
 *     durable once the server has it.
 */
export default function LiveBoard({ address, liveScore = 0, running = false }) {
  const [rows, setRows] = useState([]);
  const [pool, setPool] = useState(null);
  const [storage, setStorage] = useState(null);
  const [round, setRound] = useState(null);
  const [lastRound, setLastRound] = useState(null);
  const [left, setLeft] = useState(null);
  const [tick, setTick] = useState(0);
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
        // Track the countdown against the server's clock, not the browser's — a
        // viewer with a skewed clock would otherwise see a countdown that
        // disagrees with when the payout actually fires.
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

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now() + skew.current;
      setLeft(secondsLeft(roundIndexAt(now), now));
      setTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const board = useMemo(() => {
    const now = Date.now() + skew.current;
    const index = roundIndexAt(now);
    const into = Math.min(Math.floor((now - roundStart(index)) / 1000), ROUND_MS / 1000);

    const list = [
      ...rows.map((r) => ({ ...r, live: false, bot: false })),
      ...botsAt(index, into),
    ];

    if (address) {
      const mine = list.find(
        (r) => !r.bot && String(r.member).toLowerCase() === address.toLowerCase()
      );
      // liveScore counts whether or not the run is still going: when it ends it
      // holds the final total, and dropping it here would blank your row for the
      // seconds between finishing and the next poll landing.
      const best = Math.max(mine?.score ?? 0, liveScore);

      if (mine) {
        mine.score = best;
        mine.live = running;
      } else {
        // Present even on zero — a row that only appears once you score gives
        // you nothing to aim from.
        list.push({ member: address, score: best, live: running, bot: false });
      }
    }

    const sorted = list.sort((a, b) => b.score - a.score);

    // Prizes follow the top three *real* wallets wherever they land, because
    // that is exactly who settlement pays. Ranked across the whole field rather
    // than the visible slice, or a player just outside the cut would be shown a
    // prize they are not owed.
    let realSeen = 0;
    sorted.forEach((row, i) => {
      row.rank = i + 1;
      row.payRank = row.bot ? 0 : ++realSeen <= 3 ? realSeen : 0;
    });

    const myIndex = address
      ? sorted.findIndex(
          (r) => !r.bot && String(r.member).toLowerCase() === address.toLowerCase()
        )
      : -1;

    return {
      visible: sorted.slice(0, TOP_N),
      // Outside the cut your row is pinned below the list rather than vanishing:
      // you should always be able to see where you stand and how far away
      // twentieth place is.
      pinned: myIndex >= TOP_N ? sorted[myIndex] : null,
    };
  }, [rows, address, liveScore, running, tick]);

  const prizeFor = (rank) => pool?.splits?.find((s) => s.rank === rank);

  const Row = useCallback(
    (row) => {
      const isMe =
        Boolean(address) &&
        !row.bot &&
        String(row.member).toLowerCase() === address.toLowerCase();
      const prize = row.payRank ? prizeFor(row.payRank) : null;

      return (
        <li
          key={`${row.member}-${row.rank}`}
          className={[
            style.row,
            row.rank <= 3 ? style.podium : "",
            style[`rank${row.rank}`] || "",
            isMe ? style.me : "",
            row.live ? style.pulse : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-testid="board-row"
        >
          <span className={style.rank}>{row.rank}</span>
          <span className={style.who} title={row.member}>
            {isMe ? "you" : shortAddress(row.member)}
          </span>
          {prize && <span className={style.prize}>{formatEth(prize.eth)} Ξ</span>}
          <span className={style.score}>{row.score}</span>
        </li>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, pool]
  );

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
            {pool.splits.map((s) => `#${s.rank} ${formatEth(s.eth)}`).join(" · ")}
          </span>
          <span className={style.poolClock} data-testid="round-clock">
            top 3 paid in {left == null ? "—" : formatCountdown(left)}
          </span>
          {pool.simulated && <span className={style.poolNote}>simulated payout</span>}
        </div>
      )}

      <ol className={style.list}>
        {board.visible.length === 0 && (
          <li className={style.empty}>No runs yet. Take the top spot.</li>
        )}
        {board.visible.map((row) => Row(row))}
      </ol>

      {board.pinned && (
        <ol className={style.pinned} data-testid="you-pinned">
          {Row(board.pinned)}
        </ol>
      )}

      {storage === "local" && (
        <p className={style.warn} data-testid="storage-warning">
          Local board — set the Upstash keys for a shared one.
        </p>
      )}

      <Payout roundIndex={round?.index} lastRound={lastRound} />
    </aside>
  );
}
