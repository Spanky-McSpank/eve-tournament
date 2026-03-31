import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatISK(amount: number): string {
  if (amount >= 1_000_000_000) {
    const v = amount / 1_000_000_000
    return `${v % 1 === 0 ? v : v.toFixed(1)}B ISK`
  }
  if (amount >= 1_000_000) {
    const v = amount / 1_000_000
    return `${v % 1 === 0 ? v : v.toFixed(1)}M ISK`
  }
  if (amount >= 1_000) {
    const v = amount / 1_000
    return `${v % 1 === 0 ? v : v.toFixed(1)}k ISK`
  }
  return `${amount} ISK`
}
