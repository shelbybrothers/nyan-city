"use client";
import Head from "next/head";
import { useRouter } from "next/router";
import GameCanva from "../components/GameCanva";
import { BRAND } from "../lib/brand";

/**
 * `/watch` — the stream feed.
 *
 * The pilot flies, the run restarts itself, and the rail keeps showing the real
 * board and the real countdown, so a 24h capture never freezes on a death screen
 * and never needs a human at the keyboard. Nothing is posted: there is no wallet
 * here, so a watch run cannot take a podium place off a player.
 *
 * `?clean=1` drops the header and footer for OBS — arena and rail only.
 */
export default function Watch() {
  const router = useRouter();
  const clean = router.isReady && router.query.clean === "1";

  return (
    <>
      <Head>
        <title>{`Watch — ${BRAND.name}`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <GameCanva address={null} watch clean={clean} />
    </>
  );
}
