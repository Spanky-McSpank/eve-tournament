import { NextRequest, NextResponse } from "next/server"
import { getTournamentBracket } from "@/lib/bracket"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const brackets = await getTournamentBracket(id)
    return NextResponse.json({ brackets })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
