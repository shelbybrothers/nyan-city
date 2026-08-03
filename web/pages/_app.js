import Head from "next/head";
import { Fredoka, Press_Start_2P } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { BRAND, TICKER, X_HANDLE } from "../lib/brand";
import "../styles/globals.css";

// next/font self-hosts these at build time — no runtime request to Google, no
// layout shift. Press Start 2P is the arcade face: brilliant on a wordmark or a
// score, unreadable in a paragraph, so it is scoped to short strings. Fredoka
// carries everything you actually have to read.
const display = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const body = Fredoka({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

function MyApp({ Component, pageProps }) {
  const title = `${BRAND.name} — ${TICKER}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={BRAND.description} />
        <meta name="theme-color" content="#0b0720" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={BRAND.name} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={BRAND.description} />
        <meta property="og:url" content={BRAND.url} />
        <meta property="og:image" content={`${BRAND.url}/nyan-og.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={BRAND.description} />
        <meta name="twitter:image" content={`${BRAND.url}/nyan-og.png`} />
        {X_HANDLE && <meta name="twitter:site" content={X_HANDLE} />}

        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>

      {/* The CSS modules reach the faces through these two variables. */}
      <style jsx global>{`
        :root {
          --font-display: ${display.style.fontFamily};
          --font-body: ${body.style.fontFamily};
        }
      `}</style>

      <Component {...pageProps} />

      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: "rgba(18,14,44,0.94)",
            color: "#f4f0ff",
            border: "1px solid rgba(255,255,255,0.14)",
            fontWeight: 600,
          },
        }}
      />
    </>
  );
}

export default MyApp;
