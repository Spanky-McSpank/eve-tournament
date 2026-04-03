import { formatISK } from './utils'

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

async function sendWebhook(payload: Record<string, unknown>): Promise<void> {
  if (!WEBHOOK_URL) return
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
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
        title: '🎲 PROP BET RESOLVED',
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
