"use client"

import HomePage from "./home"
import IndexPage from "./index/page"

export default function Page() {
  // Keep `/` as a real content page (no forced redirect).
  // This avoids "blank screen" if client-side navigation fails in release builds.
  return <IndexPage />
}
