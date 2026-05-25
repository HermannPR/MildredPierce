import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export const HYPE_GOAL = 20_000;

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

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body  = await req.json().catch(() => ({}));
    const count = Math.min(Math.max(1, Number(body.count ?? 1)), 100);
    const nick  = String(body.nick ?? "ANON").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "ANON";
    await sql`INSERT INTO tama_scores (nick, score) VALUES (${nick}, ${count})`;
    // Country-level aggregate — Vercel sets x-vercel-ip-country, no IP ever stored
    const country = req.headers.get("x-vercel-ip-country") ?? "";
    if (/^[A-Z]{2}$/.test(country)) {
      await sql`
        INSERT INTO signal_countries (country, count) VALUES (${country}, ${count})
        ON CONFLICT (country) DO UPDATE SET count = signal_countries.count + EXCLUDED.count
      `.catch(() => {});
    }
    const { rows } = await sql`SELECT COALESCE(SUM(score), 0) AS total FROM tama_scores`;
    return NextResponse.json({ ok: true, total: Number(rows[0].total), goal: HYPE_GOAL });
  } catch {
    return NextResponse.json({ ok: false, total: 0, goal: HYPE_GOAL });
  }
}
