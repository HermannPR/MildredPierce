import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS tama_scores (
      id        SERIAL PRIMARY KEY,
      nick      TEXT NOT NULL,
      score     INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET() {
  await ensureTable();
  const { rows } = await sql`
    SELECT nick, MAX(score) AS score
    FROM tama_scores
    GROUP BY nick
    ORDER BY score DESC
    LIMIT 10
  `;
  return NextResponse.json(
    rows.map((r, i) => ({ rank: i + 1, nick: r.nick, score: Number(r.score) }))
  );
}
