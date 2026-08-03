/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The brand art is pre-cut pixel art (tools/make-assets.mjs); running it back
  // through the image optimiser would only blur it, so nothing uses next/image.
};

module.exports = nextConfig;
