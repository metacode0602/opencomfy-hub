/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Tauri loads files via `file://.../index.html`. Using absolute `/_next/...` URLs
  // makes assets resolve to `file:///_next/...` (404) -> blank page.
  assetPrefix: "./",
  images: {
    unoptimized: true,
  },
}

export default nextConfig
