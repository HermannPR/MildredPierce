import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT nick, SUM(score) AS total
      FROM tama_scores
      GROUP BY nick
      ORDER BY total DESC
      LIMIT 4
    `;
    const users = rows.map((r, i) => ({
      rank: i + 1,
      alias: String(r.nick).slice(0, 4).toUpperCase(),
      clicks: Number(r.total),
    }));
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ users: [] });
  }
}
