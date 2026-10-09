import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'
config({ path: ['.env.local', '.env'] })
const url = process.env.DATABASE_URL || 'file:./data/ascs.db'
export default defineConfig({
  out: './drizzle', schema: './src/db/schema.ts', dialect: 'turso',
  dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN },
})
