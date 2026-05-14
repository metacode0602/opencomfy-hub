import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 会话过期时间是否已早于当前时间 */
export function isExpired(
  expiresAt: Date | string | number | null | undefined
): boolean {
  if (expiresAt == null) return true
  const t =
    typeof expiresAt === "number"
      ? expiresAt
      : new Date(expiresAt).getTime()
  return !Number.isFinite(t) || t <= Date.now()
}
