import { db } from '@/lib/db'
import { customer } from '@workspace/db/schema'
import { count } from 'drizzle-orm'
import { seedCrmFromMock } from './seed'

let seeding: Promise<void> | null = null

/** 库为空时从 mock 导入种子数据（幂等：仅首次） */
export async function ensureCrmSeeded(): Promise<void> {
  const [row] = await db.select({ value: count() }).from(customer)
  if ((row?.value ?? 0) > 0) return

  if (!seeding) {
    seeding = seedCrmFromMock().finally(() => {
      seeding = null
    })
  }
  await seeding
}
