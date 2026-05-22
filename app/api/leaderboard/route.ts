import { NextResponse } from "next/server";

const PI_API = process.env.NEXT_PUBLIC_TAMAGOTCHI_API ?? "";

const MOCK = [
  { rank: 1, nick: "KPOP", score: 1204 },
  { rank: 2, nick: "MRKR", score: 988 },
  { rank: 3, nick: "NEON", score: 741 },
  { rank: 4, nick: "VOID", score: 502 },
  { rank: 5, nick: "PXEL", score: 389 },
];

export async function GET() {
  if (PI_API) {
    try {
      const res = await fetch(`${PI_API}/api/leaderboard`, {
        next: { revalidate: 10 },
      });
      if (res.ok) {
        const data = await res.json();
        const rows = (data.users ?? []).map((u: { rank: number; alias: string; clicks: number }) => ({
          rank: u.rank,
          nick: u.alias,
          score: u.clicks,
        }));
        return NextResponse.json(rows);
      }
    } catch {
      // fall through to mock
    }
  }
  return NextResponse.json(MOCK);
}
