// The brand marks are the source art itself (cut by tools/make-assets.mjs from
// ~/experimental/nyan.png), not a redrawn approximation. Plain <img>, not
// next/image: these are pre-sized PNGs with hard pixel edges and no layout to
// negotiate.

/** Full lockup — rainbow trail plus cat. */
export const LogoLockup = ({ className = "", width = 420, alt = "nyan.city" }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/nyan-logo.png"
    alt={alt}
    width={width}
    className={className}
    style={{ imageRendering: "pixelated" }}
  />
);

/** The cat on its own — for HUDs and anywhere the trail would not fit. */
export const CatMark = ({ className = "", width = 96, alt = "" }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/assets/cat.png"
    alt={alt}
    width={width}
    className={className}
    style={{ imageRendering: "pixelated" }}
  />
);
