import { prepareDatabase } from './env'
await prepareDatabase()
const { flushMail } = await import('../src/server/mail.server')
const { client } = await import('../src/db/index')
try { console.log(await flushMail()) } finally { client.close() }
