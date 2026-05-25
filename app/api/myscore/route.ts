import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const raw  = req.nextUrl.searchParams.get("nick") ?? "";
  const nick = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (!nick) return NextResponse.json({ nick: "", total: 0 });
  try {
    const { rows } = await sql`
      SELECT COALESCE(SUM(score), 0) AS total
      FROM tama_scores
      WHERE nick = ${nick}
    `;
    return NextResponse.json({ nick, total: Number(rows[0].total) });
  } catch {
    return NextResponse.json({ nick, total: 0 });
  }
}
