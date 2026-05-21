import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const nick  = String(body.nick  ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const score = parseInt(body.score ?? "0", 10);

  if (!nick || score < 1) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  await ensureTable();
  await sql`INSERT INTO tama_scores (nick, score) VALUES (${nick}, ${score})`;
  return NextResponse.json({ ok: true });
}
