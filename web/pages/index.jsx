"use client";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import toast from "react-hot-toast";
import TokenBar from "../components/TokenBar";
import { ChainIcon, WalletIcon } from "../components/Icons";
import { LogoLockup } from "../components/Logo";
import { useWalletSession } from "../hooks/useWallet";
import { BRAND, TICKER } from "../lib/brand";
import { CHAIN, WALLET_DOWNLOAD } from "../lib/chain";
import style from "../styles/Landing.module.css";

export default function Landing() {
  const router = useRouter();
  const { address, ready, connecting, connect, walletAvailable } =
    useWalletSession();

  // Already signed in? Skip the door.
  useEffect(() => {
    if (ready && address) router.replace("/dashboard");
  }, [ready, address, router]);

  const handleConnect = async () => {
    if (!walletAvailable) {
      toast.error("No wallet detected in this browser.");
      return;
    }
    try {
      const { onChain } = await connect();
      toast.success(
        onChain
          ? `Connected on ${CHAIN.name}`
          : `Connected — switch to ${CHAIN.name} when you can`
      );
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err?.message || "Could not connect.");
    }
  };

  return (
    <>
      <Head>
        <title>{`${BRAND.name} — ${TICKER}`}</title>
        <meta name="description" content={BRAND.description} />
      </Head>

      <main className={style.body}>
        <div className={style.stars} aria-hidden="true" />
        <div className={style.ribbon} aria-hidden="true" />

        <div className={style.card}>
          <LogoLockup width={420} className={style.mark} />

          <h1 className={style.wordmark}>
            nyan<span className={style.dot}>.</span>city
          </h1>

          <p className={style.ticker}>{TICKER}</p>
          <p className={style.tagline}>{BRAND.tagline}</p>

          <button
            className={style.connect}
            onClick={handleConnect}
            disabled={connecting}
            data-testid="connect"
          >
            <WalletIcon className={style.connectIcon} aria-hidden="true" />
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>

          <p className={style.chain} data-testid="chain-note">
            <ChainIcon className={style.chainIcon} aria-hidden="true" />
            {CHAIN.name} · identity only — no approvals, no transfers
          </p>

          {!walletAvailable && (
            <a
              className={style.getWallet}
              href={WALLET_DOWNLOAD}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get a wallet
            </a>
          )}

          <TokenBar className={style.tokens} />
        </div>

        <footer className={style.footer}>
          <a className={style.watch} href="/watch">
            Watch the live feed
          </a>
          <span>
            Rhythm engine forked from{" "}
            <a
              href="https://github.com/Seek4samurai/project-giga-cat"
              target="_blank"
              rel="noopener noreferrer"
            >
              project-giga-cat
            </a>{" "}
            (MIT).
          </span>
        </footer>
      </main>
    </>
  );
}
