// Vector icons only — no emoji anywhere in the chrome.
// Every icon inherits `currentColor` so a chip can restyle it by setting `color`.

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const XLogo = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1227" fill="currentColor" {...props}>
    <path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894L144.011 79.694h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z" />
  </svg>
);

export const CopyIcon = (props) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
  </svg>
);

export const CheckIcon = (props) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2.4} {...props}>
    <path d="m4 12.5 5.2 5.2L20 6.9" />
  </svg>
);

export const WalletIcon = (props) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a2 2 0 0 1 2 2v1" />
    <rect x="3" y="8.5" width="18" height="11" rx="2.5" />
    <circle cx="16.5" cy="14" r="1.35" fill="currentColor" stroke="none" />
  </svg>
);

export const CoinIcon = (props) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.4v9.2M14.6 9.6c-.5-.8-1.5-1.2-2.6-1.2-1.5 0-2.6.8-2.6 1.9 0 2.6 5.4 1.3 5.4 4 0 1.2-1.2 2-2.8 2-1.2 0-2.2-.4-2.7-1.2" />
  </svg>
);

export const ChainIcon = (props) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>
    <path d="M10 13.8a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5" />
    <path d="M14 10.2a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5" />
  </svg>
);

export const TrophyIcon = (props) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 5.5H4.6A.6.6 0 0 0 4 6.1C4 8.3 5.4 10 7.4 10.3M17 5.5h2.4a.6.6 0 0 1 .6.6c0 2.2-1.4 3.9-3.4 4.2" />
    <path d="M12 14v3.2M8.6 20h6.8M9.6 20c0-1.6.8-2.8 2.4-2.8s2.4 1.2 2.4 2.8" />
  </svg>
);

export const PlayIcon = (props) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>
    <path d="M8 5.6 18.4 12 8 18.4V5.6Z" fill="currentColor" />
  </svg>
);

export const ExitIcon = (props) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>
    <path d="M14.5 8V5.6A1.6 1.6 0 0 0 12.9 4H5.6A1.6 1.6 0 0 0 4 5.6v12.8A1.6 1.6 0 0 0 5.6 20h7.3a1.6 1.6 0 0 0 1.6-1.6V16" />
    <path d="M9.5 12H20m0 0-3.2-3.2M20 12l-3.2 3.2" />
  </svg>
);

export const ExternalIcon = (props) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>
    <path d="M13.5 4H20v6.5M20 4l-8.4 8.4" />
    <path d="M18 14.5v3.9A1.6 1.6 0 0 1 16.4 20H5.6A1.6 1.6 0 0 1 4 18.4V7.6A1.6 1.6 0 0 1 5.6 6h3.9" />
  </svg>
);
