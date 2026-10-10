import { NextResponse } from "next/server";

// kept for compatibility, undo lives client-side in the session queue
export async function POST() {
  return NextResponse.json({ ok: true });
}
