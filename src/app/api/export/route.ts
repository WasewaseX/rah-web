import { NextResponse } from "next/server";
import { buildBundle } from "@/lib/portable";

export const dynamic = "force-dynamic";

// P5: the learner owns the state. GET returns the ENTIRE app state as a
// hash-sealed bundle - every table, no secrets exist to redact and the
// registry in portable.ts is the audit list that keeps it that way.
export async function GET() {
  const { bundle, hash, counts } = await buildBundle();
  return NextResponse.json(
    { ...bundle, hash, counts },
    {
      headers: {
        "content-disposition": `attachment; filename="rah-export-${hash.slice(0, 12)}.json"`,
      },
    },
  );
}
