import { NextResponse } from "next/server";

const PI_API = process.env.NEXT_PUBLIC_TAMAGOTCHI_API ?? "";

export const MOCK_USERS = [
  { rank: 1, alias: "KPOP", clicks: 1204 },
  { rank: 2, alias: "MRKR", clicks: 988 },
  { rank: 3, alias: "NEON", clicks: 741 },
  { rank: 4, alias: "VOID", clicks: 502 },
  { rank: 5, alias: "PXEL", clicks: 389 },
  { rank: 6, alias: "LUNA", clicks: 211 },
  { rank: 7, alias: "FUZZ", clicks: 98 },
];
export const MOCK_PET = { happiness: 72, energy: 58, mood: "HAPPY" };

export async function GET() {
  if (PI_API) {
    try {
      const res = await fetch(`${PI_API}/api/leaderboard`, { next: { revalidate: 10 } });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, piOnline: true });
      }
    } catch { /* fall through */ }
  }
  return NextResponse.json({ users: MOCK_USERS, pet: MOCK_PET, piOnline: false });
}
