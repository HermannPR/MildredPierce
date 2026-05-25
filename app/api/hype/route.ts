import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const HYPE_GOAL = 50_000;

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS tama_scores (
      id         SERIAL PRIMARY KEY,
      nick       TEXT NOT NULL,
      score      INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
}

export async function GET() {
  try {
    await ensureTable();
    const { rows } = await sql`SELECT COALESCE(SUM(score), 0) AS total FROM tama_scores`;
    return NextResponse.json({ total: Number(rows[0].total), goal: HYPE_GOAL });
  } catch {
    return NextResponse.json({ total: 0, goal: HYPE_GOAL });
  }
}

export async function POST() {
  try {
    await ensureTable();
    await sql`INSERT INTO tama_scores (nick, score) VALUES ('HYPE', 1)`;
    const { rows } = await sql`SELECT COALESCE(SUM(score), 0) AS total FROM tama_scores`;
    return NextResponse.json({ ok: true, total: Number(rows[0].total), goal: HYPE_GOAL });
  } catch {
    return NextResponse.json({ ok: false, total: 0, goal: HYPE_GOAL });
  }
}
