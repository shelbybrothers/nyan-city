"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  clearSession,
  connectWallet,
  hasWallet,
  onAccountsChanged,
  restoreSession,
} from "../lib/wallet";

/**
 * The wallet session, shared by every page.
 *
 * `ready` exists so a gated page can render nothing instead of flashing its
 * signed-out state for one frame while the session is still being restored.
 * `required: true` sends anyone without a session back to the landing page.
 */
export function useWalletSession({ required = false } = {}) {
  const router = useRouter();
  const [address, setAddress] = useState(null);
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // Resolved after mount, never during render: the server has no window.ethereum,
  // so reading it inline would hydrate a different tree than it rendered.
  const [walletAvailable, setWalletAvailable] = useState(true);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    setWalletAvailable(hasWallet());
    restoreSession()
      .then((found) => {
        if (!alive.current) return;
        setAddress(found);
        setReady(true);
      })
      .catch(() => {
        if (!alive.current) return;
        setReady(true);
      });

    const off = onAccountsChanged((next) => {
      if (alive.current) setAddress(next);
    });

    return () => {
      alive.current = false;
      off();
    };
  }, []);

  // Gate only after the restore has settled, or the first paint bounces everyone
  // back to the landing page.
  useEffect(() => {
    if (required && ready && !address) router.replace("/");
  }, [required, ready, address, router]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { address: next, onChain } = await connectWallet();
      if (alive.current) setAddress(next);
      return { address: next, onChain };
    } finally {
      if (alive.current) setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    clearSession();
    setAddress(null);
    router.replace("/");
  }, [router]);

  return {
    address,
    ready,
    connecting,
    connect,
    disconnect,
    walletAvailable,
  };
}
