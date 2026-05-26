import createNextIntlPlugin from "next-intl/plugin"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@workspace/ui",
    "@workspace/auth",
    "@workspace/db",
    "@workspace/shared-next",
  ],
  allowedDevOrigins: ['192.168.110.16'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "liblibai-tmp-image.liblib.cloud",
      },
    ],
  },
}

// Default is src/i18n/request.ts; this project uses lib/i18n/request.ts
// https://next-intl.dev/docs/getting-started/app-router#i18nrequestts
const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts")

export default withNextIntl(nextConfig)
