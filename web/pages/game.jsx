"use client";
import Head from "next/head";
import GameCanva from "../components/GameCanva";
import { useWalletSession } from "../hooks/useWallet";
import { BRAND } from "../lib/brand";

const Game = () => {
  const { address, ready } = useWalletSession({ required: true });

  if (!ready || !address) return null;

  return (
    <>
      <Head>
        <title>{`Run — ${BRAND.name}`}</title>
      </Head>
      <GameCanva address={address} />
    </>
  );
};

export default Game;
