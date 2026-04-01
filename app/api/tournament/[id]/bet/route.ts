// This route has been replaced by:
//   POST /api/tournament/[id]/bet/propose
//   POST /api/tournament/[id]/bet/accept
import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Deprecated. Use /bet/propose or /bet/accept instead." },
    { status: 410 }
  )
}
