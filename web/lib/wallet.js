// Raw EIP-1193 wallet connect for nyan.city.
//
// The upstream project authenticated through a self-hosted FastAPI nonce/verify
// service on a fixed dev port; that service is gone (upstream README says so), so
// login was dead on arrival. This replaces it with a plain injected-provider
// handshake: request the account, put the wallet on Robinhood Chain, remember the
// address. No signature server, no custody, no approvals.

import { ADD_CHAIN_PARAMS, CHAIN } from "./chain";

export const ADDRESS_KEY = "nyan.address";
export const SESSION_KEY = "nyan.session";

/** The injected provider, or null when there is no wallet in this browser. */
export function getProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

export function hasWallet() {
  return Boolean(getProvider());
}

/** The address this browser is signed in as, or null. */
export function getSavedAddress() {
  if (typeof window === "undefined") return null;
  try {
    const address = window.localStorage.getItem(ADDRESS_KEY);
    const session = window.localStorage.getItem(SESSION_KEY);
    return address && session ? address : null;
  } catch {
    return null;
  }
}

function saveSession(address) {
  try {
    window.localStorage.setItem(ADDRESS_KEY, address);
    window.localStorage.setItem(SESSION_KEY, String(Date.now()));
  } catch {
    /* private mode — the session simply will not persist */
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(ADDRESS_KEY);
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Move the wallet onto Robinhood Chain. A wallet that has never seen the network
 * rejects the switch with 4902 (and MetaMask nests the same code under .data),
 * which is the signal to add it first and switch again.
 *
 * Returns true when the wallet ends up on the chain, false when the user declined
 * — declining is not fatal, the address still identifies them.
 */
export async function ensureChain(provider = getProvider()) {
  if (!provider?.request) return false;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN.idHex }],
    });
    return true;
  } catch (err) {
    const code = err?.code ?? err?.data?.originalError?.code ?? err?.data?.code;
    if (code !== 4902) return false;
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [ADD_CHAIN_PARAMS],
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** Whether the wallet is currently pointed at Robinhood Chain. */
export async function isOnChain(provider = getProvider()) {
  if (!provider?.request) return false;
  try {
    const id = await provider.request({ method: "eth_chainId" });
    return String(id).toLowerCase() === CHAIN.idHex;
  } catch {
    return false;
  }
}

/**
 * Connect. Resolves to { address, onChain } or throws an Error whose message is
 * already fit to show a player.
 */
export async function connectWallet() {
  const provider = getProvider();
  if (!provider?.request) {
    const err = new Error("No wallet found in this browser.");
    err.code = "NO_WALLET";
    throw err;
  }

  let accounts;
  try {
    accounts = await provider.request({ method: "eth_requestAccounts" });
  } catch (err) {
    // 4001 = the user closed the prompt. Anything else is worth surfacing.
    const message =
      err?.code === 4001
        ? "Connection cancelled."
        : err?.message || "Could not reach the wallet.";
    const wrapped = new Error(message);
    wrapped.code = err?.code;
    throw wrapped;
  }

  const address = accounts?.[0];
  if (!address) throw new Error("The wallet returned no account.");

  const onChain = await ensureChain(provider);
  saveSession(address);
  return { address, onChain };
}

/**
 * Reconnect silently on page load: `eth_accounts` never prompts, so a wallet that
 * is still authorised restores the session and a locked one quietly does not.
 */
export async function restoreSession() {
  const saved = getSavedAddress();
  if (!saved) return null;

  const provider = getProvider();
  if (!provider?.request) return saved; // no wallet right now — trust the stored session

  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    const live = accounts?.[0];
    if (!live) {
      clearSession();
      return null;
    }
    if (live.toLowerCase() !== saved.toLowerCase()) {
      saveSession(live); // they switched accounts in the wallet — follow them
      return live;
    }
    return saved;
  } catch {
    return saved;
  }
}

/**
 * Subscribe to wallet-side account changes. Returns an unsubscribe function, so
 * effects can clean up without leaking listeners across React strict-mode remounts.
 */
export function onAccountsChanged(handler) {
  const provider = getProvider();
  if (!provider?.on) return () => {};

  const listener = (accounts) => {
    const next = accounts?.[0] || null;
    if (next) saveSession(next);
    else clearSession();
    handler(next);
  };

  provider.on("accountsChanged", listener);
  return () => {
    if (provider.removeListener) provider.removeListener("accountsChanged", listener);
  };
}
