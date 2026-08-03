"use client";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import TokenBar from "../components/TokenBar";
import UserTile from "../components/UserTile";
import { TrophyIcon } from "../components/Icons";
import { getSavedAddress } from "../lib/wallet";
import { BRAND } from "../lib/brand";
import style from "../styles/Leaderboard.module.css";

const TOP_N = 10;

const Leaderboard = () => {
  const router = useRouter();
  const [scores, setScores] = useState(null); // null = still loading
  const [me, setMe] = useState(null);

  useEffect(() => {
    setMe(getSavedAddress());

    let alive = true;
    fetch(`/api/search?count=${TOP_N}`)
      .then((res) => (res.ok ? res.json() : { scores: [] }))
      .then((data) => {
        if (!alive) return;
        const real = (data.scores || []).map((r) => ({ ...r, bot: false }));
        const merged = [...real, ...(data.bots || [])].sort(
          (a, b) => b.score - a.score
        );
        setScores(merged.slice(0, TOP_N));
      })
      .catch(() => {
        if (alive) setScores([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <Head>
        <title>{`Leaderboard — ${BRAND.name}`}</title>
      </Head>

      <div className={style.body}>
        <div className={style.container}>
          <header className={style.Header}>
            <TrophyIcon className={style.headIcon} aria-hidden="true" />
            <div>
              <h1 className={style.Top}>Leaderboard</h1>
              <p className={style.sub}>Best run per wallet on {BRAND.name}.</p>
            </div>
          </header>

          <div className={style.list} data-testid="leaderboard">
            {scores === null && <p className={style.state}>Loading the board…</p>}

            {scores?.length === 0 && (
              <p className={style.state} data-testid="board-empty">
                No runs yet. Be the first name up here.
              </p>
            )}

            {scores?.map((entry, i) => (
              <UserTile
                key={`${entry.member}-${i}`}
                rank={i + 1}
                member={entry.member}
                score={entry.score}
                isBot={entry.bot}
                isMe={
                  Boolean(me) &&
                  String(entry.member).toLowerCase() === me.toLowerCase()
                }
              />
            ))}
          </div>

          <TokenBar compact className={style.tokens} />

          <button className={style.Btn} onClick={() => router.push("/dashboard")}>
            Back to lobby
          </button>
        </div>
      </div>
    </>
  );
};

export default Leaderboard;
