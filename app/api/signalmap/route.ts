import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS signal_countries (
      country TEXT PRIMARY KEY,
      count   INTEGER NOT NULL DEFAULT 0
    )`;
}

export async function GET() {
  try {
    await ensureTable();
    const { rows } = await sql`SELECT country, count FROM signal_countries ORDER BY count DESC`;
    const countries: Record<string, number> = {};
    rows.forEach(r => { countries[String(r.country)] = Number(r.count); });
    return NextResponse.json({ countries });
  } catch {
    return NextResponse.json({ countries: {} });
  }
}
