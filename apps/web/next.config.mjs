import createNextIntlPlugin from "next-intl/plugin"

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@workspace/auth",
    "@workspace/db",
    "@workspace/shared-next",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
}

// Default is src/i18n/request.ts; this project uses lib/i18n/request.ts
// https://next-intl.dev/docs/getting-started/app-router#i18nrequestts
const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts")

export default withNextIntl(nextConfig)
