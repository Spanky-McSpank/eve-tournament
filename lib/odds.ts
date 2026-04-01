type EntrantInput = {
  kills_30d: number
  losses_30d: number
  isk_destroyed_30d: number
  isk_lost_30d: number
}

export type OddsResult = {
  fractional: string
  percentage: number
  impliedProb: number
  hasData: boolean
}

export type MatchOdds = {
  entrant1: OddsResult
  entrant2: OddsResult
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function toFractional(prob: number): string {
  if (prob <= 0) return '100/1'
  if (prob >= 1) return '1/100'
  const denominator = 10
  const numerator = Math.round(((1 - prob) / prob) * denominator)
  if (numerator <= 0) return '1/100'
  const d = gcd(numerator, denominator)
  return `${numerator / d}/${denominator / d}`
}

export function calculateOdds(
  entrant1: EntrantInput,
  entrant2: EntrantInput
): MatchOdds {
  const e1HasData =
    entrant1.kills_30d !== 0 ||
    entrant1.losses_30d !== 0 ||
    entrant1.isk_destroyed_30d !== 0 ||
    entrant1.isk_lost_30d !== 0
  const e2HasData =
    entrant2.kills_30d !== 0 ||
    entrant2.losses_30d !== 0 ||
    entrant2.isk_destroyed_30d !== 0 ||
    entrant2.isk_lost_30d !== 0

  if (!e1HasData || !e2HasData) {
    return {
      entrant1: { fractional: '1/1', percentage: 50, impliedProb: 0.5, hasData: e1HasData },
      entrant2: { fractional: '1/1', percentage: 50, impliedProb: 0.5, hasData: e2HasData },
    }
  }

  const sum1 = entrant1.isk_destroyed_30d + entrant1.isk_lost_30d
  const eff1 = sum1 === 0 ? 0.5 : entrant1.isk_destroyed_30d / sum1

  const sum2 = entrant2.isk_destroyed_30d + entrant2.isk_lost_30d
  const eff2 = sum2 === 0 ? 0.5 : entrant2.isk_destroyed_30d / sum2

  const kd1 = entrant1.kills_30d / Math.max(entrant1.losses_30d, 1)
  const kd2 = entrant2.kills_30d / Math.max(entrant2.losses_30d, 1)

  const kdSum = kd1 + kd2
  const nkd1 = kdSum === 0 ? 0.5 : kd1 / kdSum
  const nkd2 = kdSum === 0 ? 0.5 : kd2 / kdSum

  const raw1 = eff1 * 0.6 + nkd1 * 0.4
  const raw2 = eff2 * 0.6 + nkd2 * 0.4

  const rawSum = raw1 + raw2
  const prob1 = rawSum === 0 ? 0.5 : raw1 / rawSum
  const prob2 = rawSum === 0 ? 0.5 : raw2 / rawSum

  return {
    entrant1: {
      fractional: toFractional(prob1),
      percentage: Math.round(prob1 * 100),
      impliedProb: prob1,
      hasData: true,
    },
    entrant2: {
      fractional: toFractional(prob2),
      percentage: Math.round(prob2 * 100),
      impliedProb: prob2,
      hasData: true,
    },
  }
}

// ── calculateAcceptorStake ─────────────────────────────────────────────────
// Given the proposer's implied probability p for their chosen fighter,
// the acceptor's required stake is: iskAmount * (p / (1 - p))
// This ensures a fair, odds-adjusted matched bet on both sides.
export function calculateAcceptorStake(iskAmount: number, impliedProb: number): number {
  if (impliedProb <= 0 || impliedProb >= 1) return iskAmount
  const ratio = impliedProb / (1 - impliedProb)
  return Math.round(iskAmount * ratio)
}
