import { formatISK } from './utils'

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

async function sendWebhook(payload: Record<string, unknown>, webhookUrl?: string | null): Promise<void> {
  const url = webhookUrl ?? WEBHOOK_URL
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch { /* non-critical */ }
}

export async function sendDiscordRoundComplete(params: {
  tournamentName: string
  round: number
  advancers: string[]
  eliminated: string[]
  iskSettled: number
  webhookUrl?: string | null
}): Promise<void> {
  const { tournamentName, round, advancers, eliminated, iskSettled, webhookUrl } = params
  const advancerText = advancers.length > 0 ? advancers.map((n) => `✓ ${n}`).join('\n') : '—'
  const eliminatedText = eliminated.length > 0 ? eliminated.map((n) => `✗ ${n}`).join('\n') : '—'

  await sendWebhook({
    embeds: [
      {
        title: `⚔ Round ${round} Complete`,
        color: 0xC8960C,
        fields: [
          { name: 'Tournament', value: tournamentName, inline: false },
          { name: 'Advanced', value: advancerText.slice(0, 1024), inline: true },
          { name: 'Eliminated', value: eliminatedText.slice(0, 1024), inline: true },
          { name: 'ISK Settled', value: formatISK(iskSettled), inline: false },
        ],
        footer: { text: 'Bloodlust Tournaments' },
      },
    ],
  }, webhookUrl)
}

export async function sendDiscordPropResolved(params: {
  tournamentName: string
  propTitle: string
  resolution: 'YES' | 'NO'
  note: string
  iskAtStake: number
}): Promise<void> {
  const { tournamentName, propTitle, resolution, note, iskAtStake } = params

  const color = resolution === 'YES' ? 52437 : 16721988
  const resultText = resolution === 'YES' ? '✓ CAME TRUE' : '✗ DID NOT HAPPEN'

  await sendWebhook({
    embeds: [
      {
        title: "🎲 PROP BET RESOLVED",
        color,
        fields: [
          { name: 'Tournament', value: tournamentName },
          { name: 'Prop', value: propTitle },
          { name: 'Result', value: resultText, inline: true },
          { name: 'ISK at Stake', value: formatISK(iskAtStake), inline: true },
          { name: 'Note', value: note },
        ],
        footer: { text: 'The Page That Will Not Be Named' },
      },
    ],
  })
}
