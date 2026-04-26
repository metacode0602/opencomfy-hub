import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: "../../.env" })

console.log("DATABASE_URL", process.env.DATABASE_URL)

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run Drizzle commands")
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
})
