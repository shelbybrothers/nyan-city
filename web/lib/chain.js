// Robinhood Chain (EVM). Gas is ETH, so ordinary EIP-1193 wallets work unchanged
// — no chain-specific SDK, no bundler, no wagmi. Identity only: nyan.city asks
// the wallet to prove an address and to sit on the right network. It never asks
// for a token approval and never moves funds.

export const CHAIN = {
  id: 4663,
  idHex: "0x1237",
  name: "Robinhood Chain",
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://explorer.mainnet.chain.robinhood.com",
  symbol: "ETH",
  decimals: 18,
};

/** Exact payload for `wallet_addEthereumChain`, used when a switch returns 4902. */
export const ADD_CHAIN_PARAMS = {
  chainId: CHAIN.idHex,
  chainName: CHAIN.name,
  nativeCurrency: { name: "Ether", symbol: CHAIN.symbol, decimals: CHAIN.decimals },
  rpcUrls: [CHAIN.rpc],
  blockExplorerUrls: [CHAIN.explorer],
};

/** Where to send someone who has no injected wallet at all. */
export const WALLET_DOWNLOAD = "https://robinhood.com/wallet/";
