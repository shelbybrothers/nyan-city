"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BRAND, BUY_URL, HAS_CA, TICKER, shortCA } from "../lib/brand";
import { ChainIcon, CheckIcon, CoinIcon, CopyIcon, XLogo } from "./Icons";
import style from "../styles/TokenBar.module.css";

/**
 * The $NYAN strip: X, Buy, and a click-to-copy contract address.
 *
 * Everything it renders comes from lib/brand.js. With no contract address set,
 * the CA chip and the Buy button say "updating…" rather than pointing anywhere —
 * a dead link is worse than an honest placeholder.
 *
 * `compact` is the in-game/HUD size; the default is the landing size.
 */
export default function TokenBar({ compact = false, className = "" }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copyCA = useCallback(async () => {
    if (!HAS_CA) return;
    const ok = await writeToClipboard(BRAND.ca);
    if (!ok) {
      toast.error("Could not reach the clipboard — copy it by hand.");
      return;
    }
    setCopied(true);
    toast.success(`${TICKER} contract copied`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }, []);

  return (
    <div
      className={`${style.bar} ${compact ? style.compact : ""} ${className}`}
      data-testid="token-bar"
    >
      <a
        className={`${style.chip} ${style.x}`}
        href={BRAND.x}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${BRAND.name} on X`}
        data-testid="chip-x"
      >
        <XLogo className={style.icon} aria-hidden="true" />
        <span>{compact ? "X" : "Follow on X"}</span>
      </a>

      {BUY_URL ? (
        <a
          className={`${style.chip} ${style.buy}`}
          href={BUY_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="chip-buy"
        >
          <CoinIcon className={style.icon} aria-hidden="true" />
          <span>Buy {TICKER}</span>
        </a>
      ) : (
        <span
          className={`${style.chip} ${style.buy} ${style.pending}`}
          title={`The ${TICKER} buy link goes live with the contract`}
          data-testid="chip-buy"
        >
          <CoinIcon className={style.icon} aria-hidden="true" />
          <span>
            Buy {TICKER} <em>updating…</em>
          </span>
        </span>
      )}

      {HAS_CA ? (
        <button
          type="button"
          className={`${style.chip} ${style.ca}`}
          onClick={copyCA}
          title={BRAND.ca}
          data-testid="chip-ca"
        >
          <ChainIcon className={style.icon} aria-hidden="true" />
          <span className={style.caText}>CA {shortCA()}</span>
          {copied ? (
            <CheckIcon className={style.icon} aria-hidden="true" />
          ) : (
            <CopyIcon className={style.icon} aria-hidden="true" />
          )}
        </button>
      ) : (
        <span
          className={`${style.chip} ${style.ca} ${style.pending}`}
          title="The contract address appears here at launch"
          data-testid="chip-ca"
        >
          <ChainIcon className={style.icon} aria-hidden="true" />
          <span className={style.caText}>
            CA <em>updating…</em>
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * navigator.clipboard only exists in a secure context, so a plain-http deploy
 * needs the old textarea trick. Returns whether the text actually landed.
 */
async function writeToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
