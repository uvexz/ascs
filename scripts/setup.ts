import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

if (existsSync('.env.local')) {
  console.log(
    '.env.local already exists; it has not been changed. Compare it with .env.example.',
  )
} else {
  await writeFile(
    '.env.local',
    `DATABASE_URL=file:./data/ascs.db\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\nCRON_SECRET=${randomBytes(32).toString('hex')}\nALLOW_LOCALHOST_SITE=true\n`,
    { mode: 0o600, flag: 'wx' },
  )
  console.log('Created local development configuration in .env.local')
}
