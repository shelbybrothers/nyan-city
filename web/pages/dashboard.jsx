"use client";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import TokenBar from "../components/TokenBar";
import { ExitIcon, PlayIcon, TrophyIcon, WalletIcon } from "../components/Icons";
import { CatMark } from "../components/Logo";
import { useWalletSession } from "../hooks/useWallet";
import { BRAND, TICKER, shortAddress } from "../lib/brand";
import { CHAIN } from "../lib/chain";
import style from "../styles/Dashboard.module.css";

const Dashboard = () => {
  const router = useRouter();
  const { address, ready, disconnect } = useWalletSession({ required: true });

  // Hold the frame until the session is known — otherwise the gate flashes.
  if (!ready || !address) return null;

  return (
    <>
      <Head>
        <title>{`Lobby — ${BRAND.name}`}</title>
      </Head>

      <div className={style.body}>
        <div className={style.container}>
          <header className={style.TopBar}>
            <CatMark width={92} className={style.mark} />
            <div className={style.who}>
              <h1 className={style.Head}>{BRAND.name}</h1>
              <p className={style.address} data-testid="address">
                <WalletIcon className={style.addressIcon} aria-hidden="true" />
                {shortAddress(address)}
                <span className={style.chainTag}>{CHAIN.name}</span>
              </p>
            </div>
          </header>

          <div className={style.actions}>
            <button
              className={style.PlayBtn}
              onClick={() => router.push("/game")}
              data-testid="play"
            >
              <PlayIcon className={style.btnIcon} aria-hidden="true" />
              Play
            </button>
            <Link
              href="/leaderboard"
              className={style.SecondaryBtn}
              data-testid="leaderboard-link"
            >
              <TrophyIcon className={style.btnIcon} aria-hidden="true" />
              Leaderboard
            </Link>
          </div>

          <h2 className={style.SubHead}>How to play</h2>
          <div className={style.Content}>
            <p>
              Hold <span>SPACE</span> to climb, let go to fall. Thread the gaps —
              that is the whole game.
            </p>
            <p>
              Above <span>50 pts</span> the track drops into a Panic phase and
              everything speeds up. That is where the runs are made.
            </p>
            <p>
              Your best run is filed under your wallet, so the{" "}
              <span>leaderboard</span> is one row per holder.
            </p>
          </div>

          <TokenBar className={style.tokens} />

          <button className={style.LogoutBtn} onClick={disconnect} data-testid="disconnect">
            <ExitIcon className={style.btnIcon} aria-hidden="true" />
            Disconnect
          </button>

          <p className={style.fine}>
            {TICKER} is cosmetic to the game — nothing here spends, approves, or
            transfers anything from your wallet.
          </p>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
