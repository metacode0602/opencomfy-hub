/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production"
const internalHost = process.env.TAURI_DEV_HOST || "localhost"
// Keep in sync with `next dev` port in package.json (`-p 1420`).
const devPort = process.env.PORT || "1420"

const nextConfig = {
  output: "export",
  // `./` breaks nested routes: `/a/b` resolves `./_next` → `/a/_next` (404, no CSS).
  // Dev: absolute origin so `/_next` always hits the dev server (Tauri guide pattern).
  // Prod: `undefined` — Tauri serves `out/` from the app origin; `/_next/...` is correct.
  assetPrefix: isProd ? undefined : `http://${internalHost}:${devPort}`,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
